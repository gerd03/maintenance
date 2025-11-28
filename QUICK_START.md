# 🚀 Quick Start Guide

## ⚠️ IMPORTANT: Automatic Deployment

**When you deploy to cloud platforms, the server runs AUTOMATICALLY!**

- ✅ **NO .bat files needed** - Those are only for local Windows testing
- ✅ **NO manual starting** - Platform runs `npm start` automatically
- ✅ **Runs 24/7** - Server starts and stays running automatically

**The .bat files are ONLY for local development on Windows. They are NOT used in deployment.**

---

## For Production Deployment (Recommended)

### Option 1: Render (Easiest - FREE) ⭐

1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository (or upload code)
4. Render auto-detects Node.js and sets:
   - **Build Command:** `npm install` (auto-detected)
   - **Start Command:** `npm start` (auto-detected from package.json)
5. Add Environment Variable:
   - Go to "Environment" tab
   - **Key:** `RESEND_API_KEY`
   - **Value:** `re_crv62pzq_DAaSY1Q8B6jsKxSjLk5KFhi8`
6. Click "Create Web Service"
7. Render automatically:
   - Runs `npm install`
   - Runs `npm start`
   - Starts your server
   - Keeps it running 24/7
8. Wait 2-3 minutes for deployment
9. Your site is live! 🎉

**✅ That's it! Server runs automatically - no .bat files, no manual starting!**

---

### Option 2: Railway (Also Easy - FREE Trial)

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add Environment Variable:
   - Go to "Variables" tab
   - **Key:** `RESEND_API_KEY`
   - **Value:** `re_crv62pzq_DAaSY1Q8B6jsKxSjLk5KFhi8`
5. Railway automatically:
   - Detects Node.js
   - Runs `npm install`
   - Runs `npm start`
   - Starts your server
   - Keeps it running 24/7
6. Your site is live! 🎉

**✅ Server runs automatically - no .bat files needed!**

---

## For Local Testing Only

If you want to test locally on Windows:

- **Double-click `START_SERVER.bat`** - For simple testing
- **Double-click `START_SERVER_BACKGROUND.bat`** - For background mode
- See [LOCAL_DEV.md](LOCAL_DEV.md) for local development details

**Remember:** These .bat files are ONLY for local Windows testing, NOT for deployment!

---

## What's Already Set Up?

✅ **Automatic Deployment** - Cloud platforms run `npm start` automatically
✅ **Deployment Configs** - Ready for Render, Railway, Vercel, Heroku
✅ **Production Ready** - All configurations set up
✅ **24/7 Running** - Server starts and stays running automatically

---

## Need Help?

- See `DEPLOYMENT.md` for detailed deployment instructions
- See `LOCAL_DEV.md` for local development/testing
- Check server logs if something goes wrong
- Verify your Resend API key is active

---

## 🎯 Recommended Next Steps

1. **Deploy to Render** (easiest option - see above)
2. **Add `RESEND_API_KEY` environment variable**
3. **Wait 2-3 minutes for deployment**
4. **Test contact form** on live site
5. **Done!** Your website runs 24/7 automatically

**No .bat files needed for deployment - everything is automatic!** 🚀

