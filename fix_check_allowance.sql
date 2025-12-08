-- Fix check_letter_allowance to use correct column name (remaining_letters instead of credits_remaining)
DROP FUNCTION IF EXISTS public.check_letter_allowance(UUID);
CREATE OR REPLACE FUNCTION public.check_letter_allowance(u_id UUID)
RETURNS TABLE(has_allowance BOOLEAN, remaining INTEGER, plan_name TEXT, is_super BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    is_superuser BOOLEAN;
    active_subscription RECORD;
    remaining_count INTEGER;
BEGIN
    -- Check if user is a super user
    SELECT is_super_user INTO is_superuser
    FROM public.profiles
    WHERE id = u_id;

    IF is_superuser THEN
        RETURN QUERY SELECT true, 999, 'unlimited'::TEXT, true;
        RETURN;
    END IF;

    -- Get active subscription
    SELECT * INTO active_subscription
    FROM public.subscriptions
    WHERE user_id = u_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW());

    IF active_subscription.id IS NULL THEN
        -- Check for free trial (first letter)
        DECLARE
            letter_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO letter_count
            FROM public.letters
            WHERE user_id = u_id;

            IF letter_count = 0 THEN
                RETURN QUERY SELECT true, 1, 'free_trial'::TEXT, false;
            ELSE
                RETURN QUERY SELECT false, 0, NULL::TEXT, false;
            END IF;
            RETURN;
        END;
    END IF;

    -- FIXED: Use remaining_letters instead of credits_remaining
    remaining_count := COALESCE(active_subscription.remaining_letters, 0);

    RETURN QUERY SELECT
        remaining_count > 0,
        remaining_count,
        active_subscription.plan_type::TEXT,
        false;
END;
$$;
