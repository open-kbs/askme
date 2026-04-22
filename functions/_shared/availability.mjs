/**
 * 7-day availability generator — ported from ask-ivo-temp/src/lib/availability.ts.
 *
 * Differences from Next.js version:
 *   - DB is Postgres (DATABASE_URL) instead of SQLite
 *   - Connection pool cached across invocations
 *
 * Shape is identical: 7 days of DayAvailability, each with 30-min slots
 * from 09:00 to 21:00 Sofia time. A slot is `free: false` if it overlaps
 * any busy block from Google freebusy OR any pending/approved booking.
 */

import pg from 'pg';
import { freeBusyQuery } from './google-calendar.mjs';

let pool;
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sofiaOffsetForDate(dateStr) {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const sofiaHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Sofia',
      hour: 'numeric',
      hour12: false,
    }).format(probe),
    10,
  );
  const offset = sofiaHour - 12;
  return `${offset >= 0 ? '+' : '-'}${String(Math.abs(offset)).padStart(2, '0')}:00`;
}

export async function getAvailability() {
  const calendarIds = (process.env.GOOGLE_CALENDAR_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (calendarIds.length === 0) throw new Error('Calendar not configured');

  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const freeBusy = await freeBusyQuery({
    timeMin: now.toISOString(),
    timeMax: weekLater.toISOString(),
    timeZone: 'Europe/Sofia',
    calendarIds,
  });

  const allBusy = [];
  const calendars = freeBusy.calendars ?? {};
  for (const calId of Object.keys(calendars)) {
    for (const slot of calendars[calId].busy ?? []) {
      if (slot.start && slot.end) {
        allBusy.push({ start: new Date(slot.start), end: new Date(slot.end) });
      }
    }
  }
  allBusy.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged = [];
  for (const block of allBusy) {
    const last = merged[merged.length - 1];
    if (last && block.start <= last.end) {
      last.end = block.end > last.end ? block.end : last.end;
    } else {
      merged.push({ ...block });
    }
  }

  const db = getPool();
  if (db) {
    const { rows } = await db.query(
      `SELECT date, start_time, duration
         FROM bookings
        WHERE status IN ('pending','approved')`,
    );
    for (const b of rows) {
      const parts = String(b.date).split('-');
      const isoDate =
        parts.length === 3 && parts[0].length === 2
          ? `${parts[2]}-${parts[1]}-${parts[0]}`
          : b.date;
      const offStr = sofiaOffsetForDate(isoDate);
      const [h, m] = String(b.start_time).split(':').map(Number);
      const endMin = h * 60 + m + b.duration;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const bStart = new Date(`${isoDate}T${b.start_time}:00${offStr}`);
      const bEnd = new Date(
        `${isoDate}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00${offStr}`,
      );
      merged.push({ start: bStart, end: bEnd });
    }
    merged.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  const days = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    const sofiaDate = new Date(
      day.toLocaleString('en-US', { timeZone: 'Europe/Sofia' }),
    );
    const year = sofiaDate.getFullYear();
    const month = sofiaDate.getMonth();
    const date = sofiaDate.getDate();
    const dayOfWeek = DAY_NAMES[sofiaDate.getDay()];

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const displayDate = `${String(date).padStart(2, '0')}-${String(month + 1).padStart(2, '0')}-${year}`;
    const offsetStr = sofiaOffsetForDate(dateStr);
    const slots = [];

    // 09:00 (halfHour=18) through 21:00 (halfHour=42)
    for (let halfHour = 18; halfHour < 42; halfHour++) {
      const hour = Math.floor(halfHour / 2);
      const min = (halfHour % 2) * 30;
      const nextHalfHour = halfHour + 1;
      const nextHour = Math.floor(nextHalfHour / 2);
      const nextMin = (nextHalfHour % 2) * 30;

      const slotStart = new Date(
        `${dateStr}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00${offsetStr}`,
      );
      const slotEnd = new Date(
        `${dateStr}T${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}:00${offsetStr}`,
      );
      const isBusy = merged.some(
        (block) => slotStart < block.end && slotEnd > block.start,
      );

      const startStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const endStr = `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;

      if (d === 0) {
        const nowSofia = new Date(
          now.toLocaleString('en-US', { timeZone: 'Europe/Sofia' }),
        );
        if (hour < nowSofia.getHours() ||
            (hour === nowSofia.getHours() && min < nowSofia.getMinutes())) continue;
      }

      slots.push({ start: startStr, end: endStr, free: !isBusy });
    }

    days.push({ date: displayDate, dayOfWeek, slots });
  }

  return days;
}
