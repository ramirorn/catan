// Loads server/.env (local secrets such as DATABASE_URL) when it exists.
// Variables already set in the environment (e.g. on Render) win.
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const envFile = join(dirname(fileURLToPath(import.meta.url)), '../.env');
if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn('Could not read server/.env:', err.message);
  }
}
