import { createHmac, timingSafeEqual } from 'node:crypto';

function getSecret() {
  const s = process.env.BOOKING_SECRET;
  if (!s) throw new Error('BOOKING_SECRET is not set');
  return s;
}

export function signAction(bookingId, action) {
  return createHmac('sha256', getSecret()).update(`${bookingId}:${action}`).digest('hex');
}

export function verifyAction(bookingId, action, sig) {
  const expected = signAction(bookingId, action);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
