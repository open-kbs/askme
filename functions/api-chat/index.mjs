import './_env.mjs';
import { buildSystemPrompt } from './_shared/career.mjs';
import { getAvailability } from './_shared/availability.mjs';
import { createBooking } from './_shared/bookings.mjs';
import { sendContactMessageEmail } from './_shared/emails.mjs';
import { checkRateLimit, getClientIp } from './_shared/rate-limit.mjs';
import { getConfig } from './_shared/config.mjs';

const { owner } = getConfig();

/**
 * Chat handler — raw OpenAI-compatible fetch against the OpenKBS proxy.
 *
 * Deps: none (pg comes from _shared/bookings). The Vercel AI SDK bundle
 * (ai + @ai-sdk/openai + zod) is ~24MB and gets rejected by the deploy
 * API (413), so tools are wired by hand. Same 3 tools as Next.js source.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, statusCode = 200) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify(data),
  };
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'checkAvailability',
      description: `Check ${owner.firstName}'s real-time calendar availability for the next 7 days. Use this when someone asks about availability, free time, or wants to book a meeting. Returns available time slots in ${owner.timezoneLabel}.`,
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createBooking',
      description: `Create a booking request for a call with ${owner.firstName}. The booking goes to ${owner.firstName} for approval — the visitor will receive an email confirmation once approved. Collect the visitor's name, email, preferred date, time, and optionally a topic before calling this tool.`,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "The visitor's full name" },
          email: { type: 'string', description: "The visitor's email address" },
          date: { type: 'string', description: 'The booking date in dd-mm-yyyy format' },
          startTime: { type: 'string', description: `The start time in HH:MM format (24h, ${owner.timezoneLabel})` },
          duration: { type: 'integer', enum: [30, 60], description: 'Call duration in minutes — 30 or 60' },
          topic: { type: 'string', description: 'What the visitor wants to discuss' },
        },
        required: ['name', 'email', 'date', 'startTime', 'duration'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendMessage',
      description: `Send a message/email to ${owner.firstName} on behalf of the visitor. Use this when someone wants to contact ${owner.firstName}, send a message, or reach out. Collect the visitor's name, email, and message before calling this tool.`,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "The visitor's full name" },
          email: { type: 'string', description: "The visitor's email address" },
          message: { type: 'string', description: `The message content to send to ${owner.firstName}` },
        },
        required: ['name', 'email', 'message'],
        additionalProperties: false,
      },
    },
  },
];

async function runTool(name, args) {
  try {
    if (name === 'checkAvailability') {
      const days = await getAvailability();
      return days
        .map((day) => ({
          date: day.date,
          dayOfWeek: day.dayOfWeek,
          freeSlots: day.slots.filter((s) => s.free).map((s) => s.start),
        }))
        .filter((day) => day.freeSlots.length > 0);
    }
    if (name === 'createBooking') {
      return await createBooking(args);
    }
    if (name === 'sendMessage') {
      const { name: n, email, message } = args;
      await sendContactMessageEmail({ name: n, email, message });
      return { success: true, message: `Message sent! ${owner.firstName} will get back to you.` };
    }
    return { error: `unknown tool: ${name}` };
  } catch (err) {
    console.error(`tool ${name} failed:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : `${name} failed`,
    };
  }
}

function toOpenAIMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
    }))
    .filter((m) => m.content.length > 0);
}

function getLLMConfig() {
  if (process.env.OPENAI_API_KEY) {
    return {
      baseURL: 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY,
    };
  }
  if (process.env.OPENKBS_API_KEY) {
    return {
      baseURL: 'https://proxy.openkbs.com/v1/openai/chat/completions',
      apiKey: process.env.OPENKBS_API_KEY,
    };
  }
  return null;
}

async function callModel(messages) {
  const llm = getLLMConfig();
  if (!llm) throw new Error('No LLM key — set OPENAI_API_KEY or OPENKBS_API_KEY');
  const res = await fetch(llm.baseURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llm.apiKey}` },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LLM ${res.status}: ${text}`);
  return JSON.parse(text);
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const userMessages = toOpenAIMessages(body.messages);
  if (userMessages.length === 0) return json({ error: 'messages required' }, 400);

  const ip = getClientIp(event);
  const rl = await checkRateLimit({
    key: ip,
    endpoint: 'chat',
    limits: { perMinute: 10, perHour: 40, perDay: 100 },
  });
  if (!rl.ok) {
    return json({ error: 'Too many requests. Please slow down and try again shortly.' }, 429);
  }

  const toolParts = [];
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...userMessages,
  ];

  try {
    for (let step = 0; step < 5; step++) {
      const response = await callModel(messages);
      const choice = response.choices?.[0];
      const message = choice?.message;
      if (!message) throw new Error('Empty response from model');

      messages.push(message);

      const toolCalls = message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return json({ text: message.content ?? '', toolParts });
      }

      for (const call of toolCalls) {
        let args = {};
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (err) {
          args = {};
        }
        const output = await runTool(call.function?.name, args);
        toolParts.push({ toolName: call.function?.name, input: args, output });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(output),
        });
      }
    }

    const last = messages[messages.length - 1];
    return json({
      text: last?.role === 'assistant' ? last.content ?? '' : '',
      toolParts,
    });
  } catch (err) {
    console.error('chat error:', err);
    return json({ error: err instanceof Error ? err.message : 'chat failed' }, 500);
  }
}
