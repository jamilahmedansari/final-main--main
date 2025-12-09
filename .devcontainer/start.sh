#!/bin/bash
# =============================================================================
# Talk-To-My-Lawyer Dev Container Start Script
# Runs every time the container starts
# OPTIMIZED: Quick startup with storage checks
# =============================================================================

# Don't exit on errors during startup
set +e

echo ""
echo "🚀 Starting Talk-To-My-Lawyer development environment..."
echo ""

# -----------------------------------------------------------------------------
# 1. Source shell integration (CRITICAL for VS Code)
# -----------------------------------------------------------------------------
if [ -f ~/.bashrc ]; then
    source ~/.bashrc 2>/dev/null || true
fi

# -----------------------------------------------------------------------------
# 2. Quick storage check - warn if low
# -----------------------------------------------------------------------------
AVAILABLE=$(df / 2>/dev/null | tail -1 | awk '{print $4}')
if [ -n "$AVAILABLE" ] && [ "$AVAILABLE" -lt 2000000 ]; then
    echo "⚠️  WARNING: Low disk space! Run 'cleanup' to free space."
    echo ""
fi

# -----------------------------------------------------------------------------
# 3. Ensure node_modules exists
# -----------------------------------------------------------------------------
if [ ! -d "node_modules" ] || [ ! -d "node_modules/.bin" ]; then
    echo "📦 Installing dependencies..."
    pnpm install --prefer-offline 2>/dev/null || pnpm install
fi

# -----------------------------------------------------------------------------
# 4. Environment check
# -----------------------------------------------------------------------------
if [ ! -f .env.local ]; then
    echo "⚠️  WARNING: .env.local not found!"
    echo "   Run: cp .env.example .env.local"
    echo ""
fi

# -----------------------------------------------------------------------------
# 5. Git configuration check
# -----------------------------------------------------------------------------
if [ -d ".git" ]; then
    if [ -z "$(git config user.email 2>/dev/null)" ]; then
        echo "⚠️  Git email not configured. Run:"
        echo "   git config user.email 'your@email.com'"
        echo ""
    fi
fi

# -----------------------------------------------------------------------------
# 6. Display status
# -----------------------------------------------------------------------------
echo "📊 Environment Status:"
echo "-----------------------------------"
echo "Node.js: $(node --version 2>/dev/null || echo 'not found')"
echo "pnpm: $(pnpm --version 2>/dev/null || echo 'not found')"
if [ -f .env.local ]; then
    echo "Environment: .env.local ✅"
else
    echo "Environment: .env.local ❌"
fi
DISK=$(df -h / 2>/dev/null | tail -1 | awk '{print $4 " free"}')
echo "Disk: $DISK"
echo "-----------------------------------"
echo ""
echo "📚 Commands: dev | build | lint | cleanup"
echo ""
