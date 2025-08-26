````md
# 🛠️ Detailed Installation Instructions — Timer 24H Card

## 📥 Manual Installation (recommended for troubleshooting)

### Step 1: Download the files
Download the following files:
- `timer-24h-card.js`
- `timer-24h-card-editor.js`

### Step 2: Upload the files to Home Assistant
1. Create a folder: `config/www/timer-24h-card/`
2. Upload both files into this folder

### Step 3: Add a Lovelace resource
1. Go to **Settings → Dashboards → Resources**
2. Click **Add Resource**
3. Add:
   - URL: `/local/timer-24h-card/timer-24h-card.js`
   - Type: JavaScript Module

### Step 4: Restart Home Assistant
Restart Home Assistant.

### Step 5: Verify
1. Make sure the files are accessible at:
   - `http://YOUR-HA-IP:8123/local/timer-24h-card/timer-24h-card.js`
   - `http://YOUR-HA-IP:8123/local/timer-24h-card/timer-24h-card-editor.js`

2. If you get a 404 error, check:
   - The files are in `config/www/timer-24h-card/`
   - You have read permissions on the files
   - The URL is correct (note: use `/local/`, not `/www/`)

## 🔧 Common Troubleshooting

### Error: “Failed to load resource: 404”
**Fix:**
1. Confirm the files are in `config/www/timer-24h-card/`
2. Ensure the resource URL is `/local/timer-24h-card/timer-24h-card.js`
3. Restart Home Assistant
4. Clear your browser cache (Ctrl+F5)

### Error: “this.timeSlots.find is not a function”
**Fix:**
The new file already includes a fix for this issue. Make sure you’re using the latest version.

### Error: “Custom element doesn’t exist”
**Fix:**
1. Verify the Lovelace resource was added correctly
2. Restart Home Assistant
3. Clear your browser cache

## 📋 Add the Card to a Dashboard

### Via the UI (recommended)
1. Enter Edit mode on your dashboard
2. Click **Add Card**
3. Search for **Timer 24H Card**
4. Use the visual editor to configure

### Via YAML
```yaml
type: custom:timer-24h-card
title: "Lighting Timer"
home_sensors:
  - person.john_doe
  - binary_sensor.home_occupied
home_logic: OR
entities:
  - light.living_room
  - switch.garden_lights
save_state: true
```

## ✨ New Features

### 💾 Server-Side Persistence
- Data is stored in Home Assistant (not in the browser)
- Automatic synchronization across all devices
- No additional helpers required

### 🔄 Automatic Migration
- If old data exists in `localStorage`
- It will be automatically migrated to Home Assistant
- No data loss

## 🆘 Getting Help
If you run into issues:
1. Check the browser console (F12) for errors
2. Open a GitHub issue with the error details
3. Include your Home Assistant version
````
