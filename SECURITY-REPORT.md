# 🔒 SECURITY VULNERABILITIES REPORT

**Generated**: December 5, 2025
**Updated**: December 19, 2025
**Repository**: Talk-To-My-Lawyer
**Status**: Critical vulnerabilities **FIXED**

---

## Executive Summary

GitHub Dependabot identified **8 security vulnerabilities** in the project dependencies. The **2 CRITICAL** issues (Next.js RCE and React flight protocol vulnerabilities) have been **FIXED** by upgrading to Next.js 16.0.10.

### ✅ Actions Completed

1. ✅ **Upgraded Next.js from 16.0.3 → 16.0.10** (CRITICAL - RCE vulnerability FIXED)
2. 🔶 **Monitor @modelcontextprotocol/sdk** (HIGH - DNS rebinding, dev dependency only)
3. 🔶 **Monitor @vercel/node dependencies** (HIGH - ReDoS)

---

## Vulnerability Details

### ✅ FIXED: Next.js Remote Code Execution (RCE)

**CVE**: CVE-2025-66478
**CVSS Score**: 10.0 (Critical)
**Status**: ✅ **FIXED** - Upgraded to Next.js 16.0.10
**Advisory**: [GHSA-9qr9-h5gf-34mp](https://github.com/advisories/GHSA-9qr9-h5gf-34mp)

#### Impact (No longer applicable)
Remote Code Execution vulnerability in React flight protocol affecting Next.js 16.x using App Router. An attacker could execute arbitrary code on the server.

**CWE**: CWE-502 (Deserialization of Untrusted Data)
**Attack Vector**: Network (AV:N)
**Attack Complexity**: Low (AC:L)
**Privileges Required**: None (PR:N)
**User Interaction**: None (UI:N)

#### Resolution
- **Previous**: `next@16.0.3`
- **Current**: `next@16.0.10` ✅
- **Vulnerable Range**: `16.0.0-canary.0` to `16.0.6`

#### Fix Applied
```bash
pnpm update next@16.0.10
```

**Fixed Versions**: 16.0.7+, 15.5.7, 15.4.8, 15.3.6, 15.2.6, 15.1.9, 15.0.5

#### References
- React CVE: CVE-2025-55182
- Affects experimental canary releases starting with 14.3.0-canary.77

---

### 🔴 CRITICAL #2: React 19.2.0 Vulnerability

**Related to Next.js RCE above**

#### Impact
React Server Components vulnerability in React 19.2.0 (used by Next.js 16.x)

#### Vulnerable Packages
- react-server-dom-parcel
- react-server-dom-turbopack
- react-server-dom-webpack

#### Fix
Upgrading Next.js to 16.0.7 will pull in React 19.2.1 which includes the fix.

---

### 🟠 HIGH #1: path-to-regexp ReDoS (Denial of Service)

**CVE**: CVE-2024-45296
**CVSS Score**: 7.5 (High)
**Advisory**: [GHSA-9wv6-86v2-598j](https://github.com/advisories/GHSA-9wv6-86v2-598j)

#### Impact
Regular Expression Denial of Service (ReDoS) vulnerability. Malicious input can cause exponential backtracking, blocking the Node.js event loop and causing DoS.

**CWE**: CWE-1333 (Inefficient Regular Expression Complexity)

#### Vulnerable Dependency
- **Package**: `path-to-regexp@6.2.1` (via `@vercel/node`)
- **Vulnerable Range**: `4.0.0` to `6.2.2`

#### Attack Example
```javascript
// Exploitable pattern: /:a-:b
const malicious = `/a${'-a'.repeat(8000)}/a`
// Causes 1000x slower performance, ~600ms latency vs 1ms
```

#### Fix
```bash
pnpm update @vercel/node
```

**Patched Version**: path-to-regexp >= 6.3.0

---

### 🟠 HIGH #2: @modelcontextprotocol/sdk DNS Rebinding

**CVE**: CVE-2025-66414
**CVSS Score**: Not specified (High severity)
**Advisory**: [GHSA-w48q-cv73-mx4w](https://github.com/advisories/GHSA-w48q-cv73-mx4w)
**Instances**: 2 packages affected

#### Impact
DNS rebinding vulnerability in MCP TypeScript SDK. Malicious websites can bypass same-origin policy and send requests to local MCP server running on localhost.

**CWE**: CWE-350 (Reliance on Reverse DNS Resolution), CWE-1188 (Insecure Default Initialization)

#### Vulnerable Packages
1. **@modelcontextprotocol/server-filesystem**
   - Current: `@modelcontextprotocol/sdk@1.23.0`
   - Path: `.>@modelcontextprotocol/server-filesystem>@modelcontextprotocol/sdk`

2. **@mzxrai/mcp-webresearch**
   - Current: `@modelcontextprotocol/sdk@1.0.1`
   - Path: `.>@mzxrai/mcp-webresearch>@modelcontextprotocol/sdk`

#### Attack Scenario
1. User runs local MCP server on localhost without authentication
2. User visits malicious website
3. Attacker exploits DNS rebinding to send requests to `http://127.0.0.1:port`
4. Attacker invokes tools or accesses resources on behalf of user

#### Fix
```bash
# Update the parent packages to pull in fixed SDK version
pnpm update @modelcontextprotocol/server-filesystem
pnpm update @mzxrai/mcp-webresearch
```

**Patched Version**: @modelcontextprotocol/sdk >= 1.24.0

#### Mitigation
Servers created via `createMcpExpressApp()` now have DNS rebinding protection enabled by default. Apply `hostHeaderValidation()` middleware for custom Express configurations.

---

### 🟡 MODERATE #1: esbuild CORS Vulnerability

**CVE**: None assigned
**CVSS Score**: 5.3 (Moderate)
**Advisory**: [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)

#### Impact
esbuild development server sets `Access-Control-Allow-Origin: *` allowing any website to send requests and read responses, including source code.

**CWE**: CWE-346 (Origin Validation Error)
**Attack Vector**: Network
**Attack Complexity**: High (requires user to visit malicious site during development)

#### Vulnerable Dependency
- **Package**: `esbuild@0.14.47` (via `@vercel/node`)
- **Vulnerable Range**: `<= 0.24.2`

#### Attack Scenario
1. Developer runs esbuild dev server (`npm run dev`)
2. Developer visits malicious website
3. Malicious site fetches `http://127.0.0.1:8000/app.js`
4. Attacker steals source code and source maps

#### Fix
```bash
pnpm update @vercel/node
```

**Patched Version**: esbuild >= 0.25.0

#### Note
This only affects **development** environments. Production builds are not vulnerable.

---

## Fix Summary

### Automatic Fixes Available

Run these commands to fix all vulnerabilities:

```bash
# Fix CRITICAL Next.js RCE
pnpm update next@16.0.7

# Fix HIGH @vercel/node (path-to-regexp + esbuild)
pnpm update @vercel/node

# Fix HIGH MCP SDK vulnerabilities
pnpm update @modelcontextprotocol/server-filesystem
pnpm update @mzxrai/mcp-webresearch

# Verify fixes
pnpm audit
```

### Manual Review Required

Some packages may require manual version pinning if automatic updates don't resolve transitive dependencies.

---

## Vulnerability Breakdown

| Severity | Count | CVE IDs |
|----------|-------|---------|
| **Critical** | 2 | CVE-2025-66478, CVE-2025-55182 |
| **High** | 4 | CVE-2024-45296, CVE-2025-66414 (2x), + 1 |
| **Moderate** | 2 | GHSA-67mh-4wv8-2f99, + 1 |
| **Total** | 8 | |

---

## CVSS Scoring Reference

| Score | Severity | Count |
|-------|----------|-------|
| 10.0 | Critical | 1 (Next.js RCE) |
| 7.5 | High | 1 (path-to-regexp) |
| 5.3 | Moderate | 1 (esbuild) |

---

## Risk Assessment

### Production Impact: 🔴 CRITICAL

The Next.js RCE vulnerability (CVSS 10.0) affects **production deployments** and allows remote code execution with:
- ✅ No authentication required
- ✅ No user interaction required
- ✅ Network-accessible attack vector
- ✅ Complete system compromise possible (Confidentiality, Integrity, Availability all HIGH)

**This must be fixed immediately before deploying to production.**

### Development Impact: 🟡 MODERATE

The esbuild CORS issue only affects development environments but could leak:
- Source code
- Source maps
- Environment configuration
- API keys in code

---

## Recommended Actions

### Immediate (Today)
1. ✅ **Upgrade Next.js to 16.0.7** - CRITICAL RCE fix
2. ✅ **Update @vercel/node** - HIGH severity fixes
3. ✅ Run `pnpm audit` to verify
4. ✅ Test application after updates
5. ✅ Deploy to production ASAP

### Short-term (This Week)
6. ✅ **Update MCP SDK packages** - HIGH severity
7. ✅ Set up Dependabot auto-merge for security patches
8. ✅ Enable GitHub security alerts
9. ✅ Add `pnpm audit` to CI/CD pipeline

### Long-term (Ongoing)
10. ✅ Weekly dependency audits
11. ✅ Automated security scanning in CI/CD
12. ✅ Pin specific versions instead of `latest` in package.json
13. ✅ Monitor security advisories for dependencies

---

## Additional Notes

### Packages Using "latest" (Security Risk)

The following packages use `"latest"` instead of specific versions:
```json
"@radix-ui/react-label": "latest",
"@radix-ui/react-select": "latest",
"@radix-ui/react-slot": "latest",
"@supabase/supabase-js": "latest",
"date-fns": "latest",
"next-themes": "latest"
```

**Recommendation**: Pin to specific versions to prevent unexpected breaking changes or security issues.

### Prevention

Add to `package.json`:
```json
"scripts": {
  "audit": "pnpm audit",
  "audit:fix": "pnpm audit --fix",
  "preinstall": "pnpm audit --audit-level=high"
}
```

Add to CI/CD pipeline:
```yaml
# .github/workflows/security.yml
- name: Security Audit
  run: pnpm audit --audit-level=moderate
```

---

## References

- [GitHub Security Advisories](https://github.com/moibftj/main-main--final/security/dependabot)
- [Next.js Security Advisory](https://github.com/advisories/GHSA-9qr9-h5gf-34mp)
- [React CVE-2025-55182](https://www.cve.org/CVERecord?id=CVE-2025-55182)
- [OWASP Regular Expression DoS](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
- [CWE-502: Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html)

---

**Report Generated By**: Security Audit Script
**Last Updated**: December 5, 2025
**Next Review**: After applying fixes
