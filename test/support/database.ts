import { Client } from 'pg';

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Run the suite through `npm test`.');
  }
  return url;
}

/** Empties both tables so each test starts from a known state. */
export async function truncateTables(): Promise<void> {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query('TRUNCATE TABLE "listings", "agents" RESTART IDENTITY CASCADE');
  } finally {
    await client.end();
  }
}
