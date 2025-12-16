-- Performance Indexes for Query Optimization
-- Created: 2025-12-16
-- Purpose: Add indexes to improve dashboard and admin portal query performance

-- Index for dashboard queries (get user's letters sorted by date)
CREATE INDEX IF NOT EXISTS idx_letters_created_at ON letters(created_at DESC);

-- Composite index for filtering letters by user and status
CREATE INDEX IF NOT EXISTS idx_letters_user_status ON letters(user_id, status);

-- Index for admin review queue queries
CREATE INDEX IF NOT EXISTS idx_letters_status_created ON letters(status, created_at DESC)
WHERE status IN ('pending_review', 'under_review');

-- Index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)
WHERE status = 'active';

-- Index for coupon lookups by code
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- Index for employee commission queries
CREATE INDEX IF NOT EXISTS idx_coupons_employee_id ON coupons(employee_id);

-- Index for audit trail queries
CREATE INDEX IF NOT EXISTS idx_letter_audit_letter_id ON letter_audit_log(letter_id, created_at DESC);

-- Add comment explaining indexes
COMMENT ON INDEX idx_letters_created_at IS 'Improves dashboard letter list queries';
COMMENT ON INDEX idx_letters_user_status IS 'Optimizes user letter filtering by status';
COMMENT ON INDEX idx_letters_status_created IS 'Speeds up admin review queue';
COMMENT ON INDEX idx_subscriptions_user_id IS 'Fast subscription lookups per user';
COMMENT ON INDEX idx_coupons_code IS 'Instant coupon validation';
COMMENT ON INDEX idx_coupons_employee_id IS 'Employee commission dashboard queries';
COMMENT ON INDEX idx_letter_audit_letter_id IS 'Fast audit log retrieval';

-- Analyze tables to update statistics
ANALYZE letters;
ANALYZE subscriptions;
ANALYZE coupons;
ANALYZE letter_audit_log;
