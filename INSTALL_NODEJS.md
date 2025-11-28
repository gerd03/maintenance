# How to Install Node.js on Windows

## Quick Installation Guide

### Step 1: Download Node.js
1. Go to **https://nodejs.org/**
2. Click on the **LTS version** (recommended for most users)
   - This will download a file like `node-v20.x.x-x64.msi`

### Step 2: Install Node.js
1. Double-click the downloaded `.msi` file
2. Follow the installation wizard:
   - Click "Next" on the welcome screen
   - Accept the license agreement
   - Choose installation location (default is fine)
   - **IMPORTANT**: Make sure "Add to PATH" is checked (it should be by default)
   - Click "Install"
   - Wait for installation to complete
   - Click "Finish"

### Step 3: Verify Installation
1. **Close and reopen your terminal/PowerShell** (important!)
2. Type the following commands:
   ```powershell
   node --version
   npm --version
   ```
3. You should see version numbers (e.g., `v20.11.0` and `10.2.4`)

### Step 4: Start Your Server
Once Node.js is installed:
1. Navigate to your project folder:
   ```powershell
   cd "C:\Users\PC2\Desktop\AOAS WEB"
   ```
2. Double-click `START_SERVER.bat` OR run:
   ```powershell
   npm install
   npm start
   ```

## Troubleshooting

### "npm is not recognized" after installation
- **Close and reopen your terminal/PowerShell** - this is the most common issue!
- Restart your computer if that doesn't work
- Check if Node.js is in your PATH:
  ```powershell
  $env:PATH -split ';' | Select-String node
  ```

### Still having issues?
1. Uninstall Node.js from Control Panel
2. Restart your computer
3. Reinstall Node.js from nodejs.org
4. Make sure to check "Add to PATH" during installation

## Need Help?

- Node.js website: https://nodejs.org/
- Node.js documentation: https://nodejs.org/docs/
