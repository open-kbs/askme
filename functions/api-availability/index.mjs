import './_env.mjs';
import { getUserFromEvent } from './_shared/auth.mjs';
import { getAvailability } from './_shared/availability.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, statusCode = 200, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders },
    body: JSON.stringify(data),
  };
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const user = await getUserFromEvent(event);
  if (!user) return json({ error: 'Unauthorized — please sign in' }, 401);

  try {
    const days = await getAvailability();
    return json({ days }, 200, { 'Cache-Control': 'no-store' });
  } catch (err) {
    console.error('availability error:', err);
    return json({ error: err?.message || 'availability error' }, 500);
  }
}
