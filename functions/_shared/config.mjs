import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let cached = null;

export function getConfig() {
  if (cached) return cached;

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, 'config.json'),              // deployed: copied next to this file
    join(here, '..', '..', 'config.json'),  // repo tree: repo-root/config.json
  ];
  for (const p of candidates) {
    try {
      cached = JSON.parse(readFileSync(p, 'utf-8'));
      return cached;
    } catch {
      // try next candidate
    }
  }
  throw new Error('config.json not found — expected at repo root or bundled with _shared/');
}
