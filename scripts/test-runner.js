/**
 * Boots a throwaway PostgreSQL instance for test runs so `npm test` works
 * without Docker, applies the migrations, then runs Jest.
 *
 * Set TEST_DATABASE_URL to reuse an existing server instead. The database is
 * wiped between test files, so point it at a disposable database only.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { applyMigrations } = require('./apply-migrations');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, '.tmp', 'pgdata');
const DEFAULT_PORT = 55433;
const TEST_DATABASE_NAME = 'proptech_test';

function resolveDatabaseUrl(port) {
  return `postgresql://postgres:postgres@127.0.0.1:${port}/${TEST_DATABASE_NAME}?schema=public`;
}

async function startEmbeddedPostgres() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const port = Number(process.env.TEST_DATABASE_PORT ?? DEFAULT_PORT);

  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(TEST_DATABASE_NAME);

  return { pg, url: resolveDatabaseUrl(port) };
}

function assertDisposableDatabase(databaseUrl) {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
  const looksDisposable = /(_test|_ci|test)$/.test(databaseName);

  if (!looksDisposable && process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
    throw new Error(
      `Refusing to run destructive tests against "${databaseName}". ` +
        'Use a database whose name ends in _test (or set ALLOW_DESTRUCTIVE_TESTS=true).',
    );
  }
}

function runJest(args, databaseUrl) {
  const result = spawnSync('npx', ['jest', '--config', 'jest.config.js', ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'test' },
  });
  return result.status ?? 1;
}

async function main() {
  const jestArgs = process.argv.slice(2);
  let embedded = null;
  let databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    embedded = await startEmbeddedPostgres();
    databaseUrl = embedded.url;
  }

  assertDisposableDatabase(databaseUrl);

  const applied = await applyMigrations(databaseUrl);
  if (applied.length > 0) {
    console.log(`Applied migrations: ${applied.join(', ')}`);
  }

  let status;
  try {
    status = runJest(jestArgs, databaseUrl);
  } finally {
    if (embedded) {
      await embedded.pg.stop();
      fs.rmSync(DATA_DIR, { recursive: true, force: true });
    }
  }

  process.exit(status);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : (error ?? 'Test run failed'));
  process.exit(1);
});
