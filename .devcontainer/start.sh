#!/bin/bash
# =============================================================================
# Talk-To-My-Lawyer Dev Container Start Script
# Runs every time the container starts
# =============================================================================

echo "🚀 Starting Talk-To-My-Lawyer development environment..."

# Source shell integration
if [ -f ~/.bashrc ]; then
    source ~/.bashrc 2>/dev/null || true
fi

# Ensure node_modules binaries are accessible
if [ -d "node_modules" ] && [ ! -d "node_modules/.bin" ]; then
    echo "📦 Refreshing node_modules binaries..."
    pnpm install
fi

# Check for .env.local
if [ ! -f .env.local ]; then
    echo ""
    echo "⚠️  WARNING: .env.local not found!"
    echo "   Run: cp .env.example .env.local"
    echo "   Then update with your credentials"
    echo ""
fi

# Display environment status
echo ""
echo "📊 Environment Status:"
echo "-----------------------------------"
echo "Node.js: $(node --version)"
echo "pnpm: $(pnpm --version)"
echo "Working Directory: $(pwd)"
if [ -f .env.local ]; then
    echo "Environment: .env.local ✅"
else
    echo "Environment: .env.local ❌ (missing)"
fi
echo "-----------------------------------"
echo ""
echo "Ready! Run 'pnpm dev' to start the development server."
echo ""
