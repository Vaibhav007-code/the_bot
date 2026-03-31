# 📱 BUDDY: Android Termux Recovery & Hosting Guide

If you ever accidentally delete the Termux app, factory reset your Android phone, or want to move BUDDY to a completely different phone, you don't need to rebuild anything! Simply follow this exact guide from top to bottom to perfectly clone your GitHub cloud backup and restore the bot back to 100% functionality.

---

### Step 1: Install & Prepare Termux
1. **DO NOT** download Termux from the Google Play Store (it is abandoned and broken). 
2. Open your new Android phone's browser and download the latest `.apk` from the **[Official F-Droid Page](https://f-droid.org/en/packages/com.termux/)**.
3. Open Termux on the phone and run these exact environment commands to update the system and install the required languages:
   ```bash
   pkg update && pkg upgrade -y
   pkg install nodejs git chromium -y
   ```

### Step 2: Download Your GitHub Backup
1. Make sure you have your **GitHub Personal Access Token**. If you lost it, generate a new Classic Token in your desktop GitHub Developer Settings (make sure you check the `repo` permission box!).
2. Run this command to download your bot:
   ```bash
   git clone https://github.com/Vaibhav007-code/the_bot.git
   ```
   *(When it asks for your password, you MUST long-press the screen and paste your GitHub Token string, NOT your actual account password. Press Enter after pasting—the text will remain invisible!)*

3. Enter the bot's newly downloaded folder:
   ```bash
   cd the_bot
   ```

### Step 3: Bypass ARM Architecture Errors
Because Android ARM processors block standard Windows/Mac Chromium installations, AND because the bot uses a native SQLite module (`better-sqlite3`) that must be compiled from source, you need to install the C++ build tools first:
```bash
pkg install python make clang -y
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install --ignore-scripts
```

### Step 4: Keep It Alive Forever (PM2)
You don't want the bot to die when you minimize the Termux app. We will install the PM2 Daemon server manager to lock the bot open silently in the background.

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Point PM2 to the correct Android Chromium processor and start the bot:
   ```bash
   CHROME_BIN=/data/data/com.termux/files/usr/bin/chromium-browser pm2 start index.js --name "buddy-bot"
   ```

3. Tell PM2 to save the active process so it's locked into memory:
   ```bash
   pm2 save
   ```

### 🎉 Step 5: Final Touches!
- Pull down your Android notification window and tap **"Acquire wakelock"** on the Termux persistent notification. This tells Android's battery manager not to freeze the application randomly.
- You can watch the bot load and grab your brand new login QR Code at any time by typing:
  ```bash
  pm2 logs buddy-bot
  ```

---

### Useful PM2 Commands for the Future:
If you ever edit code on your computer and want to update the phone:
```bash
git pull
pm2 restart buddy-bot
```

If you ever want to gracefully kill the bot entirely:
```bash
pm2 stop buddy-bot
```
