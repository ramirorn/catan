// Small Postgres pool (Neon). Only created when DATABASE_URL is set; the game
// itself never touches the database (only account actions and game ends).
import pg from 'pg';

let pool = null;

export function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  pool = new pg.Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000, // Neon may need a moment to wake up
  });
  // An idle client losing its connection must not crash the server
  pool.on('error', (err) => console.error('Postgres pool error:', err.message));
  return pool;
}

export async function closePool() {
  if (pool) await pool.end();
  pool = null;
}
