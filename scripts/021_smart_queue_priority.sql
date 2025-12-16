-- Smart Queue Priority System
-- Created: 2025-12-16
-- Purpose: Intelligent letter review queue with priority scoring

-- Function to calculate priority score for a letter
CREATE OR REPLACE FUNCTION calculate_letter_priority(p_letter_id UUID)
RETURNS INTEGER AS $$
DECLARE
  priority_score INTEGER := 0;
  v_user_id UUID;
  v_created_at TIMESTAMP;
  v_plan_name TEXT;
  v_content_length INTEGER;
  v_wait_hours NUMERIC;
  v_letter_count INTEGER;
  v_is_super_user BOOLEAN;
BEGIN
  -- Get letter details
  SELECT
    l.user_id,
    l.created_at,
    LENGTH(COALESCE(l.content, '')) as content_length,
    EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 3600 as hours_waiting
  INTO
    v_user_id,
    v_created_at,
    v_content_length,
    v_wait_hours
  FROM letters l
  WHERE l.id = p_letter_id;

  -- Get user details
  SELECT
    COALESCE(s.plan_name, 'Free Trial') as plan_name,
    p.is_super_user
  INTO
    v_plan_name,
    v_is_super_user
  FROM profiles p
  LEFT JOIN subscriptions s ON s.user_id = p.id AND s.status = 'active'
  WHERE p.id = v_user_id;

  -- Count completed letters for this user
  SELECT COUNT(*) INTO v_letter_count
  FROM letters
  WHERE user_id = v_user_id
    AND status = 'completed';

  -- BASE SCORE: Plan tier
  priority_score := CASE v_plan_name
    WHEN 'Pro Plan' THEN 100
    WHEN 'Basic Plan' THEN 50
    ELSE 0  -- Free trial
  END;

  -- BONUS: Super user gets priority
  IF v_is_super_user THEN
    priority_score := priority_score + 150;
  END IF;

  -- TIME BONUS: +10 points per hour waiting (max +240 for 24 hours)
  priority_score := priority_score + LEAST(FLOOR(v_wait_hours * 10), 240);

  -- FIRST-TIME USER BONUS: +30 points (acquisition priority)
  IF v_letter_count = 0 THEN
    priority_score := priority_score + 30;
  END IF;

  -- COMPLEXITY PENALTY: Longer letters = slight deprioritization (fair distribution)
  -- Subtract 1 point per 1000 characters (max -10)
  priority_score := priority_score - LEAST(FLOOR(v_content_length / 1000), 10);

  RETURN priority_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- View for admin review queue (sorted by priority)
CREATE OR REPLACE VIEW admin_review_queue AS
SELECT
  l.id,
  l.user_id,
  l.letter_type,
  l.status,
  l.created_at,
  l.updated_at,
  calculate_letter_priority(l.id) as priority_score,
  ROUND(EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 3600, 1) as wait_hours,
  COALESCE(s.plan_name, 'Free Trial') as user_plan,
  p.is_super_user,
  p.email as user_email,
  (SELECT COUNT(*) FROM letters WHERE user_id = l.user_id AND status = 'completed') as user_letter_count
FROM letters l
LEFT JOIN profiles p ON p.id = l.user_id
LEFT JOIN subscriptions s ON s.user_id = l.user_id AND s.status = 'active'
WHERE l.status IN ('pending_review', 'under_review')
ORDER BY calculate_letter_priority(l.id) DESC, l.created_at ASC;

-- Grant access to authenticated users (admins will see via RLS)
GRANT SELECT ON admin_review_queue TO authenticated;

-- Function to get next letter for review (picks highest priority)
CREATE OR REPLACE FUNCTION get_next_letter_for_review()
RETURNS TABLE (
  letter_id UUID,
  priority_score INTEGER,
  wait_hours NUMERIC,
  user_plan TEXT,
  is_first_letter BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    arq.id as letter_id,
    arq.priority_score,
    arq.wait_hours,
    arq.user_plan,
    (arq.user_letter_count = 0) as is_first_letter
  FROM admin_review_queue arq
  WHERE arq.status = 'pending_review'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION calculate_letter_priority IS 'Calculates priority score based on plan tier, wait time, user type, and complexity';
COMMENT ON VIEW admin_review_queue IS 'Admin dashboard view showing letters sorted by priority';
COMMENT ON FUNCTION get_next_letter_for_review IS 'Returns the highest priority letter awaiting review';

-- Create index for the priority calculation
CREATE INDEX IF NOT EXISTS idx_letters_review_priority
ON letters(status, created_at DESC)
WHERE status IN ('pending_review', 'under_review');
