/**
 * Applies the committed `prisma/migrations/**` files through the `pg` driver.
 *
 * `prisma migrate deploy` is the supported command and is what you should use
 * whenever the Prisma schema engine can be downloaded. This applier exists for
 * environments where that binary is unavailable (offline CI sandboxes); it
 * produces the same schema and writes the same `_prisma_migrations` bookkeeping
 * rows, so a later `prisma migrate deploy` sees no pending work.
 */
const { createHash, randomUUID } = require('node:crypto');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'prisma', 'migrations');

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
  )`;

function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((entry) => statSync(path.join(MIGRATIONS_DIR, entry)).isDirectory())
    .sort()
    .map((name) => {
      const file = path.join(MIGRATIONS_DIR, name, 'migration.sql');
      const sql = readFileSync(file, 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

async function applyMigrations(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(CREATE_MIGRATIONS_TABLE);

    const applied = await client.query(
      'SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL',
    );
    const done = new Set(applied.rows.map((row) => row.migration_name));
    const appliedNow = [];

    for (const migration of listMigrations()) {
      if (done.has(migration.name)) {
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO "_prisma_migrations"
             ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
           VALUES ($1, $2, now(), $3, now(), 1)`,
          [randomUUID(), migration.checksum, migration.name],
        );
        await client.query('COMMIT');
        appliedNow.push(migration.name);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration "${migration.name}" failed: ${error.message}`);
      }
    }

    return appliedNow;
  } finally {
    await client.end();
  }
}

module.exports = { applyMigrations, listMigrations };

if (require.main === module) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  applyMigrations(databaseUrl)
    .then((applied) => {
      console.log(
        applied.length > 0
          ? `Applied migrations: ${applied.join(', ')}`
          : 'Database is already up to date',
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
