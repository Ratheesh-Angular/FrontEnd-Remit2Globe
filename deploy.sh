#!/usr/bin/env bash
# Production deploy for cbp-frontend on EC2.
# Next.js TypeScript checking is memory-heavy; without free RAM or swap the build
# is SIGKILL'd by the Linux OOM killer ("Next.js build worker exited with code: null and signal: SIGKILL").

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

ensure_swap() {
  if swapon --show | grep -q .; then
    echo "[deploy] Swap already enabled."
    return
  fi
  if [[ -f /swapfile ]]; then
    echo "[deploy] Enabling existing /swapfile..."
    sudo swapon /swapfile || true
    return
  fi
  echo "[deploy] Creating 2G swap file (Next.js builds need it on small EC2 instances)..."
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab 2>/dev/null; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
  echo "[deploy] Swap ready."
}

echo "[deploy] Working directory: $APP_DIR"
free -h || true

ensure_swap

echo "[deploy] Stopping payment-frontend during build to free RAM..."
pm2 stop payment-frontend 2>/dev/null || true

echo "[deploy] Pulling latest main..."
git fetch origin main
git reset --hard origin/main

echo "[deploy] Installing dependencies..."
npm install

echo "[deploy] Building (Node heap capped at 3072 MB)..."
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
# prebuild generates public/version.json (commit, buildTime, environment) for footer badge
npm run build

echo "[deploy] Restarting payment-frontend..."
pm2 restart payment-frontend || pm2 start npm --name payment-frontend -- start
pm2 save || true

echo "[deploy] Done."
free -h || true
