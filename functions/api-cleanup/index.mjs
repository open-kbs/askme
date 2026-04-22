import './_env.mjs';
import { cleanupOldRateLimits } from './_shared/rate-limit.mjs';

export async function handler() {
  try {
    const deleted = await cleanupOldRateLimits();
    console.log('rate_limit cleanup deleted', deleted, 'rows');
    return { statusCode: 200, body: JSON.stringify({ deleted }) };
  } catch (err) {
    console.error('cleanup error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
