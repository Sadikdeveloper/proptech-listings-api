/**
 * Local PostgreSQL for machines without Docker (locked-down sandboxes, CI).
 * Boots an embedded server, applies the committed migrations, writes `.env` on
 * first run and then stays in the foreground until interrupted.
 *
 * `docker compose up -d` plus `npm run prisma:deploy` is the normal dev path.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { applyMigrations } = require('./apply-migrations');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, '.tmp', 'pgdata-dev');
const PORT = Number(process.env.EMBEDDED_PG_PORT ?? 55432);
const DATABASE_NAME = 'proptech';
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/${DATABASE_NAME}?schema=public`;

function writeEnvFile() {
  const envPath = path.join(ROOT, '.env');
  const template = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const contents = template.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${DATABASE_URL}"`);

  fs.writeFileSync(envPath, contents);
  console.log('Wrote .env pointing at the embedded database');
}

async function main() {
  if (spawnSync('which', ['psql']).status === 0 && process.env.FORCE_EMBEDDED !== 'true') {
    console.log('A system PostgreSQL client was found; the embedded server is optional.');
  }

  const { default: EmbeddedPostgres } = await import('embedded-postgres');

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
    onLog: () => {},
  });

  if (!fs.existsSync(DATA_DIR)) {
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    DATABASE_NAME,
  ]);
  await client.end();

  if (existing.rows.length === 0) {
    await pg.createDatabase(DATABASE_NAME);
  }

  const applied = await applyMigrations(DATABASE_URL);
  console.log(applied.length > 0 ? `Applied migrations: ${applied.join(', ')}` : 'Schema up to date');

  if (!fs.existsSync(path.join(ROOT, '.env'))) {
    writeEnvFile();
  }

  console.log(`Embedded PostgreSQL ${PORT} ready (${DATABASE_NAME})`);
  console.log('  npm run seed');
  console.log('  npm run start:dev');

  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
