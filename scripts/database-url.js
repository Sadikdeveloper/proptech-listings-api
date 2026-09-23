const { readFileSync } = require('node:fs');
const path = require('node:path');

const ENV_FILE = path.resolve(__dirname, '..', '.env');

/**
 * Resolution order: process environment (what CI and the test runner use),
 * then `.env` (what the Prisma CLI skips once a config file exists).
 */
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  try {
    const match = readFileSync(ENV_FILE, 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
    if (match) {
      return match[1].replace(/^["']|["']$/g, '');
    }
  } catch {
    // fall through to the error below
  }

  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and point it at PostgreSQL.');
}

module.exports = { resolveDatabaseUrl };
