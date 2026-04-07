# ✅ DEPLOYMENT CHECKLIST: PRODUCTION-READY 1000 USERS

## PRE-DEPLOYMENT VALIDATION

### 1. Code Quality
- [ ] `npm run lint` → 0 errors
- [ ] `npm run build` → successful
- [ ] All TypeScript types correct
- [ ] No console.log() left in production code
- [ ] API keys in .env, NOT in git

### 2. Database
- [ ] Run `supabase-optimization.sql` in Supabase
- [ ] Verify indexes created: `\di leads` in SQL editor
- [ ] Connection pooling enabled (Transaction mode)
- [ ] RLS policies reviewed and correct
- [ ] Backups configured (daily)

### 3. Environment Variables (Vercel)
**REQUIRED:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` → correct
- [ ] `SUPABASE_SERVICE_ROLE_KEY` → correct (NOT public)
- [ ] `TWILIO_ACCOUNT_SID` → set
- [ ] `TWILIO_AUTH_TOKEN` → set
- [ ] `TWILIO_WHATSAPP_FROM` → set
- [ ] `ADMIN_WHATSAPP` → set
- [ ] `CRON_SECRET` → random long string
- [ ] `STRIPE_API_KEY` → correct
- [ ] `STRIPE_WEBHOOK_SECRET` → correct

**OPTIONAL BUT RECOMMENDED:**
- [ ] `SENTRY_DSN` → error tracking (optional)
- [ ] `DATADOG_API_KEY` → monitoring (optional)

### 4. Performance Verification
```bash
# Install k6 if needed
npm install -g k6

# Run load test
k6 run load-test.js --vus 100 --duration 2m

# Check thresholds:
# - p(95) latency < 500ms ✓
# - error rate < 0.1% ✓
# - success rate > 99.9% ✓
```

### 5. Security Audit
- [ ] CORS properly configured
- [ ] API rate limiting enforced
- [ ] No sensitive data in logs
- [ ] HTTPS enforced (Vercel default)
- [ ] CSRF protection enabled
- [ ] SQL injection protections verified
- [ ] XSS protections in place

---

## DEPLOYMENT STEPS

### Step 1: Database Optimization
```bash
# 1. Open Supabase Dashboard
# 2. Go to SQL Editor
# 3. Copy all from supabase-optimization.sql
# 4. Run the script
# 5. Verify: SELECT * FROM pg_stat_user_indexes;
```

### Step 2: Deploy to Vercel
```bash
# Option A: Via GitHub push
git add .
git commit -m "feat: optimization for 1000 concurrent users

- Implement rate limit caching (5min TTL)
- Add leads API pagination (100 items/page)
- Add price calculation safety guards
- Add Supabase query indexes"
git push origin main

# Option B: Manual deploy
vercel --prod

# Wait for deployment (usually 3-5 minutes)
```

### Step 3: Environment Variables Setup
```bash
# Option A: Via CLI
vercel env add CRON_SECRET
vercel env add MAX_CONNECTIONS
# ... etc

# Option B: Via Dashboard
# 1. Go to vercel.com → Project → Settings
# 2. Environment Variables
# 3. Add all required vars
# 4. Redeploy
```

### Step 4: Verify Deployment
```bash
# Check deployment status
vercel deployments --prod

# Test health endpoint
curl https://luxury-shield-crm.vercel.app/api/business-health

# Should return: {"score": X, "metrics": {...}}
```

### Step 5: Smoke Test (Manual)
1. Open https://luxury-shield-crm.vercel.app
2. Log in with test account
3. Create a lead manually
4. Check that lead appears in list (pagination should work)
5. Open analytics → verify metrics load
6. Try coach chat → verify responses fast

### Step 6: Monitor First Hour
- [ ] Check Vercel Analytics for errors
- [ ] Check Supabase query performance
- [ ] Check API response times
- [ ] Look for any 500 errors in logs
- [ ] Verify Realtime connections working

---

## ROLLBACK PROCEDURE (IF SOMETHING BREAKS)

### Option 1: Quick Rollback (< 1 min)
```bash
# Find previous deployment
vercel deployments --prod

# Promote previous build
vercel rollback --prod

# OR revert code
git revert HEAD
git push origin main
```

### Option 2: Database Rollback (if optimization broke)
```sql
-- In Supabase SQL:
DROP INDEX IF EXISTS idx_leads_agent_id;
DROP INDEX IF EXISTS idx_leads_stage;
DROP INDEX IF EXISTS idx_leads_updated_at;
-- ... etc (drop all new indexes)
```

### Option 3: Disable rate limit caching
Edit `src/lib/rate-limiter.ts`, comment out caching lines and redeploy

---

## POST-DEPLOYMENT MONITORING

### Daily Checks (First Week)
- [ ] Error rate < 0.1%
- [ ] P95 latency < 500ms
- [ ] No spike in database connections
- [ ] Agent feedback: any performance complaints?

### Weekly Checks
- [ ] Review slow query logs
- [ ] Check index usage: `SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC`
- [ ] Monitor Supabase database size growth
- [ ] Review Vercel Function duration patterns

### Monthly Optimization Review
- [ ] Analyze query patterns
- [ ] Consider adding more indexes if needed
- [ ] Review rate limit configuration
- [ ] Validate caching effectiveness

---

## METRICS TO TRACK

### API Performance
```sql
-- Query in Vercel Postgres
SELECT method, path, AVG(duration_ms) as avg_ms, P95(duration_ms) as p95_ms
FROM api_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY method, path
ORDER BY avg_ms DESC;
```

### Database Health
```sql
SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';
SELECT count(*) as idle_transactions FROM pg_stat_activity WHERE state = 'idle in transaction';
```

### Rate Limiter Effectiveness
- % of requests served from cache (target: > 80%)
- Average cache lookup time (target: < 5ms)

---

## SCALING BEYOND 1000 USERS

When you reach capacity, next steps:

1. **500-2000 users**: Upgrade Supabase to Pro ($25/month)
2. **2000+ users**: 
   - Enable Supabase read replicas
   - Use Vercel KV for caching
   - Implement queue (Bull.js)
   - Consider Multi-region deployment

---

## TESTING SCENARIOS

### Test 1: High Conversation Volume (500 msgs/sec)
```bash
k6 run load-test.js --vus 500 --duration 60s --stage 0:10s:1000:50s:0
```
**Expected**: < 2% error rate, p95 < 1000ms

### Test 2: Spike Load (1000 users in 10sec)
```bash
k6 run load-test.js --vus 1000 --duration 120s --stage 0:10s:1000:60s:0:10s:0
```
**Expected**: Auto-scales without timeouts

### Test 3: Read-Heavy (Analytics load)
```bash
# Heavy reads from analytics endpoint
k6 run --script analytics-load-test.js --vus 200 --duration 5m
```
**Expected**: < 150ms response time even under load

---

## CONTACT INFO FOR EMERGENCIES

**Vercel Support**: https://vercel.com/support
**Supabase Support**: https://supabase.com/support
**Twilio Support**: https://support.twilio.com

**Status Pages**:
- Vercel: https://status.vercel.com
- Supabase: https://status.supabase.com
- Twilio: https://status.twilio.com

---

## SIGN-OFF

- [ ] All checks completed
- [ ] Load tests passed
- [ ] Database optimized
- [ ] Monitoring set up
- [ ] Team trained on rollback
- [ ] Ready for production

**Deployed by**: _______________  
**Date**: _______________  
**Approved by**: _______________  
