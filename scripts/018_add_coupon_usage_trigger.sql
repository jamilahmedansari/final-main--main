-- Migration 018: Add trigger to update coupon usage count
-- This migration adds the trigger function and trigger to automatically update coupon usage count

-- Create trigger function to update coupon usage count
CREATE OR REPLACE FUNCTION update_coupon_usage_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Increment the usage count on the coupon
    UPDATE employee_coupons
    SET usage_count = usage_count + 1
    WHERE id = NEW.coupon_id;

    RETURN NEW;
END;
$$;

-- Create trigger to automatically update usage count
DROP TRIGGER IF EXISTS trigger_update_coupon_usage_count ON coupon_usage;
CREATE TRIGGER trigger_update_coupon_usage_count
    AFTER INSERT ON coupon_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_coupon_usage_count();

-- Add comment documenting the function
COMMENT ON FUNCTION update_coupon_usage_count IS 'Automatically increments coupon usage count when a coupon is used';