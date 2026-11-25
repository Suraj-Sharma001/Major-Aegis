-- Move any existing VIEWER users to DEVELOPER before the value is removed
UPDATE "User" SET "role" = 'DEVELOPER' WHERE "role"::text = 'VIEWER';

-- AlterEnum: add GROK provider
ALTER TYPE "Provider" ADD VALUE 'GROK';

-- AlterEnum: remove VIEWER role
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'DEVELOPER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'DEVELOPER';
COMMIT;