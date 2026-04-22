import './_env.mjs';
import pg from 'pg';
import { getUserFromEvent } from './_shared/auth.mjs';
import { createBooking, getBooking, setStatus } from './_shared/bookings.mjs';
import { verifyAction } from './_shared/booking-token.mjs';
import { checkRateLimit, getClientIp } from './_shared/rate-limit.mjs';
import { createEvent } from './_shared/google-calendar.mjs';
import {
  sendBookingConfirmedEmail,
  sendBookingRejectedEmail,
} from './_shared/emails.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, statusCode = 200) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS },
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

let pool;
let schemaReady;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 60_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = getPool();
  if (!db) throw new Error('DATABASE_URL not configured');
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

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    await ensureSchema();
  } catch (err) {
    console.error('schema init failed:', err);
    return json({ error: 'schema init failed' }, 500);
  }

  const query = event.queryStringParameters ?? {};

  if (method === 'GET' && (query.action === 'approve' || query.action === 'reject')) {
    return handleApproveReject(query);
  }

  if (method === 'POST') {
    return handleCreate(event);
  }

  return json({ error: 'Not found' }, 404);
}

async function handleCreate(event) {
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

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { name, email, topic, date, startTime, duration } = body;
  const result = await createBooking({ name, email, topic, date, startTime, duration });

  if (result.success) return json(result, 201);
  const status = result.error === 'This slot is no longer available' ? 409 : 400;
  return json({ error: result.error }, status);
}

async function handleApproveReject(query) {
  const { action, id, sig } = query;
  if (!id || !sig || !verifyAction(id, action, sig)) {
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

  if (action === 'approve') return approveBooking(booking);
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

    await createEvent({
      summary: `Call with ${booking.name}`,
      description: `Booked via Ask Ivo\n\nName: ${booking.name}\nEmail: ${booking.email}${booking.topic ? `\nTopic: ${booking.topic}` : ''}`,
      startDateTime: `${isoDate}T${booking.start_time}:00`,
      endDateTime: `${isoDate}T${endTime}:00`,
      attendeeEmail: booking.email,
    });

    await setStatus(booking.id, 'approved');
    await sendBookingConfirmedEmail(booking);

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
    await sendBookingRejectedEmail(booking);
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
