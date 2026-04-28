import './_env.mjs';
import { getUserFromEvent } from './_shared/auth.mjs';
import { buildSystemPrompt } from './_shared/career.mjs';
import { getAvailability } from './_shared/availability.mjs';
import { createBooking, getBooking, setStatus } from './_shared/bookings.mjs';
import { verifyAction } from './_shared/booking-token.mjs';
import { checkRateLimit, getClientIp } from './_shared/rate-limit.mjs';
import { createEvent } from './_shared/google-calendar.mjs';
import { getConfig } from './_shared/config.mjs';
import { getPool } from './_shared/db.mjs';
import {
  sendContactMessageEmail,
  sendBookingConfirmedEmail,
  sendBookingRejectedEmail,
} from './_shared/emails.mjs';

const { owner, branding, features } = getConfig();

// ---------------------------------------------------------------------------
// Shared infra
// ---------------------------------------------------------------------------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, statusCode = 200, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders },
    body: JSON.stringify(data),
  };
}

function html(body, statusCode = 200) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS },
    body,
  };
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeColor(value) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(value)) ? value : '#dc2626';
}

function page({ title, heading, message, color }) {
  return `<!DOCTYPE html>
<html><head><title>${esc(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#ededed;}
div{text-align:center;max-width:420px;padding:32px;}
h1{color:${safeColor(color)};margin:0 0 12px;font-size:24px;}
p{color:#a0a0a0;margin:0;line-height:1.5;}
</style></head><body><div><h1>${esc(heading)}</h1><p>${esc(message)}</p></div></body></html>`;
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ---------------------------------------------------------------------------
// Bookings schema
// ---------------------------------------------------------------------------

let schemaReady;

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = getPool();
  schemaReady = db.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id          text PRIMARY KEY,
      name        text NOT NULL,
      email       text NOT NULL,
      topic       text,
      date        text NOT NULL,
      start_time  text NOT NULL,
      duration    integer NOT NULL,
      status      text NOT NULL DEFAULT 'pending',
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  return schemaReady;
}

// ---------------------------------------------------------------------------
// Chat helpers
// ---------------------------------------------------------------------------

const TOOLS = [
  ...(features?.calendar ? [{
    type: 'function',
    function: {
      name: 'checkAvailability',
      description: `Check ${owner.firstName}'s real-time calendar availability for the next 7 days. Use this when someone asks about availability, free time, or wants to book a meeting. Returns available time slots in ${owner.timezoneLabel}.`,
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  }] : []),
  ...(features?.bookings ? [{
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
  }] : []),
  ...(features?.contactForm ? [{
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
  }] : []),
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
      ...(TOOLS.length > 0 ? { tools: TOOLS, tool_choice: 'auto' } : {}),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LLM ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  if (method === 'GET') {
    const params = event.queryStringParameters || {};
    if (params.action === 'approve-booking' || params.action === 'reject-booking') {
      if (!features?.bookings) return json({ error: 'Bookings are not enabled' }, 404);
      return handleBookingApproval(params);
    }
    return json({ error: 'Unknown action' }, 400);
  }

  if (method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  switch (body.action) {
    case 'chat':             return handleChat(event, body);
    case 'get-availability':
      if (!features?.calendar) return json({ error: 'Calendar is not enabled' }, 404);
      return handleAvailability(event);
    case 'create-booking':
      if (!features?.bookings) return json({ error: 'Bookings are not enabled' }, 404);
      return handleCreateBooking(event, body);
    case 'send-contact':
      if (!features?.contactForm) return json({ error: 'Contact form is not enabled' }, 404);
      return handleSendContact(event, body);
    default:                 return json({ error: 'Unknown action' }, 400);
  }
}

// ---------------------------------------------------------------------------
// Action: chat
// ---------------------------------------------------------------------------

async function handleChat(event, body) {
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
        } catch {
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

// ---------------------------------------------------------------------------
// Action: get-availability
// ---------------------------------------------------------------------------

async function handleAvailability(event) {
  const user = await getUserFromEvent(event);
  if (!user) return json({ error: 'Unauthorized — please sign in' }, 401);

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_CALENDAR_IDS) {
    return json({ error: 'Calendar not configured — add Google credentials to enable availability' }, 501);
  }

  try {
    const days = await getAvailability();
    return json({ days }, 200, { 'Cache-Control': 'no-store' });
  } catch (err) {
    console.error('availability error:', err);
    return json({ error: err?.message || 'availability error' }, 500);
  }
}

// ---------------------------------------------------------------------------
// Action: create-booking
// ---------------------------------------------------------------------------

async function handleCreateBooking(event, body) {
  const user = await getUserFromEvent(event);
  if (!user) return json({ error: 'Unauthorized — please sign in' }, 401);

  const ip = getClientIp(event);
  const rl = await checkRateLimit({
    key: ip,
    endpoint: 'bookings',
    limits: { perHour: 5, perDay: 10 },
  });
  if (!rl.ok) {
    return json({ error: 'Too many booking requests. Please try again later.' }, 429);
  }

  try {
    await ensureSchema();
  } catch (err) {
    console.error('schema init failed:', err);
    return json({ error: 'schema init failed' }, 500);
  }

  const { name, email, topic, date, startTime, duration } = body;
  const result = await createBooking({ name, email, topic, date, startTime, duration });

  if (result.success) return json(result, 201);
  const status = result.error === 'This slot is no longer available' ? 409 : 400;
  return json({ error: result.error }, status);
}

// ---------------------------------------------------------------------------
// Action: send-contact
// ---------------------------------------------------------------------------

async function handleSendContact(event, body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  const honeypot = String(body.website || '').trim();

  const ip = getClientIp(event);

  if (honeypot) {
    console.log('contact honeypot triggered', { ip, honeypot });
    return json({ success: true });
  }

  if (!process.env.CONTACT_EMAIL) {
    return json({ error: 'Contact form not configured — add CONTACT_EMAIL to enable' }, 501);
  }

  if (!name || !email || !message) {
    return json({ error: 'All fields are required' }, 400);
  }
  if (!isEmail(email)) return json({ error: 'Invalid email' }, 400);
  if (message.length > 5000) return json({ error: 'Message too long' }, 400);

  const rl = await checkRateLimit({
    key: ip,
    endpoint: 'contact',
    limits: { perMinute: 2, perHour: 3, perDay: 10 },
  });
  if (!rl.ok) {
    return json({ error: 'Too many messages. Please try again later.' }, 429);
  }

  try {
    await sendContactMessageEmail({ name, email, message });
    return json({ success: true });
  } catch (err) {
    console.error('contact error:', err);
    return json({ error: err instanceof Error ? err.message : 'Failed to send' }, 500);
  }
}

// ---------------------------------------------------------------------------
// Action: approve-booking / reject-booking (GET from email links)
// ---------------------------------------------------------------------------

async function handleBookingApproval(params) {
  try {
    await ensureSchema();
  } catch (err) {
    console.error('schema init failed:', err);
    return json({ error: 'schema init failed' }, 500);
  }

  const { action, id, sig } = params;
  const hmacAction = action === 'approve-booking' ? 'approve' : 'reject';

  if (!id || !sig || !verifyAction(id, hmacAction, sig)) {
    return html(
      page({
        title: 'Invalid link',
        heading: 'Invalid or expired link',
        message: 'This approval link is no longer valid.',
        color: '#dc2626',
      }),
      400,
    );
  }

  const booking = await getBooking(id);
  if (!booking) {
    return html(
      page({
        title: 'Not found',
        heading: 'Booking not found',
        message: 'We could not find this booking request.',
        color: '#dc2626',
      }),
      404,
    );
  }

  if (booking.status !== 'pending') {
    return html(
      page({
        title: 'Already processed',
        heading: `Booking already ${booking.status}`,
        message: 'No further action is needed.',
        color: '#a16207',
      }),
      400,
    );
  }

  const createdAt =
    booking.created_at instanceof Date ? booking.created_at : new Date(booking.created_at);
  const ageMs = Date.now() - createdAt.getTime();
  if (ageMs > 7 * 24 * 60 * 60 * 1000) {
    return html(
      page({
        title: 'Expired',
        heading: 'This booking request has expired',
        message: 'Requests older than 7 days cannot be approved.',
        color: '#dc2626',
      }),
      410,
    );
  }

  if (hmacAction === 'approve') return approveBooking(booking);
  return rejectBooking(booking);
}

async function approveBooking(booking) {
  try {
    const [h, m] = String(booking.start_time).split(':').map(Number);
    const endMinutes = h * 60 + m + booking.duration;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    const parts = String(booking.date).split('-');
    const isoDate =
      parts.length === 3 && parts[0].length === 2
        ? `${parts[2]}-${parts[1]}-${parts[0]}`
        : booking.date;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_CALENDAR_WRITE_ID) {
      await createEvent({
        summary: `Call with ${booking.name}`,
        description: `Booked via ${branding.siteName}\n\nName: ${booking.name}\nEmail: ${booking.email}${booking.topic ? `\nTopic: ${booking.topic}` : ''}`,
        startDateTime: `${isoDate}T${booking.start_time}:00`,
        endDateTime: `${isoDate}T${endTime}:00`,
        attendeeEmail: booking.email,
      });
    }

    await setStatus(booking.id, 'approved');
    try { await sendBookingConfirmedEmail(booking); } catch (e) { console.error('confirmation email failed:', e); }

    return html(
      page({
        title: 'Booking Approved',
        heading: 'Booking Approved!',
        message: `A confirmation has been sent to ${booking.name} (${booking.email}).`,
        color: '#2563eb',
      }),
      200,
    );
  } catch (err) {
    console.error('approve error:', err);
    return html(
      page({
        title: 'Error',
        heading: 'Error approving booking',
        message: 'Something went wrong. Please try again or check the server logs.',
        color: '#dc2626',
      }),
      500,
    );
  }
}

async function rejectBooking(booking) {
  try {
    await setStatus(booking.id, 'rejected');
    try { await sendBookingRejectedEmail(booking); } catch (e) { console.error('rejection email failed:', e); }
    return html(
      page({
        title: 'Booking Rejected',
        heading: 'Booking Rejected',
        message: `${booking.name} has been notified.`,
        color: '#dc2626',
      }),
      200,
    );
  } catch (err) {
    console.error('reject error:', err);
    return html(
      page({
        title: 'Error',
        heading: 'Error rejecting booking',
        message: 'Something went wrong. Please try again or check the server logs.',
        color: '#dc2626',
      }),
      500,
    );
  }
}
