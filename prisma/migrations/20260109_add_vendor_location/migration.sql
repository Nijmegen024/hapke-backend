-- Add location and delivery radius to vendors
ALTER TABLE "Vendor"
  ADD COLUMN "lat" DOUBLE PRECISION,
  ADD COLUMN "lng" DOUBLE PRECISION,
  ADD COLUMN "deliveryRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5;
