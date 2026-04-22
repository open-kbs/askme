/**
 * Connection-pool factory — abstracts over `pg.Pool` (prod) and a local
 * PGlite-backed shim (local dev).
 *
 * Selection:
 *   - DATABASE_URL set  → real Postgres via `pg.Pool` (deployed Lambda)
 *   - LOCAL_DB_FILE set → PGlite instance persisted to that file (local dev)
 *   - otherwise         → throws on first query
 *
 * The shim is loaded via dynamic import so production bundles never pay the
 * PGlite cost (and don't need it in `node_modules`).
 *
 * Callers treat the returned value as a `pg.Pool`: `await pool.query(sql, params)`
 * returns `{ rows, rowCount }`.
 */

import pg from 'pg';

let pool;

function createRealPool() {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 60_000,
    ssl: { rejectUnauthorized: false },
  });
}

function createLocalPool(dbFile) {
  // Lazy inner pool so the dynamic import happens on first query, not at
  // module-init time. Keeps the cold-start path clean for prod.
  //
  // `LOCAL_DB_SHIM_PATH` is an absolute path to `local/db.mjs`, set by
  // `local/server.mjs`. We can't rely on a relative path because this
  // module is copied into each function dir at dev startup (mirroring
  // deploy-time layout), which would break `../../local/db.mjs`.
  let inner;
  let initPromise;

  async function init() {
    if (inner) return inner;
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const shimPath = process.env.LOCAL_DB_SHIM_PATH;
      if (!shimPath) {
        throw new Error(
          'LOCAL_DB_SHIM_PATH not set — local/server.mjs must set it to the absolute path of local/db.mjs',
        );
      }
      const mod = await import(shimPath);
      inner = mod.createLocalPool(dbFile);
      return inner;
    })();
    return initPromise;
  }

  return {
    async query(text, params) {
      const p = await init();
      return p.query(text, params);
    },
  };
}

export function getPool() {
  if (pool) return pool;
  if (process.env.DATABASE_URL) {
    pool = createRealPool();
    return pool;
  }
  if (process.env.LOCAL_DB_FILE) {
    pool = createLocalPool(process.env.LOCAL_DB_FILE);
    return pool;
  }
  throw new Error(
    'no database configured — set DATABASE_URL (prod) or LOCAL_DB_FILE (local dev)',
  );
}
