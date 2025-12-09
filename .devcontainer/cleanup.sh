#!/bin/bash
# =============================================================================
# Talk-To-My-Lawyer Storage Cleanup Script
# Run this periodically to reclaim disk space
# Usage: bash .devcontainer/cleanup.sh
# =============================================================================

set -e

echo "🧹 Starting storage cleanup..."
echo ""

# Track space before
BEFORE=$(df -h / 2>/dev/null | tail -1 | awk '{print $4}')
echo "💾 Space available before: $BEFORE"
echo ""

# -----------------------------------------------------------------------------
# 1. Clean Next.js build cache
# -----------------------------------------------------------------------------
echo "🔄 Cleaning Next.js cache..."
rm -rf .next/cache 2>/dev/null || true
rm -rf .next/trace 2>/dev/null || true

# -----------------------------------------------------------------------------
# 2. Clean node_modules cache
# -----------------------------------------------------------------------------
echo "📦 Cleaning node_modules cache..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf node_modules/.vite 2>/dev/null || true

# -----------------------------------------------------------------------------
# 3. Clean pnpm store (remove orphaned packages)
# -----------------------------------------------------------------------------
echo "📦 Pruning pnpm store..."
pnpm store prune 2>/dev/null || true

# -----------------------------------------------------------------------------
# 4. Clean npm cache
# -----------------------------------------------------------------------------
echo "📦 Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true

# -----------------------------------------------------------------------------
# 5. Clean Git objects (compress)
# -----------------------------------------------------------------------------
echo "📂 Compressing Git objects..."
if [ -d ".git" ]; then
    git gc --auto 2>/dev/null || true
    git prune 2>/dev/null || true
fi

# -----------------------------------------------------------------------------
# 6. Clean temp files
# -----------------------------------------------------------------------------
echo "🗑️  Cleaning temp files..."
rm -rf /tmp/* 2>/dev/null || true
rm -rf ~/.npm/_logs/* 2>/dev/null || true
rm -rf ~/.npm/_cacache 2>/dev/null || true

# -----------------------------------------------------------------------------
# 7. Clean apt cache (if root access)
# -----------------------------------------------------------------------------
echo "🗑️  Cleaning apt cache..."
sudo apt-get clean 2>/dev/null || true
sudo rm -rf /var/lib/apt/lists/* 2>/dev/null || true
sudo rm -rf /var/cache/apt/archives/*.deb 2>/dev/null || true

# -----------------------------------------------------------------------------
# 8. Clean TypeScript build info
# -----------------------------------------------------------------------------
echo "🔧 Cleaning TypeScript cache..."
find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true
find . -name "tsconfig.tsbuildinfo" -type f -delete 2>/dev/null || true

# -----------------------------------------------------------------------------
# 9. Remove log files older than 7 days
# -----------------------------------------------------------------------------
echo "📋 Removing old log files..."
find . -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
find /tmp -type f -mtime +1 -delete 2>/dev/null || true

# -----------------------------------------------------------------------------
# Results
# -----------------------------------------------------------------------------
AFTER=$(df -h / 2>/dev/null | tail -1 | awk '{print $4}')
echo ""
echo "-----------------------------------"
echo "✅ Cleanup complete!"
echo "💾 Space available after: $AFTER"
echo "-----------------------------------"
echo ""
echo "💡 Tips for more space:"
echo "   - Run 'rm -rf node_modules && pnpm install' for fresh install"
echo "   - Run 'rm -rf .next' to clear all build files"
echo "   - Run 'docker system prune -a' if using Docker"
echo ""
