/**
 * Booking creation + status updates. Persists to the pool returned by
 * `db.mjs` (pg.Pool in prod, PGlite shim for `npm run dev`).
 *
 * `createBooking` also checks the owner's Google Calendar for conflicts
 * and sends the approval-request email to the owner.
 */

import { randomBytes } from 'node:crypto';
import { freeBusyQuery } from './google-calendar.mjs';
import { sendApprovalRequestEmail } from './emails.mjs';
import { getConfig } from './config.mjs';
import { getPool } from './db.mjs';

const { owner } = getConfig();
const TIMEZONE = owner.timezone;

function genId() {
  return randomBytes(12).toString('base64url');
}

export async function createBooking(input) {
  const { name, email, topic, date, startTime, duration } = input;

  if (!name || !email || !date || !startTime) {
    return { success: false, error: 'Missing required fields' };
  }
  if (duration !== 30 && duration !== 60) {
    return { success: false, error: 'Duration must be 30 or 60' };
  }

  const [h, m] = startTime.split(':').map(Number);
  const endMinutes = h * 60 + m + duration;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  const calendarIds = (process.env.GOOGLE_CALENDAR_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const dateParts = date.split('-');
  const isoDate =
    dateParts.length === 3 && dateParts[0].length === 2
      ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
      : date;

  const probe = new Date(`${isoDate}T12:00:00Z`);
  const tzProbe = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).format(probe);
  const tzOffset = parseInt(tzProbe, 10) - 12;
  const offsetStr = `${tzOffset >= 0 ? '+' : '-'}${String(Math.abs(tzOffset)).padStart(2, '0')}:00`;

  const slotStart = new Date(`${isoDate}T${startTime}:00${offsetStr}`);
  const slotEnd = new Date(`${isoDate}T${endTime}:00${offsetStr}`);

  try {
    if (calendarIds.length > 0) {
      const freeBusy = await freeBusyQuery({
        timeMin: slotStart.toISOString(),
        timeMax: slotEnd.toISOString(),
        timeZone: TIMEZONE,
        calendarIds,
      });
      const calendars = freeBusy.calendars ?? {};
      for (const calId of Object.keys(calendars)) {
        const busy = calendars[calId].busy ?? [];
        if (busy.length > 0) {
          return { success: false, error: 'This slot is no longer available' };
        }
      }
    }

    const db = getPool();
    const { rows: overlapping } = await db.query(
      `SELECT id FROM bookings
        WHERE date = $1
          AND status IN ('pending','approved')
          AND (
            (start_time < $2 AND start_time >= $3)
            OR (start_time >= $3 AND start_time < $2)
          )`,
      [date, endTime, startTime],
    );
    if (overlapping.length > 0) {
      return { success: false, error: 'This slot is no longer available' };
    }

    const id = genId();
    const now = new Date();
    const booking = {
      id,
      name,
      email,
      topic: topic || null,
      date,
      start_time: startTime,
      duration,
      status: 'pending',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    await db.query(
      `INSERT INTO bookings (id, name, email, topic, date, start_time, duration, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, name, email, topic || null, date, startTime, duration, 'pending', now, now],
    );

    try {
      await sendApprovalRequestEmail(booking);
    } catch (err) {
      console.error('approval email failed:', err);
    }

    return {
      success: true,
      message: `Booking request submitted! ${owner.firstName} will review it and you'll receive an email confirmation.`,
    };
  } catch (err) {
    console.error('createBooking error:', err);
    return { success: false, error: 'Booking failed — please try again later' };
  }
}

export async function getBooking(id) {
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
  return rows[0];
}

export async function setStatus(id, status) {
  const db = getPool();
  await db.query(
    'UPDATE bookings SET status = $1, updated_at = now() WHERE id = $2',
    [status, id],
  );
}
