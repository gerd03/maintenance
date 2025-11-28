# Deployment Guide - AOAS WEB

## ⚠️ IMPORTANT: Automatic Deployment

**Your website will run AUTOMATICALLY when deployed to cloud platforms!**

- ✅ **NO .bat files needed** - Those are only for local Windows development
- ✅ **NO manual server starting** - Cloud platforms run `npm start` automatically
- ✅ **Runs 24/7** - Server starts automatically and stays running
- ✅ **Auto-restart** - If server crashes, platform restarts it automatically

**The `.bat` files (START_SERVER.bat, etc.) are ONLY for local development on Windows. They are NOT used in deployment and can be ignored when deploying.**

## 🚀 How Deployment Works

When you deploy to any cloud platform:

1. **Platform automatically runs:** `npm install` (installs dependencies)
2. **Platform automatically runs:** `npm start` (starts your server)
3. **Server runs 24/7** - No manual intervention needed!
4. **Platform manages everything** - Restarts, monitoring, logs, etc.

**That's it!** Your `package.json` already has `"start": "node server.js"` which is all that's needed.

---

## 🌐 Cloud Deployment Options

### Option 1: Render (Easiest - Free Tier Available) ⭐ RECOMMENDED

1. **Sign up at [render.com](https://render.com)**

2. **Create a new Web Service:**
   - Connect your GitHub repository (or upload code manually)
   - Render will automatically detect it's a Node.js app

3. **Configure (usually auto-detected):**
   - **Build Command:** `npm install` (auto-detected)
   - **Start Command:** `npm start` (auto-detected from package.json)
   - **Environment:** `Node` (auto-detected)

4. **Add Environment Variables:**
   - Go to "Environment" tab
   - Add: `RESEND_API_KEY` = `re_crv62pzq_DAaSY1Q8B6jsKxSjLk5KFhi8`
   - Add: `NODE_ENV` = `production` (optional)
   - **Note:** `PORT` is set automatically by Render - don't set it manually

5. **Deploy!**
   - Click "Create Web Service"
   - Render automatically:
     - Runs `npm install`
     - Runs `npm start`
     - Starts your server
     - Keeps it running 24/7
   - Your site will be live at `https://your-app-name.onrender.com`

**✅ That's it! Server runs automatically - no .bat files needed!**

**Note:** The `render.yaml` file is already configured, but you can also configure manually in the dashboard.

---

### Option 2: Railway (Simple - Free Trial)

1. **Sign up at [railway.app](https://railway.app)**

2. **Create a new project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo" or "Empty Project"

3. **Add your code:**
   - If using GitHub, select your repository
   - If uploading, drag and drop your project folder

4. **Add Environment Variables:**
   - Go to "Variables" tab
   - Add: `RESEND_API_KEY` = `re_crv62pzq_DAaSY1Q8B6jsKxSjLk5KFhi8`
   - Add: `NODE_ENV` = `production` (optional)

5. **Deploy!**
   - Railway automatically:
     - Detects Node.js
     - Runs `npm install`
     - Runs `npm start` (from package.json)
     - Starts your server
     - Keeps it running 24/7
   - Your site will be live automatically

**✅ Server runs automatically - no .bat files needed!**

**Note:** The `railway.json` file is already configured for you!

---

### Option 3: Vercel (Great for Static + API)

1. **Sign up at [vercel.com](https://vercel.com)**

2. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Add Environment Variables:**
   - Go to your project settings on Vercel dashboard
   - Add `RESEND_API_KEY` = `re_crv62pzq_DAaSY1Q8B6jsKxSjLk5KFhi8`

5. **Redeploy:**
   ```bash
   vercel --prod
   ```

**Note:** The `vercel.json` file is already configured for you!

---

### Option 4: Heroku (Classic Option)

1. **Sign up at [heroku.com](https://heroku.com)**

2. **Install Heroku CLI:**
   ```bash
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

3. **Login and create app:**
   ```bash
   heroku login
   heroku create your-app-name
   ```

4. **Add environment variables:**
   ```bash
   heroku config:set RESEND_API_KEY=re_crv62pzq_DAaSY1Q8B6jsKxSjLk5KFhi8
   heroku config:set NODE_ENV=production
   ```

5. **Deploy:**
   ```bash
   git push heroku main
   ```

6. **Heroku automatically:**
   - Runs `npm install`
   - Runs `npm start` (or uses Procfile)
   - Starts your server
   - Keeps it running 24/7

**✅ Server runs automatically - no .bat files needed!**

**Note:** The `Procfile` is already created for Heroku compatibility!

---

### Option 5: DigitalOcean App Platform

1. **Sign up at [digitalocean.com](https://digitalocean.com)**

2. **Create a new App:**
   - Connect your GitHub repository
   - Select Node.js as the runtime

3. **Configure:**
   - **Build Command:** `npm install`
   - **Run Command:** `npm start`

4. **Add Environment Variables:**
   - `RESEND_API_KEY` = `re_crv62pzq_DAaSY1Q8B6jsKxSjLk5KFhi8`
   - `NODE_ENV` = `production`

5. **Deploy!**

---

## 🔧 Server Configuration

### Environment Variables Required

Make sure these are set in your hosting platform:

- `RESEND_API_KEY` - Your Resend API key
- `PORT` - Port number (usually set automatically by hosting platform)
- `NODE_ENV` - Set to `production` for production deployments

### Port Configuration

Most hosting platforms automatically set the `PORT` environment variable. The server is configured to use:
```javascript
const PORT = process.env.PORT || 3000;
```

This means it will use the platform's assigned port, or default to 3000 if not set.

---

## 📝 Post-Deployment Checklist

- [ ] Verify server is running (check `/api/health` endpoint)
- [ ] Test contact form submission
- [ ] Check email delivery in Resend dashboard
- [ ] Verify CORS is working (if accessing from different domain)
- [ ] Set up custom domain (optional)
- [ ] Configure SSL/HTTPS (usually automatic on most platforms)

---

## 🐛 Troubleshooting

### Server Not Starting

1. **Check environment variables:**
   - Make sure `RESEND_API_KEY` is set
   - Verify the API key is correct

2. **Check logs:**
   - Most platforms have a logs section in the dashboard
   - Look for error messages

3. **Test locally first:**
   ```bash
   npm start
   ```

### Emails Not Sending

1. **Verify API key:**
   - Check Resend dashboard to ensure API key is active
   - Verify API key has correct permissions

2. **Check server logs:**
   - Look for Resend API error messages
   - Check if rate limits are exceeded

3. **Test API key:**
   - Use Resend's test endpoint or dashboard

### CORS Issues

If you're accessing from a different domain, make sure:
- CORS is enabled in `server.js` (already configured)
- Your hosting platform allows the domain

---

## 💡 Recommended Hosting Platform

**For beginners:** **Render** or **Railway**
- Free tier available
- Easy setup
- Automatic deployments
- Built-in SSL/HTTPS

**For production:** **DigitalOcean App Platform** or **Heroku**
- More control
- Better performance
- Advanced features

---

## 🔄 Continuous Deployment

Most platforms support automatic deployments:

1. **Connect GitHub repository**
2. **Enable auto-deploy**
3. **Push to main branch = automatic deployment**

---

## 📞 Support

If you encounter issues:
1. Check the server logs
2. Verify environment variables
3. Test the `/api/health` endpoint
4. Check Resend dashboard for API status

---

## 🎉 Success!

Once deployed, your website will:
- ✅ Run 24/7 automatically
- ✅ Restart automatically if it crashes
- ✅ Handle contact form submissions
- ✅ Send emails via Resend API
- ✅ Be accessible from anywhere

No more need to manually start the server! 🚀

