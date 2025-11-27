# Agent Instructions: Application Functionality Verification

## Objective
Verify and ensure all functionalities of the application are working correctly. If any issues are found, fix them automatically.

## Instructions for Codex

### 1. Initial Assessment
- Scan the entire project structure to identify:
    - Main application files and entry points
    - Configuration files (package.json, requirements.txt, etc.)
    - Database connections and migrations
    - API endpoints and routes
    - Environment variables and secrets (never display, log, or report secret values; only confirm their presence/configuration)

### 2. Dependency Check
- Verify all dependencies are installed and up-to-date
- Check for missing or conflicting packages
- Install any missing dependencies automatically
- Run `npm install`, `pip install -r requirements.txt`, or equivalent

### 3. Configuration Verification
- Validate all configuration files are present and properly formatted
- Check environment variables are set correctly
- Verify database connection strings
- Confirm API keys and credentials are configured (without exposing them)

### 4. Core Functionality Tests
- **Authentication & Authorization**: Test login, logout, registration, and permission checks
- **Database Operations**: Verify CRUD operations work correctly
- **API Endpoints**: Test all routes for expected responses
- **File Operations**: Check file upload, download, and storage functionality
- **External Services**: Verify third-party API integrations

### 5. Build & Deployment Check
- Run build process and check for errors
- Verify production build completes successfully
- Test development server startup
- Check for broken imports or missing modules

### 6. Automated Fixes
If issues are detected:
- Install missing dependencies
- Create missing configuration files from templates
- Fix syntax errors in code only if the transformation is well-defined and safe; require human approval for significant or potentially risky changes
- Update deprecated API calls
- Generate missing database migrations
- Detect missing environment variables and prompt for manual configuration

### 7. Reporting
Generate a report including:
- ✅ List of all working functionalities
- ❌ List of issues found and fixed
- ⚠️ Warnings or potential improvements
- 📋 Manual steps required (if any)

### 8. Final Verification
- Run the application end-to-end
- Execute test suite if available
- Confirm no critical errors in logs
- Validate application is ready for use

## Success Criteria
All functionalities must pass verification or be automatically fixed. Report any issues that require manual intervention.
