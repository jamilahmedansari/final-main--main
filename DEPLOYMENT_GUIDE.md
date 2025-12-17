# Deployment Guide - Talk-To-My-Lawyer

This guide provides comprehensive instructions for deploying the Talk-To-My-Lawyer platform to various hosting providers in a production-ready manner.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Railway Deployment](#railway-deployment)
5. [Render Deployment](#render-deployment)
6. [Fly.io Deployment](#flyio-deployment)
7. [Health Checks & Monitoring](#health-checks--monitoring)
8. [Scaling & Performance](#scaling--performance)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ or Docker
- Supabase account and project
- Stripe account (for payments)
- SendGrid account (or alternative email provider)
- Git repository access

## Environment Configuration

### Required Environment Variables

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://yourdomain.com

# Email Service
SENDGRID_API_KEY=your-sendgrid-key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_PROVIDER=sendgrid

# Stripe
STRIPE_SECRET_KEY=your-stripe-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable
STRIPE_WEBHOOK_SECRET=your-webhook-secret

# Application
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Optional Environment Variables

```bash
# Alternative Email Providers
BREVO_API_KEY=your-brevo-key
RESEND_API_KEY=your-resend-key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASSWORD=your-password

# Monitoring & Logging
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn

# Rate Limiting
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

## Docker Deployment

### Building the Docker Image

```bash
# Build the image
docker build -t talk-to-my-lawyer:latest .

# Test locally
docker run -p 3000:3000 \
  --env-file .env.production \
  talk-to-my-lawyer:latest
```

### Using Docker Compose (Local Development)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Production Docker Deployment

```bash
# Push to registry
docker tag talk-to-my-lawyer:latest your-registry/talk-to-my-lawyer:latest
docker push your-registry/talk-to-my-lawyer:latest

# Deploy with docker run
docker run -d \
  --name talk-to-my-lawyer \
  --restart always \
  -p 3000:3000 \
  --env-file .env.production \
  -e NODE_ENV=production \
  your-registry/talk-to-my-lawyer:latest
```

### Health Check Configuration

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Railway Deployment

### Setup Steps

1. **Connect Repository**
   - Go to railway.app
   - Create new project
   - Connect your GitHub repository

2. **Configure Environment**
   - Add all required environment variables in Railway dashboard
   - Set `NODE_ENV=production`

3. **Configure Build**
   - Railway auto-detects Next.js
   - Ensure `package.json` has correct build scripts

4. **Deploy**
   - Push to main branch
   - Railway automatically builds and deploys

### Railway Configuration File

Create `railway.json`:

```json
{
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "startCommand": "npm run start:prod",
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 5
  }
}
```

## Render Deployment

### Setup Steps

1. **Create Web Service**
   - Go to render.com
   - New → Web Service
   - Connect GitHub repository

2. **Configure Service**
   - Environment: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
   - Instance Type: Standard (minimum)

3. **Add Environment Variables**
   - Add all required variables in Environment tab
   - Set `NODE_ENV=production`

4. **Configure Health Check**
   - Health Check Path: `/api/health`
   - Health Check Protocol: HTTP

### Render Configuration File

Create `render.yaml`:

```yaml
services:
  - type: web
    name: talk-to-my-lawyer
    env: node
    plan: standard
    buildCommand: npm install && npm run build
    startCommand: npm run start:prod
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
```

## Fly.io Deployment

### Setup Steps

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Authenticate**
   ```bash
   flyctl auth login
   ```

3. **Create App**
   ```bash
   flyctl launch
   ```

4. **Configure Secrets**
   ```bash
   flyctl secrets set SENDGRID_API_KEY=xxx
   flyctl secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
   # Add all other secrets
   ```

5. **Deploy**
   ```bash
   flyctl deploy
   ```

### Fly.io Configuration File

Create `fly.toml`:

```toml
app = "talk-to-my-lawyer"
primary_region = "sjc"

[build]
  image = "talk-to-my-lawyer:latest"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 3000
  ports = [{ handlers = ["http"], port = 80 }, { handlers = ["tls", "http"], port = 443 }]

  [services.concurrency]
    type = "connections"
    hard_limit = 1000
    soft_limit = 800

[checks]
  [checks.status]
    grace_period = "30s"
    interval = "30s"
    method = "GET"
    path = "/api/health"
    protocol = "http"
    timeout = "10s"
    type = "http"
```

## Health Checks & Monitoring

### Basic Health Check

```bash
# Check application health
curl https://yourdomain.com/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-01-17T10:00:00Z",
  "checks": {
    "database": true,
    "email": true,
    "storage": true,
    "auth": true
  }
}
```

### Detailed Health Check

```bash
curl https://yourdomain.com/api/health/detailed

# Returns detailed service status including response times
```

### Monitoring Setup

1. **Uptime Monitoring**
   - Use UptimeRobot or similar service
   - Monitor `/api/health` endpoint
   - Set alerts for downtime

2. **Error Tracking**
   - Integrate Sentry for error tracking
   - Set `SENTRY_DSN` environment variable

3. **Performance Monitoring**
   - Use Vercel Analytics or similar
   - Monitor response times and error rates

## Scaling & Performance

### Horizontal Scaling

1. **Load Balancing**
   - Use platform's built-in load balancing
   - Configure sticky sessions if needed

2. **Database Connection Pooling**
   - Use Supabase connection pooling
   - Configure in Supabase dashboard

3. **Caching Strategy**
   - Implement Redis caching for frequently accessed data
   - Use Upstash Redis for serverless deployments

### Vertical Scaling

1. **Increase Instance Size**
   - Monitor CPU and memory usage
   - Scale up instance type as needed

2. **Optimize Database Queries**
   - Review slow query logs
   - Add indexes for frequently queried columns

3. **Enable Compression**
   - Gzip compression for responses
   - Minify JavaScript and CSS

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker logs talk-to-my-lawyer

# Validate environment variables
npm run validate-env

# Check database connectivity
curl https://yourdomain.com/api/health
```

### High Memory Usage

```bash
# Check Node process
ps aux | grep node

# Increase memory limit
NODE_OPTIONS=--max-old-space-size=2048 npm start
```

### Email Service Issues

```bash
# Verify email configuration
curl -X POST https://yourdomain.com/api/admin/email-queue

# Check email queue status
curl https://yourdomain.com/api/admin/email-queue
```

### Database Connection Issues

```bash
# Verify connection string
echo $NEXT_PUBLIC_SUPABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Rate Limiting Issues

```bash
# Check Redis connection
redis-cli ping

# Clear rate limit cache
redis-cli FLUSHDB
```

## Maintenance Tasks

### Regular Backups

```bash
# Supabase automatic backups
# Enable in Supabase dashboard under Database → Backups

# Manual backup
pg_dump $DATABASE_URL > backup.sql
```

### Database Cleanup

```bash
# Clean up old email queue entries
psql $DATABASE_URL -c "SELECT cleanup_old_email_queue();"

# Clean up old audit logs
psql $DATABASE_URL -c "SELECT cleanup_old_audit_logs();"
```

### Log Rotation

```bash
# Configure log rotation in your deployment platform
# Most platforms handle this automatically
```

## Security Considerations

1. **HTTPS Only**
   - Enforce HTTPS in all deployments
   - Use strong SSL certificates

2. **Environment Variables**
   - Never commit secrets to repository
   - Use platform's secret management

3. **Database Security**
   - Enable SSL connections
   - Use strong passwords
   - Restrict IP access if possible

4. **API Security**
   - Implement rate limiting
   - Use CORS policies
   - Validate all inputs

5. **Monitoring**
   - Monitor for suspicious activity
   - Set up alerts for errors
   - Review logs regularly

## Support & Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Railway Documentation](https://docs.railway.app)
- [Render Documentation](https://render.com/docs)
- [Fly.io Documentation](https://fly.io/docs)
