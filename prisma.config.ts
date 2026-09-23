import { defineConfig } from 'prisma/config';

const { resolveDatabaseUrl } = require('./scripts/database-url') as {
  resolveDatabaseUrl: () => string;
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  engine: 'classic',
  datasource: { url: resolveDatabaseUrl() },
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
});
