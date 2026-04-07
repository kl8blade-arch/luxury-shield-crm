-- CRITICAL INDEXES FOR SCALING TO 1000 CONCURRENT USERS
-- Run these in Supabase SQL Editor

-- Leads table optimizations
CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id) INCLUDE (stage, score, updated_at);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage) INCLUDE (agent_id, score);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON leads(updated_at DESC) INCLUDE (agent_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC) INCLUDE (agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id) WHERE account_id IS NOT NULL;

-- Conversations table optimizations
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id) INCLUDE (direction, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id) INCLUDE (created_at, direction);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- Agents table optimizations
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status) INCLUDE (subscription_plan, tokens_used, tokens_limit);
CREATE INDEX IF NOT EXISTS idx_agents_subscription ON agents(subscription_plan) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_agents_trial_ends ON agents(trial_ends_at) WHERE paid = false;

-- Rate limiting table
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_agent_window ON rate_limit_counters(agent_id, window_type, window_start);

-- Conversations table (Realtime optimizations)
CREATE INDEX IF NOT EXISTS idx_conversations_agent_lead ON conversations(agent_id, lead_id) INCLUDE (direction, created_at);

-- Token tracking
CREATE INDEX IF NOT EXISTS idx_token_counters_agent_day ON token_rate_limits(agent_id, window_start DESC) WHERE window_type = 'day';

-- FOR BETTER WRITE PERFORMANCE - BATCH OPERATIONS
-- Create table for batch conversation inserts (denormalized)
CREATE TABLE IF NOT EXISTS conversation_batch_staging (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  agent_id UUID,
  message TEXT,
  direction VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_conversation_batch_lead ON conversation_batch_staging(lead_id) WHERE processed = false;

-- PERFORMANCE MONITORING VIEWS
CREATE OR REPLACE VIEW v_leads_by_stage AS
  SELECT stage, COUNT(*) as count, COUNT(DISTINCT agent_id) as agents
  FROM leads
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY stage;

CREATE OR REPLACE VIEW v_agent_metrics AS
  SELECT
    a.id,
    a.name,
    COUNT(DISTINCT l.id) as total_leads,
    COUNT(DISTINCT CASE WHEN l.stage = 'closed_won' THEN l.id END) as closed_won,
    COUNT(DISTINCT CASE WHEN l.stage IN ('new', 'interested', 'qualified') THEN l.id END) as active_leads,
    a.tokens_used,
    a.tokens_limit,
    (a.tokens_limit - a.tokens_used) as tokens_remaining
  FROM agents a
  LEFT JOIN leads l ON a.id = l.agent_id AND l.created_at > NOW() - INTERVAL '30 days'
  WHERE a.status = 'active'
  GROUP BY a.id, a.name, a.tokens_used, a.tokens_limit;

-- VACUUM AND ANALYZE (optimize query planner)
-- Note: Run these periodically via scheduled jobs
-- VACUUM ANALYZE leads;
-- VACUUM ANALYZE conversations;
-- VACUUM ANALYZE agents;

-- CONNECTION POOLING RECOMMENDATIONS
-- Enable in Supabase Settings > Database > Connection Pooling
-- Mode: Transaction (recommended for high concurrency)
-- Timeout: 30s

-- REPLICATION SLOT MONITORING
-- Check for bloat: SELECT * FROM pg_stat_replication;

-- REALTIME SUBSCRIPTIONS OPTIMIZATION
-- Add these indexes for faster subscription filtering
CREATE INDEX IF NOT EXISTS idx_conversations_realtime ON conversations USING btree (lead_id, created_at DESC) WHERE created_at > NOW() - INTERVAL '1 day';

-- CACHE TABLE FOR AGENT STATS (materialized view)
CREATE TABLE IF NOT EXISTS agent_stats_cache (
  agent_id UUID PRIMARY KEY,
  total_leads INT,
  active_leads INT,
  closed_won INT,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_stats_updated ON agent_stats_cache(last_updated DESC);

-- FUNCTION TO REFRESH STATS (call via cron)
CREATE OR REPLACE FUNCTION refresh_agent_stats()
RETURNS void AS $$
BEGIN
  DELETE FROM agent_stats_cache WHERE last_updated < NOW() - INTERVAL '1 hour';

  INSERT INTO agent_stats_cache (agent_id, total_leads, active_leads, closed_won, last_updated)
  SELECT
    a.id,
    COUNT(DISTINCT l.id),
    COUNT(DISTINCT CASE WHEN l.stage IN ('new', 'interested', 'qualified') THEN l.id END),
    COUNT(DISTINCT CASE WHEN l.stage = 'closed_won' THEN l.id END),
    NOW()
  FROM agents a
  LEFT JOIN leads l ON a.id = l.agent_id
  WHERE a.status = 'active'
  GROUP BY a.id
  ON CONFLICT (agent_id) DO UPDATE SET
    total_leads = EXCLUDED.total_leads,
    active_leads = EXCLUDED.active_leads,
    closed_won = EXCLUDED.closed_won,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- TRIGGER FOR RATE COUNTER CLEANUP
CREATE OR REPLACE FUNCTION cleanup_old_rate_counters()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_counters
  WHERE window_start < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
