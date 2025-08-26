# 🕐 Timer 24H Card

A custom Lovelace card for Home Assistant that provides a 24-hour circular timer with automatic entity control based on schedule and home presence.

## ✨ Features

- **🕐 24-hour circular timer** with half-hour precision
- **🏠 Smart home presence detection** using multiple sensors
- **⚡ Automatic entity control** according to your schedule
- **🌍 Multi-language support** (English/Hebrew) with RTL support
- **📱 Responsive design** that works on all devices
- **⚙️ Visual configuration editor** - no YAML needed
- **💾 Settings persistence** in browser storage
- **📡 Multiple update channels** (Stable/Beta/Development)

## 🚀 Latest Version 2.1.0 Features

### 🎯 Enhanced Visual Design
- **Split sectors**: Each hour divided into outer (full hour) and inner (half hour) segments
- **Current time indicator**: Red pulsing circle shows current time segment
- **Clear separation**: Visual divider between inner and outer rings
- **Better contrast**: Improved colors for active/inactive states

### 🔄 True Cross-Device Sync
- **Server-side storage**: Data saved in Home Assistant (not browser)
- **Auto-sync**: Changes sync across all devices within 2 minutes
- **Real-time updates**: See changes from other devices automatically
- **No setup required**: Creates storage entities automatically

### 🎨 Modern UI Improvements
- **Animated indicators**: Pulsing current time marker
- **Grid layout support**: Full compatibility with new HA sections
- **Responsive design**: Works perfectly on all screen sizes
- **Professional editor**: Enhanced visual configuration interface

## 📦 Installation

### Via HACS (Recommended)
1. Add custom repository: `https://github.com/davidss20/home-assistant-timer-24h-card`
2. Choose your update channel (Stable/Beta)
3. Install and restart Home Assistant

### Manual Installation
1. Download the latest release
2. Copy files to `config/www/timer-24h-card/`
3. Add to Lovelace resources

## 🔧 Configuration

Use the visual editor (recommended) or YAML:

```yaml
type: custom:timer-24h-card
title: "My Timer"
home_sensors:
  - person.john_doe
  - binary_sensor.home_occupied
home_logic: OR
entities:
  - light.living_room
  - switch.garden_lights
save_state: true
```

## 📡 Update Channels

- **🟢 Stable**: Tested releases (recommended)
- **🟡 Beta**: Latest features, pre-release
- **🔴 Development**: Daily builds, cutting edge

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/davidss20/home-assistant-timer-24h-card/issues)
- **Discussions**: [GitHub Discussions](https://github.com/davidss20/home-assistant-timer-24h-card/discussions)
- **Documentation**: [Full Guide](https://github.com/davidss20/home-assistant-timer-24h-card/blob/main/README.md)
