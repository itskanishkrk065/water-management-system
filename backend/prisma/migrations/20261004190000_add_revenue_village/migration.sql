-- CreateTable
CREATE TABLE IF NOT EXISTS "revenue_villages" (
    "revenue_village_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "block_id" UUID NOT NULL,
    "lgd_revenue_village_code" INTEGER,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_villages_pkey" PRIMARY KEY ("revenue_village_id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "revenue_villages_lgd_revenue_village_code_key" ON "revenue_villages"("lgd_revenue_village_code");
CREATE INDEX IF NOT EXISTS "revenue_villages_block_id_idx" ON "revenue_villages"("block_id");
CREATE INDEX IF NOT EXISTS "revenue_villages_lgd_revenue_village_code_idx" ON "revenue_villages"("lgd_revenue_village_code");
CREATE INDEX IF NOT EXISTS "revenue_villages_name_idx" ON "revenue_villages"("name");

-- AlterTable
ALTER TABLE "villages" ADD COLUMN IF NOT EXISTS "revenue_village_id" UUID;
CREATE INDEX IF NOT EXISTS "villages_revenue_village_id_idx" ON "villages"("revenue_village_id");

-- AlterTable
ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "revenue_village_id" UUID;

-- AlterTable
ALTER TABLE "user_geographic_scopes" ADD COLUMN IF NOT EXISTS "block_id" UUID;
ALTER TABLE "user_geographic_scopes" ADD COLUMN IF NOT EXISTS "block_name" TEXT;
ALTER TABLE "user_geographic_scopes" ADD COLUMN IF NOT EXISTS "revenue_village_id" UUID;
ALTER TABLE "user_geographic_scopes" ADD COLUMN IF NOT EXISTS "revenue_village_name" TEXT;
ALTER TABLE "user_geographic_scopes" ADD COLUMN IF NOT EXISTS "village_id" UUID;
ALTER TABLE "user_geographic_scopes" ADD COLUMN IF NOT EXISTS "village_name" TEXT;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_villages_block_id_fkey') THEN
        ALTER TABLE "revenue_villages" ADD CONSTRAINT "revenue_villages_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("block_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'villages_revenue_village_id_fkey') THEN
        ALTER TABLE "villages" ADD CONSTRAINT "villages_revenue_village_id_fkey" FOREIGN KEY ("revenue_village_id") REFERENCES "revenue_villages"("revenue_village_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beneficiaries_revenue_village_id_fkey') THEN
        ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_revenue_village_id_fkey" FOREIGN KEY ("revenue_village_id") REFERENCES "revenue_villages"("revenue_village_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
