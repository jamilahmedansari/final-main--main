-- Migration 017: Add missing get_employee_coupon function
-- This migration adds the get_employee_coupon function that was missing

CREATE OR REPLACE FUNCTION get_employee_coupon(p_employee_id UUID)
RETURNS TABLE (
    id UUID,
    code TEXT,
    discount_percent INT,
    is_active BOOLEAN,
    usage_count INT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ec.id,
        ec.code,
        ec.discount_percent,
        ec.is_active,
        ec.usage_count,
        ec.created_at
    FROM employee_coupons ec
    WHERE ec.employee_id = get_employee_coupon.p_employee_id
    ORDER BY ec.created_at DESC
    LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_employee_coupon TO authenticated;

-- Add comment documenting the function
COMMENT ON FUNCTION get_employee_coupon IS 'Retrieves the coupon details for a specific employee';