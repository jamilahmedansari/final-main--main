-- Fraud Detection System Tables
-- These tables support the comprehensive fraud detection system

-- Fraud detection logs table
CREATE TABLE IF NOT EXISTS fraud_detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code TEXT NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  action TEXT NOT NULL CHECK (action IN ('allow', 'flag', 'block')),
  reasons TEXT[] DEFAULT '{}',
  patterns JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for performance
  INDEX idx_fraud_logs_coupon_code (coupon_code),
  INDEX idx_fraud_logs_ip_address (ip_address),
  INDEX idx_fraud_logs_user_id (user_id),
  INDEX idx_fraud_logs_risk_score (risk_score),
  INDEX idx_fraud_logs_action (action),
  INDEX idx_fraud_logs_created_at (created_at)
);

-- Enhanced coupon_usage table to include IP and user agent
-- Add these columns if they don't exist
DO $$
BEGIN
  -- Check if column exists before adding
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coupon_usage' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE coupon_usage ADD COLUMN ip_address INET;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coupon_usage' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE coupon_usage ADD COLUMN user_agent TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coupon_usage' AND column_name = 'fingerprint'
  ) THEN
    ALTER TABLE coupon_usage ADD COLUMN fingerprint TEXT;
  END IF;
END $$;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_coupon_usage_ip_address ON coupon_usage(ip_address);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_agent ON coupon_usage(user_agent);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_fingerprint ON coupon_usage(fingerprint);

-- Suspicious activity patterns table for tracking known fraud patterns
CREATE TABLE IF NOT EXISTS suspicious_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('velocity', 'distribution', 'timing', 'behavior', 'technical')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  evidence JSONB,
  threshold_value DECIMAL,
  actual_value DECIMAL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_suspicious_patterns_type (pattern_type),
  INDEX idx_suspicious_patterns_severity (severity),
  INDEX idx_suspicious_patterns_active (is_active)
);

-- Fraud detection configuration table
CREATE TABLE IF NOT EXISTS fraud_detection_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default fraud detection configuration
INSERT INTO fraud_detection_config (config_key, config_value, description) VALUES
('max_requests_per_ip_per_hour', '10', 'Maximum coupon validation requests per IP per hour'),
('max_requests_per_ip_per_day', '50', 'Maximum coupon validation requests per IP per day'),
('min_time_between_requests_ms', '5000', 'Minimum time between requests from same IP'),
('max_user_agents_per_ip_per_hour', '3', 'Maximum unique user agents per IP per hour'),
('high_risk_threshold', '75', 'Risk score threshold for blocking requests'),
('medium_risk_threshold', '50', 'Risk score threshold for flagging requests'),
('auto_deactivate_high_risk_coupons', 'true', 'Automatically deactivate coupons with very high risk scores')
ON CONFLICT (config_key) DO NOTHING;

-- Row Level Security for fraud detection logs
ALTER TABLE fraud_detection_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fraud_detection_logs
-- Admins can view all fraud detection logs
CREATE POLICY "Admins can view all fraud logs" ON fraud_detection_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert fraud detection logs
CREATE POLICY "Admins can insert fraud logs" ON fraud_detection_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Service role can manage fraud logs (for background processes)
CREATE POLICY "Service role full access to fraud logs" ON fraud_detection_logs
  FOR ALL USING (
    auth.role() = 'service_role'
  );

-- Function to clean up old fraud detection logs
CREATE OR REPLACE FUNCTION cleanup_old_fraud_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM fraud_detection_logs
  WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get fraud statistics
CREATE OR REPLACE FUNCTION get_fraud_statistics(
  time_range_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_checks BIGINT,
  blocked_requests BIGINT,
  flagged_requests BIGINT,
  allowed_requests BIGINT,
  avg_risk_score DECIMAL,
  high_risk_count BIGINT,
  medium_risk_count BIGINT,
  low_risk_count BIGINT,
  unique_coupons BIGINT,
  unique_ips BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_checks,
    COUNT(*) FILTER (WHERE action = 'block') as blocked_requests,
    COUNT(*) FILTER (WHERE action = 'flag') as flagged_requests,
    COUNT(*) FILTER (WHERE action = 'allow') as allowed_requests,
    ROUND(AVG(risk_score), 2) as avg_risk_score,
    COUNT(*) FILTER (WHERE risk_score >= 75) as high_risk_count,
    COUNT(*) FILTER (WHERE risk_score >= 50 AND risk_score < 75) as medium_risk_count,
    COUNT(*) FILTER (WHERE risk_score >= 25 AND risk_score < 50) as low_risk_count,
    COUNT(DISTINCT coupon_code) as unique_coupons,
    COUNT(DISTINCT ip_address) as unique_ips
  FROM fraud_detection_logs
  WHERE created_at >= NOW() - INTERVAL '1 hour' * time_range_hours;
END;
$$ LANGUAGE plpgsql;

-- Function to get top suspicious IPs
CREATE OR REPLACE FUNCTION get_top_suspicious_ips(
  limit_count INTEGER DEFAULT 10,
  time_range_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  ip_address INET,
  request_count BIGINT,
  avg_risk_score DECIMAL,
  blocked_count BIGINT,
  flagged_count BIGINT,
  unique_coupons BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fl.ip_address,
    COUNT(*) as request_count,
    ROUND(AVG(fl.risk_score), 2) as avg_risk_score,
    COUNT(*) FILTER (WHERE fl.action = 'block') as blocked_count,
    COUNT(*) FILTER (WHERE fl.action = 'flag') as flagged_count,
    COUNT(DISTINCT fl.coupon_code) as unique_coupons
  FROM fraud_detection_logs fl
  WHERE fl.created_at >= NOW() - INTERVAL '1 hour' * time_range_hours
  GROUP BY fl.ip_address
  ORDER BY blocked_count DESC, avg_risk_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get coupon fraud risk trends
CREATE OR REPLACE FUNCTION get_coupon_fraud_trends(
  coupon_code TEXT,
  time_range_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  hour_bucket TIMESTAMPTZ,
  request_count BIGINT,
  avg_risk_score DECIMAL,
  blocked_count BIGINT,
  flagged_count BIGINT,
  unique_ips BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc('hour', fl.created_at) as hour_bucket,
    COUNT(*) as request_count,
    ROUND(AVG(fl.risk_score), 2) as avg_risk_score,
    COUNT(*) FILTER (WHERE fl.action = 'block') as blocked_count,
    COUNT(*) FILTER (WHERE fl.action = 'flag') as flagged_count,
    COUNT(DISTINCT fl.ip_address) as unique_ips
  FROM fraud_detection_logs fl
  WHERE fl.coupon_code = coupon_code
    AND fl.created_at >= NOW() - INTERVAL '1 hour' * time_range_hours
  GROUP BY date_trunc('hour', fl.created_at)
  ORDER BY hour_bucket DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at in fraud_detection_config
CREATE OR REPLACE FUNCTION update_fraud_detection_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fraud_detection_config_updated_at
  BEFORE UPDATE ON fraud_detection_config
  FOR EACH ROW
  EXECUTE FUNCTION update_fraud_detection_config_updated_at();

-- Create a trigger to automatically update updated_at in suspicious_patterns
CREATE OR REPLACE FUNCTION update_suspicious_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_suspicious_patterns_updated_at
  BEFORE UPDATE ON suspicious_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_suspicious_patterns_updated_at();