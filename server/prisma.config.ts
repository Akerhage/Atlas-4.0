import "dotenv/config";
import path from "path";
import { defineConfig } from "prisma/config";

const dbPath = process.env.DATABASE_URL || `file:${path.resolve(__dirname, '..', 'atlas.db')}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbPath,
  },
});
