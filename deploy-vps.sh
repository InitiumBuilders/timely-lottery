#!/bin/bash
# Timely.Works VPS Update Script
# Run this ON the VPS: ssh root@187.77.3.35
# Then: cd /timely-lottery && bash deploy-vps.sh

echo "🚀 Timely.Works Update — Auto Admin + Duration Options"
echo "============================================================"

# Pull latest code
echo "📦 Pulling latest code..."
git pull origin main 2>/dev/null || git pull 2>/dev/null || echo "⚠️  No git remote — manual copy needed"

# Install deps
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps 2>&1 | tail -3

# Build
echo "🔨 Building Next.js..."
npm run build 2>&1 | tail -5

# Restart app
echo "♻️  Restarting PM2..."
pm2 restart timely-lottery
pm2 restart timely-worker

# Verify
sleep 3
pm2 status

echo ""
echo "✅ Deploy complete! timely.works is updated."
echo "🤖 Auto Admin is ENABLED by default — 7-day lotteries will start automatically."
