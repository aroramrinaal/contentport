-- Migration: Update all existing users to pro plan
-- Run this once to make all existing users pro

UPDATE "user" SET plan = 'pro' WHERE plan = 'free' OR plan IS NULL;

-- Verify the update
SELECT plan, COUNT(*) as user_count FROM "user" GROUP BY plan; 