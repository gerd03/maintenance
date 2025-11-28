# Local Development Guide

## ⚠️ For Local Development Only

**This guide is ONLY for running the server on your local Windows computer for testing.**

**For deployment, see [DEPLOYMENT.md](DEPLOYMENT.md) - deployment is automatic and doesn't need these .bat files!**

---

## Quick Start (Local Testing)

### Option 1: Simple Start (Foreground)

Double-click **`START_SERVER.bat`**

- Server runs in the terminal window
- Press `Ctrl+C` to stop
- Window must stay open

### Option 2: Background Mode (Recommended for Local)

Double-click **`START_SERVER_BACKGROUND.bat`**

- Server runs in background
- You can close the window
- Server keeps running
- Use `STOP_SERVER.bat` to stop

### Option 3: Command Line

```bash
npm install    # First time only
npm start      # Start server
```

---

## What Are .bat Files?

`.bat` files are **Windows batch scripts** that:
- Check if Node.js is installed
- Install dependencies if needed
- Start the server
- **Only work on Windows**
- **Only for local development**

**They are NOT used in cloud deployment!**

---

## For Deployment

When you deploy to cloud platforms (Render, Railway, Vercel, etc.):
- ✅ Platform automatically runs `npm start`
- ✅ Server runs 24/7 automatically
- ✅ No .bat files needed
- ✅ No manual starting needed

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions.

---

## PM2 Commands (Optional - Local Only)

If you want to use PM2 locally:

```bash
npm run pm2:start    # Start in background
npm run pm2:stop     # Stop
npm run pm2:restart  # Restart
npm run pm2:logs     # View logs
npm run pm2:status   # Check status
```

**Note:** PM2 is also not needed for cloud deployment - platforms handle this automatically.



