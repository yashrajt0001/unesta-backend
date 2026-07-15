-- Composite indexes for the search hot path: WHERE status = 'PUBLISHED'
-- ordered by createdAt (default "newest") or basePrice (price sorts).
-- CONCURRENTLY = no table lock, safe to run against the live DB.
-- Apply with:  npx prisma db execute --file prisma/manual/add_listing_search_indexes.sql --schema prisma/schema.prisma
-- (Run each statement separately if your driver rejects multi-statement batches.)

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Listing_status_createdAt_idx"
  ON "Listing" ("status", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Listing_status_basePrice_idx"
  ON "Listing" ("status", "basePrice");
