import './_env.mjs';
import { sendContactMessageEmail } from './_shared/emails.mjs';
import { checkRateLimit, getClientIp } from './_shared/rate-limit.mjs';

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

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  const honeypot = String(body.website || '').trim();

  const ip = getClientIp(event);

  if (honeypot) {
    console.log('contact honeypot triggered', { ip, honeypot });
    return json({ success: true });
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
