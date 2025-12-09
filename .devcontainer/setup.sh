#!/bin/bash
# =============================================================================
# Talk-To-My-Lawyer Dev Container Setup Script
# Runs once after container creation
# =============================================================================

set -e

echo "🚀 Setting up Talk-To-My-Lawyer development environment..."

# -----------------------------------------------------------------------------
# 1. Shell Integration Setup (CRITICAL for VS Code command detection)
# -----------------------------------------------------------------------------
echo "📝 Configuring shell integration..."

# Create bashrc additions for shell integration
cat >> ~/.bashrc << 'SHELL_INTEGRATION'

# VS Code Shell Integration
if [ -n "$VSCODE_INJECTION" ]; then
    . "$VSCODE_INJECTION"
fi

# Enable shell integration markers
if [ "$TERM_PROGRAM" = "vscode" ]; then
    . "$(code --locate-shell-integration-path bash 2>/dev/null || echo /dev/null)"
fi

# Helpful aliases for this project
alias dev="pnpm dev"
alias build="pnpm build"
alias lint="pnpm lint"
alias start="pnpm start"
alias db="supabase"
alias stripe-listen="stripe listen --forward-to localhost:3000/api/stripe/webhook"

# Show current branch in prompt
parse_git_branch() {
    git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/ (\1)/'
}
export PS1="\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[33m\]\$(parse_git_branch)\[\033[00m\]\$ "

SHELL_INTEGRATION

# Source the updated bashrc
source ~/.bashrc 2>/dev/null || true

# -----------------------------------------------------------------------------
# 2. Install pnpm globally and configure
# -----------------------------------------------------------------------------
echo "📦 Setting up pnpm..."

# Ensure pnpm is available
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm@latest
fi

# Configure pnpm
pnpm config set store-dir /home/node/.local/share/pnpm/store

# -----------------------------------------------------------------------------
# 3. Install Netlify CLI (not included in features)
# -----------------------------------------------------------------------------
echo "🌐 Installing Netlify CLI..."
npm install -g netlify-cli@latest || echo "⚠️  Netlify CLI installation failed (non-critical)"

# -----------------------------------------------------------------------------
# 4. Install project dependencies
# -----------------------------------------------------------------------------
echo "📦 Installing project dependencies..."

# Clean any stale node_modules binaries
rm -rf node_modules/.bin 2>/dev/null || true

# Install dependencies with pnpm
pnpm install --frozen-lockfile || pnpm install

# -----------------------------------------------------------------------------
# 5. Environment file setup
# -----------------------------------------------------------------------------
echo "🔐 Setting up environment files..."

if [ ! -f .env.local ]; then
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo "✅ Created .env.local from .env.example"
        echo ""
        echo "⚠️  IMPORTANT: Please update .env.local with your actual credentials:"
        echo "   - Supabase URL and keys"
        echo "   - OpenAI API key"
        echo "   - Stripe keys"
        echo "   - Admin credentials"
        echo ""
    else
        # Create a basic .env.local template
        cat > .env.local << 'ENV_TEMPLATE'
# =============================================================================
# Talk-To-My-Lawyer Environment Configuration
# =============================================================================

# Base URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000

# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
SUPABASE_HOSTNAME=your-project.supabase.co

# AI Provider - OpenAI (REQUIRED)
OPENAI_API_KEY=sk-your_openai_api_key_here

# Stripe Configuration (use test mode for development)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Admin Portal Credentials (REQUIRED)
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=your_secure_admin_password
ADMIN_PORTAL_KEY=your_admin_portal_key_here

# Rate Limiting (Redis/Upstash) - Optional for development
KV_REST_API_URL=https://your-redis-instance.upstash.io
KV_REST_API_TOKEN=your_upstash_token_here
REDIS_URL=rediss://default:your_token@your-redis.upstash.io:6379

# Test Mode - Enable for development without real Stripe
ENABLE_TEST_MODE=true
NEXT_PUBLIC_TEST_MODE=true

# Cron job security
CRON_SECRET=your_cron_secret_here
ENV_TEMPLATE
        echo "✅ Created .env.local template"
    fi
fi

# -----------------------------------------------------------------------------
# 6. Verify CLI installations
# -----------------------------------------------------------------------------
echo ""
echo "🔍 Verifying installed tools..."
echo "-----------------------------------"

check_tool() {
    if command -v "$1" &> /dev/null; then
        echo "✅ $1: $($1 --version 2>/dev/null | head -n1 || echo 'installed')"
    else
        echo "❌ $1: not found"
    fi
}

check_tool node
check_tool npm
check_tool pnpm
check_tool git
check_tool gh
check_tool supabase
check_tool vercel
check_tool netlify
check_tool stripe
check_tool docker

echo "-----------------------------------"
echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📚 Quick Start:"
echo "   pnpm dev          - Start Next.js dev server"
echo "   pnpm build        - Build for production"
echo "   pnpm lint         - Run ESLint"
echo "   stripe listen     - Listen for Stripe webhooks"
echo "   supabase start    - Start local Supabase (requires Docker)"
echo ""
echo "⚠️  Don't forget to:"
echo "   1. Update .env.local with your credentials"
echo "   2. Run 'gh auth login' to authenticate with GitHub"
echo "   3. Run 'vercel login' to authenticate with Vercel"
echo "   4. Run 'stripe login' to authenticate with Stripe"
echo ""
