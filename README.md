# AOAS WEB - Contact Form Setup

This project includes a functional contact form that sends emails using the Resend API.

## Setup Instructions

### 0. Install Node.js (REQUIRED FIRST!)

**If you see "npm is not recognized" error:**
1. Download Node.js from **https://nodejs.org/** (get the LTS version)
2. Install it (make sure "Add to PATH" is checked)
3. **Close and reopen your terminal/PowerShell** (very important!)
4. Verify installation: `node --version` and `npm --version`

See `INSTALL_NODEJS.md` for detailed instructions.

### 1. Install Dependencies

```bash
npm install
```

**OR** simply double-click `START_SERVER.bat` - it will install dependencies automatically!

### 2. Configure Environment Variables

Create a `.env` file in the root directory with your Resend API key:

```
RESEND_API_KEY=re_crv62pzq_DAaSY1Q8B6jsKxSjLk5KFhi8
PORT=3000
```

### 3. Start the Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 4. Access the Website

Open your browser and navigate to `http://localhost:3000`

## How It Works

- When users submit the contact form, the data is sent to `/api/contact`
- The server validates the form data
- An email is sent to `alejandro@attainmentofficeadserv.org` using Resend
- The sender name appears as "AOAS WEB Receive Mail"
- Users receive a beautiful custom modal notification (matching your green/orange theme) upon successful submission

## Custom Modal System

The contact form now uses a custom modal system instead of browser alerts:
- **Success messages**: Green-themed modal with smooth animations
- **Error messages**: Orange-themed modal for errors
- **Features**: 
  - Click outside to close
  - Press Escape key to close
  - Beautiful animations matching your site design
  - Responsive design for mobile devices

## Troubleshooting

### "Server Not Running" Error
If you see this error, it means the Node.js server isn't running:
1. Open a terminal in the project directory
2. Run `npm start`
3. Make sure the server is running on `http://localhost:3000`
4. Refresh your browser and try again

### "Failed to fetch" Error
This usually means:
- The server isn't running (see above)
- The server is running on a different port
- Check that `PORT=3000` in your `.env` file

### Form Not Sending
1. Check that your `.env` file exists and contains `RESEND_API_KEY`
2. Verify the API key is correct
3. Check the server console for error messages
4. Make sure you're accessing the site through the Node.js server (not Live Server)

## Email Configuration

- **Recipient**: alejandro@attainmentofficeadserv.org
- **Sender Name**: AOAS WEB Receive Mail
- **From Email**: Currently using Resend's default domain (onboarding@resend.dev)

### Note on Email Sender

For production use, you may want to verify your own domain in the Resend dashboard to use a custom "from" email address (e.g., `AOAS WEB Receive Mail <noreply@yourdomain.com>`). This improves email deliverability and branding.

## API Endpoints

- `POST /api/contact` - Submit contact form
- `GET /api/health` - Health check endpoint

## Deployment

**🚀 Your website will run AUTOMATICALLY when deployed - no manual starting needed!**

### ⚠️ Important: Automatic Deployment

- ✅ **NO .bat files needed for deployment** - Those are only for local Windows development
- ✅ **Server starts automatically** - Cloud platforms run `npm start` automatically
- ✅ **Runs 24/7** - Server stays running without any manual intervention
- ✅ **Auto-restart** - If server crashes, platform restarts it automatically

### Quick Deployment Options:

1. **Render.com (Recommended - FREE):**
   - Sign up, connect GitHub, add `RESEND_API_KEY` environment variable
   - Platform automatically runs `npm start` and keeps server running
   - See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions

2. **Railway.app (Also Easy - FREE Trial):**
   - Similar to Render, automatic deployment
   - See [DEPLOYMENT.md](DEPLOYMENT.md) for instructions

3. **Other Platforms:**
   - Vercel, Heroku, DigitalOcean - all supported
   - See [DEPLOYMENT.md](DEPLOYMENT.md) for all options

**📖 For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)**

**💻 For local development/testing, see [LOCAL_DEV.md](LOCAL_DEV.md)**

## Project Structure

```
.
├── index.html                    # Main HTML file
├── script.js                     # Frontend JavaScript (form handling)
├── style.css                     # Styles
├── server.js                     # Backend server with Resend integration
├── package.json                  # Dependencies
├── .env                          # Environment variables (not in git)
├── ecosystem.config.js           # PM2 configuration for background running
├── vercel.json                   # Vercel deployment config
├── render.yaml                   # Render deployment config
├── railway.json                  # Railway deployment config
├── START_SERVER.bat              # Start server (foreground)
├── START_SERVER_BACKGROUND.bat   # Start server (background with PM2)
├── STOP_SERVER.bat               # Stop background server
└── DEPLOYMENT.md                 # Detailed deployment guide
```

