# Deployment Guide

This guide covers deploying Talk-To-My-Lawyer to various environments.

## Prerequisites

- Node.js 18+ or 22+
- pnpm (recommended) or npm
- Supabase project with database configured
- OpenAI API key
- Stripe account (for production payments)
- Email service account (SendGrid, Resend, or SMTP)
- Redis instance (optional, for rate limiting)

## Environment Configuration

Copy `.env.example` to `.env.local` and configure all required variables:

```bash
cp .env.example .env.local
```

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=sk-your_openai_key

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Production Variables

```bash
# Stripe (required for production)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin Portal
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PORTAL_KEY=your_secure_random_key

# Cron Jobs
CRON_SECRET=your_cron_secret

# Email
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@your-domain.com
SENDGRID_API_KEY=SG.your_key

# Rate Limiting (optional but recommended)
KV_REST_API_URL=https://your-redis.upstash.io
KV_REST_API_TOKEN=your_token
```

## Deployment Options

### Option 1: Docker Deployment

Build and run using Docker:

```bash
# Build the image
docker build -t talk-to-my-lawyer .

# Run with environment file
docker run -p 3000:3000 --env-file .env.local talk-to-my-lawyer
```

Using Docker Compose (includes Redis):

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop services
docker compose down
```

### Option 2: Node.js Standalone

Build and run directly:

```bash
# Install dependencies
pnpm install

# Build the application
pnpm build

# Start production server
pnpm start:prod

# Or with custom port
PORT=8080 pnpm start:prod
```

### Option 3: Platform Deployment

**Vercel:**
```bash
vercel
```

**Railway:**
```bash
railway up
```

**Render:**
- Connect repository
- Set build command: `pnpm build`
- Set start command: `pnpm start:prod`

**Fly.io:**
```bash
fly launch
fly deploy
```

## Database Setup

### Run Migrations

Migrations are located in `supabase/migrations/`. Apply them in order:

1. Go to Supabase Dashboard > SQL Editor
2. Run each migration file in sequence
3. Or use the Supabase CLI:

```bash
supabase db push
```

### Create Admin User

After migrations, create the admin user:

```sql
-- In Supabase SQL Editor
INSERT INTO auth.users (id, email, encrypted_password, ...)
-- Then update profiles table
UPDATE profiles SET role = 'admin', is_super_user = true WHERE email = 'admin@your-domain.com';
```

## Health Checks

The application includes a health check endpoint:

```bash
# Check application health
curl http://localhost:3000/api/health

# Response includes:
# - Overall status (healthy/degraded/unhealthy)
# - Service statuses (database, auth, stripe, openai, redis)
# - Uptime and version information
```

## Environment Validation

Validate your environment configuration:

```bash
# Run validation script
pnpm validate-env

# This checks:
# - All required variables are set
# - Format validation for keys
# - Warnings for optional missing variables
```

## Monitoring

### Logs

The application uses structured logging:

```bash
# Set log level (debug, info, warn, error)
LOG_LEVEL=info

# Enable JSON format for log aggregation
LOG_FORMAT=json
```

### Metrics

Health endpoint provides basic metrics:
- Service latencies
- Uptime
- Error counts

For advanced monitoring, integrate with:
- Sentry (error tracking)
- Datadog/New Relic (APM)
- Prometheus/Grafana (metrics)

## Cron Jobs

Set up cron jobs for:

### Monthly Subscription Reset
```bash
# Every 1st of month at midnight UTC
0 0 1 * * curl -X POST https://your-domain.com/api/subscriptions/reset-monthly \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Cleanup Failed Letters
```bash
# Weekly cleanup of old failed letters
0 0 * * 0 curl -X POST https://your-domain.com/api/admin/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Security Checklist

Before going live:

- [ ] All environment variables are set correctly
- [ ] Test mode is disabled (`ENABLE_TEST_MODE=false`)
- [ ] Admin portal key is strong and unique
- [ ] Stripe webhook is configured and verified
- [ ] Email service is configured and tested
- [ ] Rate limiting is enabled
- [ ] CORS origins are restricted
- [ ] CSP headers are appropriate
- [ ] Database RLS policies are enabled
- [ ] Admin user is created with strong password

## Troubleshooting

### Database Connection Issues
```bash
# Check Supabase connection
curl https://your-project.supabase.co/rest/v1/ \
  -H "apikey: your_anon_key"
```

### Email Not Sending
```bash
# Verify email configuration
LOG_LEVEL=debug pnpm dev
# Check console for email provider logs
```

### Rate Limiting Not Working
- Verify Redis connection
- Check KV_REST_API_URL and token
- Falls back gracefully if Redis unavailable

## Scaling

For high traffic:

1. **Database**: Enable connection pooling in Supabase
2. **CDN**: Use Vercel/Cloudflare for static assets
3. **Redis**: Use Upstash or dedicated Redis cluster
4. **Horizontal**: Deploy multiple instances with load balancer

## Support

For deployment issues:
- Check logs: `LOG_LEVEL=debug`
- Run health check: `/api/health`
- Validate environment: `pnpm validate-env`
