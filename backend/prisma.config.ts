import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 reads the DB URL from here (used by migrate / studio / generate).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
