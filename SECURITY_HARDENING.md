# Security Hardening Guide - Talk-To-My-Lawyer

This guide outlines security best practices and hardening measures for the Talk-To-My-Lawyer platform.

## Table of Contents

1. [Input Validation & Sanitization](#input-validation--sanitization)
2. [Authentication & Authorization](#authentication--authorization)
3. [API Security](#api-security)
4. [Database Security](#database-security)
5. [Infrastructure Security](#infrastructure-security)
6. [Monitoring & Incident Response](#monitoring--incident-response)
7. [Compliance & Privacy](#compliance--privacy)

## Input Validation & Sanitization

### Implementation

The application includes comprehensive input sanitization utilities in `lib/security/input-sanitizer.ts`:

```typescript
import {
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeHtml,
  validateInput
} from '@/lib/security/input-sanitizer'

// Sanitize user input
const cleanEmail = sanitizeEmail(userInput.email)
const cleanName = sanitizeString(userInput.name, 100)

// Validate form data
const { valid, errors, data } = validateInput(formData, {
  email: { type: 'email', required: true },
  name: { type: 'string', required: true, maxLength: 100 },
  message: { type: 'string', maxLength: 5000 }
})
```

### Best Practices

1. **Always Validate Input**
   - Check type, length, and format
   - Reject invalid data early
   - Use whitelist approach when possible

2. **Sanitize Output**
   - Escape HTML special characters
   - Remove dangerous protocols
   - Validate URLs before rendering

3. **Content Security Policy**
   ```typescript
   // Add to next.config.mjs
   headers: async () => [
     {
       key: 'Content-Security-Policy',
       value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
     }
   ]
   ```

## Authentication & Authorization

### Session Management

1. **Secure Session Configuration**
   ```typescript
   // Use secure session cookies
   const sessionOptions = {
     httpOnly: true,
     secure: process.env.NODE_ENV === 'production',
     sameSite: 'lax',
     maxAge: 24 * 60 * 60 // 24 hours
   }
   ```

2. **Multi-Factor Authentication**
   - Implement 2FA for admin accounts
   - Use TOTP (Time-based One-Time Password)
   - Store backup codes securely

3. **Password Policy**
   - Minimum 12 characters
   - Require mixed case and numbers
   - Enforce regular password changes
   - Implement password history

### Role-Based Access Control

```typescript
// Check user role in API routes
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single()

if (profile?.role !== 'admin') {
  throw new AuthorizationError('Admin access required')
}
```

## API Security

### Rate Limiting

```typescript
import { createRateLimit } from '@/lib/rate-limit'

const rateLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests'
})

// Apply to routes
const rateLimitResult = await rateLimiter(request)
if (rateLimitResult instanceof Response) {
  return rateLimitResult
}
```

### CORS Configuration

```typescript
// next.config.mjs
headers: async () => [
  {
    key: 'Access-Control-Allow-Origin',
    value: process.env.NEXT_PUBLIC_APP_URL || '*'
  },
  {
    key: 'Access-Control-Allow-Methods',
    value: 'GET, POST, PUT, DELETE, OPTIONS'
  },
  {
    key: 'Access-Control-Allow-Headers',
    value: 'Content-Type, Authorization'
  }
]
```

### API Key Management

1. **Generate Secure Keys**
   ```typescript
   import crypto from 'crypto'
   
   const apiKey = crypto.randomBytes(32).toString('hex')
   ```

2. **Key Rotation**
   - Rotate keys every 90 days
   - Maintain multiple active keys during rotation
   - Revoke old keys after transition period

3. **Key Storage**
   - Store hashed keys in database
   - Never log or expose keys
   - Use environment variables for secrets

## Database Security

### Connection Security

1. **SSL/TLS Encryption**
   ```typescript
   const connectionString = `postgresql://user:password@host:5432/db?sslmode=require`
   ```

2. **Connection Pooling**
   - Use PgBouncer for connection pooling
   - Set appropriate pool size
   - Monitor connection usage

3. **IP Whitelisting**
   - Restrict database access to application servers
   - Use VPN for remote access
   - Monitor unauthorized connection attempts

### Data Protection

1. **Encryption at Rest**
   - Enable Supabase encryption
   - Encrypt sensitive fields (PII)
   - Use transparent data encryption (TDE)

2. **Encryption in Transit**
   - Use HTTPS for all communications
   - Enforce TLS 1.2+
   - Use strong cipher suites

3. **Field-Level Encryption**
   ```typescript
   // Encrypt sensitive data
   import crypto from 'crypto'
   
   function encryptField(data: string, key: string): string {
     const iv = crypto.randomBytes(16)
     const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv)
     let encrypted = cipher.update(data, 'utf8', 'hex')
     encrypted += cipher.final('hex')
     return iv.toString('hex') + ':' + encrypted
   }
   ```

### Query Security

1. **Parameterized Queries**
   ```typescript
   // Always use parameterized queries
   const { data } = await supabase
     .from('users')
     .select('*')
     .eq('email', userEmail) // Parameterized
   ```

2. **SQL Injection Prevention**
   - Never concatenate user input into queries
   - Use ORM/query builders
   - Validate and sanitize all inputs

3. **Query Auditing**
   - Log all database queries in production
   - Monitor for suspicious patterns
   - Alert on failed authentication attempts

## Infrastructure Security

### Network Security

1. **Firewall Configuration**
   - Allow only necessary ports (80, 443)
   - Restrict SSH access by IP
   - Use security groups/network ACLs

2. **DDoS Protection**
   - Use CDN with DDoS protection (Cloudflare)
   - Configure rate limiting
   - Monitor traffic patterns

3. **VPN & Tunneling**
   - Use VPN for admin access
   - Implement bastion hosts for database access
   - Use SSH tunneling for secure connections

### Container Security

1. **Image Scanning**
   - Scan Docker images for vulnerabilities
   - Use minimal base images (alpine)
   - Keep dependencies updated

2. **Runtime Security**
   ```dockerfile
   # Run as non-root user
   USER node
   
   # Use read-only filesystem where possible
   RUN chmod -R 755 /app
   ```

3. **Secrets Management**
   - Never hardcode secrets in images
   - Use environment variables
   - Use platform secret management

### Server Hardening

1. **OS Security**
   - Keep OS and packages updated
   - Disable unnecessary services
   - Configure firewall rules

2. **SSH Hardening**
   ```bash
   # Disable password authentication
   PasswordAuthentication no
   
   # Disable root login
   PermitRootLogin no
   
   # Use key-based authentication
   PubkeyAuthentication yes
   ```

3. **Monitoring & Logging**
   - Enable audit logging
   - Monitor system logs
   - Alert on suspicious activity

## Monitoring & Incident Response

### Security Monitoring

1. **Error Tracking**
   ```typescript
   import * as Sentry from "@sentry/nextjs"
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 0.1
   })
   ```

2. **Log Aggregation**
   - Centralize logs from all services
   - Use structured logging
   - Set up alerts for critical events

3. **Intrusion Detection**
   - Monitor for suspicious patterns
   - Track failed login attempts
   - Alert on unusual API activity

### Incident Response

1. **Incident Response Plan**
   - Document response procedures
   - Define escalation paths
   - Conduct regular drills

2. **Data Breach Response**
   - Immediately isolate affected systems
   - Preserve evidence
   - Notify affected users
   - Report to authorities if required

3. **Post-Incident Review**
   - Document what happened
   - Identify root causes
   - Implement preventive measures

## Compliance & Privacy

### Data Protection

1. **GDPR Compliance**
   - Implement data export functionality
   - Provide data deletion workflows
   - Maintain audit trails
   - Document data processing

2. **Privacy Policy**
   - Clearly document data collection
   - Explain data usage
   - Provide opt-out mechanisms
   - Regular policy reviews

3. **Consent Management**
   - Obtain explicit consent for data processing
   - Track consent preferences
   - Provide easy opt-out

### Regular Security Audits

1. **Vulnerability Scanning**
   ```bash
   # Scan dependencies for vulnerabilities
   npm audit
   
   # Use OWASP tools
   npm install -g retire
   retire
   ```

2. **Penetration Testing**
   - Conduct annual penetration tests
   - Test all critical functionality
   - Document findings and fixes

3. **Code Review**
   - Implement peer review process
   - Use automated code analysis
   - Review security-critical code

### Security Updates

1. **Dependency Management**
   - Keep all dependencies updated
   - Monitor for security advisories
   - Use automated update tools

2. **Patch Management**
   - Apply security patches promptly
   - Test patches before production
   - Maintain update schedule

3. **Version Control**
   - Use semantic versioning
   - Maintain changelog
   - Tag security releases

## Security Checklist

- [ ] All inputs are validated and sanitized
- [ ] HTTPS enforced on all endpoints
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Authentication required for sensitive operations
- [ ] Authorization checks in place
- [ ] Database connections encrypted
- [ ] Secrets stored in environment variables
- [ ] Error messages don't leak sensitive info
- [ ] Logging configured for security events
- [ ] Regular security audits scheduled
- [ ] Incident response plan documented
- [ ] Privacy policy updated
- [ ] GDPR compliance verified
- [ ] Dependencies regularly updated

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Supabase Security](https://supabase.com/docs/guides/auth/security)
