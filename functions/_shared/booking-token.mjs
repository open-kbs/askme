import { createHmac, timingSafeEqual } from 'node:crypto';

export function signAction(bookingId, action) {
  const secret = process.env.BOOKING_SECRET ?? '';
  return createHmac('sha256', secret).update(`${bookingId}:${action}`).digest('hex');
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
