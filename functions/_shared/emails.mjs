/**
 * Email templates — ported from src/lib/emails.ts.
 *
 * Uses OpenKBS email service (not Resend). Plain fetch against
 * https://project.openkbs.com/projects/{id}/email/send with API key auth.
 */

import { signAction } from './booking-token.mjs';

const OWNER_EMAIL = process.env.CONTACT_EMAIL ?? 'ivostoynovski@gmail.com';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

export async function sendApprovalRequestEmail(booking) {
  const approveSig = signAction(booking.id, 'approve');
  const rejectSig = signAction(booking.id, 'reject');
  const approveUrl = `${APP_URL}/api-bookings?action=approve&id=${booking.id}&sig=${approveSig}`;
  const rejectUrl = `${APP_URL}/api-bookings?action=reject&id=${booking.id}&sig=${rejectSig}`;

  const topic = booking.topic
    ? `<p><strong>Topic:</strong> ${esc(booking.topic)}</p>`
    : '';

  await sendEmail({
    to: OWNER_EMAIL,
    subject: `Booking request from ${booking.name}`,
    html: `
      <h2>New booking request</h2>
      <p><strong>Name:</strong> ${esc(booking.name)}</p>
      <p><strong>Email:</strong> ${esc(booking.email)}</p>
      <p><strong>Date:</strong> ${esc(booking.date)}</p>
      <p><strong>Time:</strong> ${esc(booking.start_time)}</p>
      <p><strong>Duration:</strong> ${esc(booking.duration)} minutes</p>
      ${topic}
      <br/>
      <p>
        <a href="${esc(approveUrl)}" style="background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;margin-right:10px;">Approve</a>
        <a href="${esc(rejectUrl)}" style="background:#dc2626;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Reject</a>
      </p>
    `,
  });
}

export async function sendBookingConfirmedEmail(booking) {
  await sendEmail({
    to: booking.email,
    subject: 'Your call with Ivo is confirmed!',
    text: `Hi ${booking.name},

Your call with Ivo has been confirmed.

Date: ${booking.date}
Time: ${booking.start_time}
Duration: ${booking.duration} minutes

You will receive a Google Calendar invite with the meeting details.

See you then!
Ivo`,
  });
}

export async function sendBookingRejectedEmail(booking) {
  await sendEmail({
    to: booking.email,
    subject: 'Booking update from Ivo',
    text: `Hi ${booking.name},

Unfortunately, Ivo is unable to make the requested time slot (${booking.date} at ${booking.start_time}).

Please feel free to book a different time on the website.

Best,
Ivo`,
  });
}

export async function sendContactMessageEmail({ name, email, message }) {
  await sendEmail({
    to: OWNER_EMAIL,
    subject: `Contact form: ${name}`,
    html: `
      <h2>New message from ask-ivo contact form</h2>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${esc(message)}</p>
    `,
  });
}
