/**
 * PGlite-backed `pg.Pool`-shaped shim — used only by `npm run dev`.
 *
 * PGlite is a real Postgres compiled to WebAssembly, so all SQL in the
 * shared modules (`$1, $2` placeholders, `now() - interval '...'`,
 * `count(*)::int`, etc.) runs verbatim — no translation layer, no
 * divergence between local and prod.
 *
 * Persistence: the `dbFile` argument is passed through to PGlite, which
 * maps it to a directory (relative paths resolved against CWD). Omit to
 * get an ephemeral in-memory DB.
 */

import { PGlite } from '@electric-sql/pglite';

export function createLocalPool(dbFile) {
  const db = dbFile ? new PGlite(dbFile) : new PGlite();

  return {
    async query(text, params = []) {
      const res = await db.query(text, params);
      // pg.Pool returns { rows, rowCount, ... }; PGlite returns
      // { rows, affectedRows, fields }. Normalize so callers that read
      // `rowCount` (e.g. cleanup) keep working.
      return {
        rows: res.rows ?? [],
        rowCount: res.affectedRows ?? (res.rows ? res.rows.length : 0),
        fields: res.fields,
      };
    },
    async end() {
      await db.close();
    },
  };
}
