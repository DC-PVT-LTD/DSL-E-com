-- CreateEnum
CREATE TYPE "SkuOwnerType" AS ENUM ('PRODUCT', 'VARIANT');

-- CreateTable GlobalSku
CREATE TABLE "GlobalSku" (
    "sku" TEXT NOT NULL,
    "ownerType" "SkuOwnerType" NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalSku_pkey" PRIMARY KEY ("sku")
);

-- CreateTable SkuSequence
CREATE TABLE "SkuSequence" (
    "prefix" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkuSequence_pkey" PRIMARY KEY ("prefix")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalSku_productId_key" ON "GlobalSku"("productId");
CREATE UNIQUE INDEX "GlobalSku_variantId_key" ON "GlobalSku"("variantId");
CREATE INDEX "GlobalSku_productId_idx" ON "GlobalSku"("productId");
CREATE INDEX "GlobalSku_variantId_idx" ON "GlobalSku"("variantId");

-- Structural Single-Owner CHECK Constraint
ALTER TABLE "GlobalSku" ADD CONSTRAINT "chk_global_sku_ownership_structure" CHECK (
  ("ownerType" = 'PRODUCT' AND "productId" IS NOT NULL AND "variantId" IS NULL) OR
  ("ownerType" = 'VARIANT' AND "productId" IS NULL AND "variantId" IS NOT NULL)
);

-- AddForeignKey
ALTER TABLE "GlobalSku" ADD CONSTRAINT "GlobalSku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalSku" ADD CONSTRAINT "GlobalSku_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigger: protect_global_sku_direct_deletion
CREATE OR REPLACE FUNCTION protect_global_sku_direct_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_still_exists BOOLEAN := FALSE;
BEGIN
  IF OLD."ownerType" = 'PRODUCT' THEN
    SELECT EXISTS(
      SELECT 1 FROM "Product" WHERE id = OLD."productId" AND sku = OLD.sku
    ) INTO v_still_exists;

    IF v_still_exists THEN
      RAISE EXCEPTION 'Direct Deletion Prohibited: Cannot delete GlobalSku "%" because Product "%" is still active with this SKU.',
        OLD.sku, OLD."productId";
    END IF;

  ELSIF OLD."ownerType" = 'VARIANT' THEN
    SELECT EXISTS(
      SELECT 1 FROM "ProductVariant" WHERE id = OLD."variantId" AND sku = OLD.sku
    ) INTO v_still_exists;

    IF v_still_exists THEN
      RAISE EXCEPTION 'Direct Deletion Prohibited: Cannot delete GlobalSku "%" because ProductVariant "%" is still active with this SKU.',
        OLD.sku, OLD."variantId";
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_global_sku_deletion
BEFORE DELETE ON "GlobalSku"
FOR EACH ROW EXECUTE FUNCTION protect_global_sku_direct_deletion();

-- Trigger: validate_global_sku_mutation
CREATE OR REPLACE FUNCTION validate_global_sku_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_sku TEXT;
BEGIN
  IF NEW."ownerType" = 'PRODUCT' THEN
    SELECT sku INTO v_entity_sku FROM "Product" WHERE id = NEW."productId";
    IF v_entity_sku IS NULL THEN
      RAISE EXCEPTION 'GlobalSku Integrity Violation: Referenced Product ID "%" does not exist', NEW."productId";
    END IF;
    IF v_entity_sku <> NEW.sku THEN
      RAISE EXCEPTION 'GlobalSku Integrity Violation: Product "%" SKU ("%") does not match GlobalSku.sku ("%")',
        NEW."productId", v_entity_sku, NEW.sku;
    END IF;

  ELSIF NEW."ownerType" = 'VARIANT' THEN
    SELECT sku INTO v_entity_sku FROM "ProductVariant" WHERE id = NEW."variantId";
    IF v_entity_sku IS NULL THEN
      RAISE EXCEPTION 'GlobalSku Integrity Violation: Referenced ProductVariant ID "%" does not exist', NEW."variantId";
    END IF;
    IF v_entity_sku <> NEW.sku THEN
      RAISE EXCEPTION 'GlobalSku Integrity Violation: ProductVariant "%" SKU ("%") does not match GlobalSku.sku ("%")',
        NEW."variantId", v_entity_sku, NEW.sku;
    END IF;

  ELSE
    RAISE EXCEPTION 'GlobalSku Integrity Violation: Invalid ownerType "%"', NEW."ownerType";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_global_sku_mutation
BEFORE INSERT OR UPDATE ON "GlobalSku"
FOR EACH ROW EXECUTE FUNCTION validate_global_sku_mutation();

-- Backfill existing Products and Variants into GlobalSku
INSERT INTO "GlobalSku" ("sku", "ownerType", "productId", "variantId", "createdAt")
SELECT sku, 'PRODUCT'::"SkuOwnerType", id, NULL, "createdAt"
FROM "Product"
WHERE sku IS NOT NULL;

INSERT INTO "GlobalSku" ("sku", "ownerType", "productId", "variantId", "createdAt")
SELECT sku, 'VARIANT'::"SkuOwnerType", NULL, id, "createdAt"
FROM "ProductVariant"
WHERE sku IS NOT NULL;

-- Trigger: sync_product_sku_to_global
CREATE OR REPLACE FUNCTION sync_product_sku_to_global()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO "GlobalSku" (sku, "ownerType", "productId", "variantId", "createdAt")
    VALUES (NEW.sku, 'PRODUCT', NEW.id, NULL, NOW());

  ELSIF (TG_OP = 'UPDATE' AND NEW.sku <> OLD.sku) THEN
    DELETE FROM "GlobalSku" 
    WHERE sku = OLD.sku AND "ownerType" = 'PRODUCT' AND "productId" = NEW.id;

    INSERT INTO "GlobalSku" (sku, "ownerType", "productId", "variantId", "createdAt")
    VALUES (NEW.sku, 'PRODUCT', NEW.id, NULL, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_product_sku
AFTER INSERT OR UPDATE ON "Product"
FOR EACH ROW EXECUTE FUNCTION sync_product_sku_to_global();

-- Trigger: sync_variant_sku_to_global
CREATE OR REPLACE FUNCTION sync_variant_sku_to_global()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO "GlobalSku" (sku, "ownerType", "productId", "variantId", "createdAt")
    VALUES (NEW.sku, 'VARIANT', NULL, NEW.id, NOW());

  ELSIF (TG_OP = 'UPDATE' AND NEW.sku <> OLD.sku) THEN
    DELETE FROM "GlobalSku" 
    WHERE sku = OLD.sku AND "ownerType" = 'VARIANT' AND "variantId" = NEW.id;

    INSERT INTO "GlobalSku" (sku, "ownerType", "productId", "variantId", "createdAt")
    VALUES (NEW.sku, 'VARIANT', NULL, NEW.id, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_variant_sku
AFTER INSERT OR UPDATE ON "ProductVariant"
FOR EACH ROW EXECUTE FUNCTION sync_variant_sku_to_global();

