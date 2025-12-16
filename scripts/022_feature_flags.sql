-- Feature Flags System
-- Created: 2025-12-16
-- Purpose: Enable safe feature rollouts, A/B testing, and instant rollbacks

-- Feature flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  enabled_for_users UUID[] DEFAULT '{}',
  enabled_for_roles TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read flags (they control what they see)
CREATE POLICY "Anyone can read feature flags"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can modify flags
CREATE POLICY "Only admins can modify feature flags"
  ON feature_flags FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Function to check if feature is enabled for a user
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_flag_name TEXT,
  p_user_id UUID DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_feature RECORD;
  v_hash TEXT;
  v_bucket INTEGER;
BEGIN
  -- Get feature flag
  SELECT * INTO v_feature
  FROM feature_flags
  WHERE name = p_flag_name;

  -- If flag doesn't exist or is disabled, return false
  IF v_feature IS NULL OR v_feature.enabled = false THEN
    RETURN false;
  END IF;

  -- Check if user is explicitly enabled
  IF p_user_id IS NOT NULL AND p_user_id = ANY(v_feature.enabled_for_users) THEN
    RETURN true;
  END IF;

  -- Check if role is explicitly enabled
  IF p_user_role IS NOT NULL AND p_user_role = ANY(v_feature.enabled_for_roles) THEN
    RETURN true;
  END IF;

  -- Check percentage rollout (stable hash for consistent user experience)
  IF p_user_id IS NOT NULL AND v_feature.rollout_percentage > 0 THEN
    -- Create stable hash from flag name and user ID
    v_hash := encode(digest(p_flag_name || '-' || p_user_id::TEXT, 'md5'), 'hex');
    -- Convert first 2 hex chars to 0-99 bucket
    v_bucket := ('x' || substring(v_hash, 1, 2))::bit(8)::int % 100;

    IF v_bucket < v_feature.rollout_percentage THEN
      RETURN true;
    END IF;
  END IF;

  -- Full rollout check
  IF v_feature.rollout_percentage = 100 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Insert example feature flags
INSERT INTO feature_flags (name, description, enabled, rollout_percentage, metadata) VALUES
  ('smart_queue_priority', 'Use intelligent priority queue for letter reviews', true, 100, '{"implemented": "2025-12-16"}'),
  ('dynamic_pricing', 'Show dynamic pricing based on letter complexity', false, 0, '{"target_date": "2026-01-01", "requires_stripe_update": true}'),
  ('auto_save_forms', 'Auto-save letter form progress', false, 10, '{"test_group": "early_adopters"}'),
  ('new_dashboard_ui', 'Redesigned dashboard with analytics', false, 0, '{"design_ready": false}')
ON CONFLICT (name) DO NOTHING;

-- Function to increment rollout percentage safely
CREATE OR REPLACE FUNCTION increment_rollout(
  p_flag_name TEXT,
  p_increment INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
  v_new_percentage INTEGER;
BEGIN
  UPDATE feature_flags
  SET rollout_percentage = LEAST(rollout_percentage + p_increment, 100),
      updated_at = NOW()
  WHERE name = p_flag_name
  RETURNING rollout_percentage INTO v_new_percentage;

  RETURN v_new_percentage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(name) WHERE enabled = true;

-- Add helpful comments
COMMENT ON TABLE feature_flags IS 'Feature flag system for safe rollouts and A/B testing';
COMMENT ON FUNCTION is_feature_enabled IS 'Check if a feature flag is enabled for a specific user/role';
COMMENT ON FUNCTION increment_rollout IS 'Gradually increase rollout percentage (use for canary deploys)';

-- Grant permissions
GRANT SELECT ON feature_flags TO authenticated;
GRANT EXECUTE ON FUNCTION is_feature_enabled TO authenticated;
GRANT EXECUTE ON FUNCTION increment_rollout TO authenticated;
