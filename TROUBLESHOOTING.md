# 🤖 BUDDY Bot - Troubleshooting Guide

## 📱 QR Code Issues

### If QR Code is not working:

1. **Check WhatsApp Version**
   - Make sure you have the latest WhatsApp app
   - Update from App Store / Play Store

2. **Clear Linked Devices**
   - Open WhatsApp on phone
   - Go to Settings > Linked Devices
   - Remove all existing devices
   - Try scanning again

3. **Check Internet Connection**
   - Ensure stable WiFi on both phone and computer
   - Try switching between WiFi and mobile data

4. **Browser Issues**
   - Close WhatsApp Web in all browsers
   - Clear browser cache
   - Restart the bot

5. **Session Issues**
   - Delete the `sessions` folder
   - Restart the bot
   - Scan QR code again

## 🔧 Common Issues

### Bot won't start:
```bash
# Clear sessions and restart
rm -rf sessions
npm start
```

### Authentication fails:
- Wait 2-3 minutes before trying again
- WhatsApp has rate limiting

### Bot shuts down immediately:
- Check internet connection
- Ensure no other WhatsApp Web sessions are active

## 📞 WhatsApp Steps

1. Open WhatsApp app
2. Tap **Settings** (or 3 dots menu)
3. Select **Linked Devices**
4. Tap **Link a device** (green button)
5. Point camera at QR code
6. Wait for confirmation

## ⚡ Quick Fixes

```bash
# Complete reset
rm -rf sessions data
npm start
```

## 🆘 Still having issues?

1. Restart your phone
2. Restart your computer
3. Check firewall/antivirus settings
4. Try different internet connection

## 📋 Bot Features After Login

- Send **"start"** to begin
- Use numbers 1-14 for menu options
- JSON timetable support
- All features work offline (₹0 cost)
