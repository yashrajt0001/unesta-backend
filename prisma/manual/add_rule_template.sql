-- Admin-managed rule catalogue hosts pick from when adding house rules.
-- Additive only: no existing table is touched (the DB carries a drifted orphan
-- RefreshToken table, so `prisma db push` must not be used here).
-- Apply with:  npx prisma db execute --file prisma/manual/add_rule_template.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "RuleTemplate" (
  "id"        TEXT NOT NULL,
  "text"      TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RuleTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RuleTemplate_text_key" ON "RuleTemplate" ("text");
