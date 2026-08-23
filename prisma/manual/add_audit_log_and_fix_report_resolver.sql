-- Applied with `prisma db execute`, not `prisma migrate dev`: the database still
-- carries a RefreshToken table that is no longer in schema.prisma, and migrate
-- would offer to drop it. Re-running this file is safe.

-- ── 1. Moderator audit trail ────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditTargetType') THEN
    CREATE TYPE "AuditTargetType" AS ENUM (
      'USER', 'LISTING', 'BOOKING', 'REVIEW', 'REPORT',
      'MODERATOR', 'AMENITY', 'RULE_TEMPLATE', 'PAYOUT'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"             TEXT NOT NULL,
  "moderatorId"    TEXT,
  "moderatorEmail" TEXT NOT NULL,
  "action"         TEXT NOT NULL,
  "targetType"     "AuditTargetType" NOT NULL,
  "targetId"       TEXT NOT NULL,
  "summary"        TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_moderatorId_idx" ON "AuditLog" ("moderatorId");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx"
  ON "AuditLog" ("targetType", "targetId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_moderatorId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_moderatorId_fkey"
      FOREIGN KEY ("moderatorId") REFERENCES "Moderator" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- ── 2. Report.resolvedById points at Moderator, not User ────────────────────
-- Reports are resolved by moderators, and the code has always written a
-- Moderator id here. The old constraint referenced User, so every resolve threw
-- a foreign key violation.

ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_resolvedById_fkey";

-- Any value that is not a moderator id could never have been written by the
-- resolve path, so it is safe to clear.
UPDATE "Report"
   SET "resolvedById" = NULL
 WHERE "resolvedById" IS NOT NULL
   AND "resolvedById" NOT IN (SELECT "id" FROM "Moderator");

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "Moderator" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
