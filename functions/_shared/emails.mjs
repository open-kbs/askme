/**
 * Email sender — templates live in config.emails (Mustache-lite).
 *
 * Uses OpenKBS email service. Plain fetch against
 * https://project.openkbs.com/projects/{id}/email/send with API key auth.
 *
 * Template syntax:
 *   {{path.to.var}}   → HTML-escaped when used in an HTML body
 *   {{{path.to.var}}} → raw (for pre-built HTML chunks like the topic block)
 *   Text bodies never escape — {{var}} and {{{var}}} both render raw.
 */

import { signAction } from './booking-token.mjs';
import { getConfig } from './config.mjs';

const { owner, branding, emails } = getConfig();
const OWNER_EMAIL = process.env.CONTACT_EMAIL;
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

if (!OWNER_EMAIL) {
  console.warn('CONTACT_EMAIL env var not set — owner-bound emails will fail.');
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolvePath(vars, path) {
  return path.split('.').reduce((v, k) => (v == null ? v : v[k]), vars);
}

function renderTemplate(template, vars, { html = false } = {}) {
  return template
    // Triple-brace = raw, process first so double-brace doesn't steal it
    .replace(/\{\{\{([\w.]+)\}\}\}/g, (_, path) => {
      const v = resolvePath(vars, path);
      return v == null ? '' : String(v);
    })
    .replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
      const v = resolvePath(vars, path);
      if (v == null) return '';
      return html ? esc(v) : String(v);
    });
}

async function sendEmail({ to, subject, html, text }) {
  const projectId = process.env.OPENKBS_PROJECT_ID;
  const apiKey = process.env.OPENKBS_API_KEY;
  if (!projectId || !apiKey) throw new Error('OpenKBS email: missing project id or api key');

  const body = { to, subject };
  if (html) body.html = html;
  if (text) body.text = text;
  if (process.env.FROM_EMAIL) body.from = process.env.FROM_EMAIL;

  const res = await fetch(
    `https://project.openkbs.com/projects/${projectId}/email/send`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    },
  );
  const resText = await res.text();
  if (!res.ok) throw new Error(`email send failed (${res.status}): ${resText}`);
  return resText ? JSON.parse(resText) : null;
}

function baseVars() {
  return {
    firstName: owner.firstName,
    name: owner.name,
    siteName: branding.siteName,
  };
}

export async function sendApprovalRequestEmail(booking) {
  const approveSig = signAction(booking.id, 'approve');
  const rejectSig = signAction(booking.id, 'reject');
  const approveUrl = `${APP_URL}/api-bookings?action=approve&id=${booking.id}&sig=${approveSig}`;
  const rejectUrl = `${APP_URL}/api-bookings?action=reject&id=${booking.id}&sig=${rejectSig}`;

  const topicBlock = booking.topic
    ? `<p><strong>Topic:</strong> ${esc(booking.topic)}</p>`
    : '';

  const vars = {
    ...baseVars(),
    booking,
    approveUrl,
    rejectUrl,
    topicBlock,
  };

  await sendEmail({
    to: OWNER_EMAIL,
    subject: renderTemplate(emails.approvalRequest.subject, vars),
    html: renderTemplate(emails.approvalRequest.html, vars, { html: true }),
  });
}

export async function sendBookingConfirmedEmail(booking) {
  const vars = { ...baseVars(), booking };
  await sendEmail({
    to: booking.email,
    subject: renderTemplate(emails.bookingConfirmed.subject, vars),
    text: renderTemplate(emails.bookingConfirmed.text, vars),
  });
}

export async function sendBookingRejectedEmail(booking) {
  const vars = { ...baseVars(), booking };
  await sendEmail({
    to: booking.email,
    subject: renderTemplate(emails.bookingRejected.subject, vars),
    text: renderTemplate(emails.bookingRejected.text, vars),
  });
}

export async function sendContactMessageEmail({ name, email, message }) {
  const vars = { ...baseVars(), name, email, message };
  await sendEmail({
    to: OWNER_EMAIL,
    subject: renderTemplate(emails.contactMessage.subject, vars),
    html: renderTemplate(emails.contactMessage.html, vars, { html: true }),
  });
}
