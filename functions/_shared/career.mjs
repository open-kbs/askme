import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.mjs';

const { owner, branding, social, systemPrompt, features } = getConfig();

function loadCareerData() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, 'career.json'),
    join(here, '..', '..', 'assets', 'career.json'),
  ];
  for (const p of candidates) {
    try { return JSON.parse(readFileSync(p, 'utf-8')); } catch {}
  }
  throw new Error('career.json not found — expected bundled with _shared/ or at assets/career.json');
}

const careerData = loadCareerData();

export const career = {
  name: owner.name,
  nameLocal: owner.nameLocal,
  title: owner.title,
  location: owner.location,
  ...careerData,
};

function fillTemplate(str) {
  return str
    .replaceAll('{name}', owner.name)
    .replaceAll('{firstName}', owner.firstName)
    .replaceAll('{nameLocal}', owner.nameLocal || '')
    .replaceAll('{title}', owner.title)
    .replaceAll('{location}', owner.location)
    .replaceAll('{siteName}', branding.siteName)
    .replaceAll('{social.linkedin}', social.linkedin || '')
    .replaceAll('{social.github}', social.github || '');
}

function fillAll(items) {
  return items.map(fillTemplate);
}

export function buildSystemPrompt() {
  const experienceBlock = career.experience
    .map(
      (exp) =>
        `- ${exp.role} (${exp.period})\n  ${exp.description}${exp.highlights.length > 0 ? `\n  Highlights: ${exp.highlights.join('; ')}` : ''}`,
    )
    .join('\n');

  const educationBlock = career.education
    .map(
      (edu) =>
        `- ${edu.institution}${edu.degree ? ` — ${edu.degree}` : ''} (${edu.period})`,
    )
    .join('\n');

  const sideProjectsBlock = career.sideProjects
    .map(
      (proj) =>
        `- ${proj.name} (${proj.role})\n  ${proj.description}\n  Tech: ${proj.techStack.join(', ')}\n  GitHub: ${proj.github}\n  Notable apps: ${proj.notableApps.join('; ')}`,
    )
    .join('\n');

  const reservedFactsBlock = (career.conditionalFacts || [])
    .map((f) => `- ${f.label}: ${f.fact} Trigger: ${f.trigger}`)
    .join('\n');

  const nameLine = owner.nameLocal
    ? `Name: ${career.name} (in local language: ${owner.nameLocal} — ${systemPrompt.localNameInstruction})`
    : `Name: ${career.name}`;

  const bulletList = (items) => items.map((s) => `- ${s}`).join('\n');

  return `${fillTemplate(systemPrompt.persona)}

Here is your information:

${nameLine}
Title: ${career.title}
Location: ${career.location}

Summary:
${career.summary}

Experience:
${experienceBlock}

Education:
${educationBlock}

Side Projects:
${sideProjectsBlock}

Skills: ${career.skills.join(', ')}
Languages: ${career.languages.join(', ')}
Certifications: ${career.certifications.join(', ')}

Other ventures:
${career.earlierVentures}${reservedFactsBlock ? `

Reserved facts (do NOT volunteer — only mention when explicitly triggered):
${reservedFactsBlock}` : ''}

About this website:
${bulletList(fillAll(systemPrompt.aboutSite.filter((line) => {
    if (!features?.contactForm && line.includes('Contact page')) return false;
    if (!features?.calendar && line.includes('Availability')) return false;
    return true;
  })))}
${(() => {
    const tools = [];
    if (features?.calendar) tools.push(`- checkAvailability: checks my real Google Calendar and returns available time slots for the next 7 days. ALWAYS use this tool when someone asks about my availability or wants to book — never guess or make up times.`);
    if (features?.bookings) tools.push(`- createBooking: creates a booking request. Before calling this, make sure you have the visitor's name, email, preferred date (dd-mm-yyyy), start time (HH:MM, 24h ${owner.timezoneLabel}), and duration (30 or 60 minutes). The topic is optional. The booking goes to me for approval — the visitor gets an email once I confirm.`);
    if (features?.contactForm) tools.push(`- sendMessage: sends a message/email to ${owner.firstName} on behalf of the visitor. Collect the visitor's name, email, and message before calling this. Use this when someone wants to contact ${owner.firstName}, send a message, or reach out.`);
    return tools.length > 0 ? `\nTools you have access to:\n${tools.join('\n')}\n` : '';
  })()}
Guidelines:
${bulletList(fillAll(systemPrompt.guidelines.filter((g) => {
    if (!features?.bookings && g.includes('book a call')) return false;
    return true;
  })))}

Honest-scope rules (strict):
- ${fillTemplate(systemPrompt.honestScope.intro)}
${bulletList(fillAll(systemPrompt.honestScope.rules))}

Personal / non-professional questions:
${bulletList(fillAll(systemPrompt.personalQuestions))}`;
}
