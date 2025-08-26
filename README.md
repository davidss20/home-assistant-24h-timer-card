# Timer 24H Card - 24 Hour Timer Card

<div align="center">

![Timer 24H Card Icon](https://github.com/davidss20/home-assistant-timer-24h-card/raw/main/icon.svg)


[![HACS Badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/release/davidss20/timer-24h-card.svg?style=for-the-badge&color=blue)](https://github.com/davidss20/home-assistant-timer-24h-card/releases)
[![License](https://img.shields.io/github/license/davidss20/timer-24h-card.svg?style=for-the-badge&color=green)](LICENSE)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg?style=for-the-badge)](https://github.com/davidss20/home-assistant-timer-24h-card/graphs/commit-activity)

</div>

A custom card for Home Assistant that allows you to set a daily schedule with automatic entity control.

<div align="center">

![Timer 24H Card Preview](https://github.com/davidss20/home-assistant-timer-24h-card/raw/main/images/preview.jpg)

*24-hour circular timer with automatic entity control and home presence detection*

</div>

## ✨ Features

- **🕐 24-hour circular timer** with half-hour segments
- **🏠 Home presence detection** - entities will only be activated when you are at home
- **🔧 Automatic entity control** according to the schedule
- **💾 Server-side sync** across all devices
- **🌍 Multi-language support** with RTL support
- **⚙️ Graphical configuration editor** easy to use

## 📥 Installation

### 📡 Choose Your Update Channel

| Channel | Description | Recommended For |
|---------|-------------|-----------------|
| 🟢 **Stable** | Tested releases only | Most users |
| 🟡 **Beta** | Latest features, pre-release | Advanced users |
| 🔴 **Development** | Daily builds, cutting edge | Developers |


### Via HACS (Recommended)

1. Open HACS in Home Assistant
2. Go to "Frontend" 
3. Click "+" and choose "Add custom repository"
4. Add the link: `https://github.com/davidss20/home-assistant-timer-24h-card`
5. Choose category: "Lovelace"
6. **Choose Channel**:
   - **Stable**: Install normally (default)
   - **Beta**: Enable "Show beta versions" in HACS settings first
   - **Development**: Use manual installation below
7. Install "Timer 24H Card"
8. **Restart Home Assistant**

### Manual Installation

1. Download `timer-24h-card.js` and `timer-24h-card-editor.js`
2. Copy the files to `config/www/timer-24h-card/` folder
3. Add to `configuration.yaml`:

```yaml
lovelace:
  mode: yaml
  resources:
    - url: /local/timer-24h-card/timer-24h-card.js
      type: module
    - url: /local/timer-24h-card/timer-24h-card-editor.js
      type: module
```

**⚠️ Very Important**: Make sure both files are loaded - both `timer-24h-card.js` and `timer-24h-card-editor.js`!

4. **Restart Home Assistant**

 

## 🚀 Usage

### Adding the Card

#### Via Graphical Interface
1. Go to Lovelace edit mode
2. Click "Add Card"
3. Search for "Timer 24H Card"
4. Configure the card through the graphical interface

#### Via YAML
```yaml
type: custom:timer-24h-card
title: "Lighting Timer"
home_sensors:
  - person.john
  - binary_sensor.home_occupancy
home_logic: OR  # or AND
entities:
  - light.living_room
  - switch.garden_lights
  - fan.bedroom
save_state: true
save_to_ha: true      # Sync across devices
language: auto        # Options: auto, en, he
```

## ⚙️ Configuration Options

| Name | Type | Required | Default | Description |
|----|-----|------|-------------|-------|
| `title` | string | ❌ | "24 Hour Timer" | Card title |
| `home_sensors` | list | ❌ | `[]` | List of sensors for presence detection |
| `home_logic` | string | ❌ | "OR" | Detection logic: OR or AND |
| `entities` | list | ❌ | `[]` | Entities for automatic control |
| `save_state` | boolean | ❌ | `true` | Save timer settings |
| `save_to_ha` | boolean | ❌ | `true` | Sync across devices via Home Assistant |
| `language` | string | ❌ | `auto` | Language: `auto`, `en`, `he` |

### Supported Sensor Types for Presence Detection:
- `person.*` - People
- `device_tracker.*` - Device tracking
- `binary_sensor.*` - Binary sensors
- `sensor.*` - General sensors
- `input_boolean.*` - Virtual switches

### Supported Entity Types for Control:
- `light.*` - Lights
- `switch.*` - Switches
- `fan.*` - Fans
- `climate.*` - Climate control
- `media_player.*` - Media players
- `cover.*` - Covers and blinds
- `input_boolean.*` - Virtual switches

## 📋 Examples

### Basic Lighting Timer
```yaml
type: custom:timer-24h-card
title: "Automatic Lighting"
entities:
  - light.living_room
  - light.kitchen
  - light.bedroom
```

### Advanced Timer with Presence Detection
```yaml
type: custom:timer-24h-card
title: "Smart Home System"
home_sensors:
  - person.john
  - person.jane
  - binary_sensor.motion_entrance
home_logic: OR
entities:
  - light.all_lights
  - switch.water_heater
  - climate.living_room
  - fan.bedroom
save_state: true
```

### Multi-System Control
```yaml
type: custom:timer-24h-card
title: "Full Automation"
home_sensors:
  - device_tracker.john_phone
  - input_boolean.home_mode
home_logic: AND
entities:
  - switch.garden_irrigation
  - light.outdoor_lights
  - media_player.living_room_tv
  - cover.main_blinds
  - climate.main_ac
save_state: true
```

## 🌍 Hebrew Support / תמיכה בעברית

The card includes full Hebrew language support with automatic detection:

### Automatic Language Detection:
1. **Home Assistant Language** - Detects from your HA language settings
2. **Browser Language** - Falls back to browser language
3. **Manual Override** - Force specific language in configuration

### Force Hebrew Display:
```yaml
type: custom:timer-24h-card
title: "טיימר תאורה"
language: he  # Force Hebrew
home_sensors:
  - person.john_doe
  - binary_sensor.jewish_calendar_issur_melacha_in_effect
home_logic: AND
entities:
  - light.living_room
save_state: true
```

### Hebrew Features:
- **🔄 RTL Support** - Right-to-left text direction
- **📝 Translated Interface** - All texts in Hebrew
- **⚙️ Hebrew Editor** - Configuration interface in Hebrew
- **🎯 Status Messages** - "ידלק", "חסום ע"י סנסורים", etc.

### Debug Hebrew Display:
If the card shows English instead of Hebrew:
1. Open browser console (F12)
2. Look for "🌍 Language Detection Debug" messages
3. Check if Hebrew is detected correctly
4. Force Hebrew with `language: he` in configuration

---

## 🔄 Cross-Device Synchronization

Keep your timer settings synced across all devices (phone, tablet, computer)!

### 🤖 Fully Automatic Setup (Recommended)

**Zero configuration needed!** The card automatically creates all required entities and sets up synchronization:

#### Automatic Setup:
1. **Install the card** (via HACS or manually)
2. **Add to dashboard**:
   ```yaml
   type: custom:timer-24h-card
   title: "My Timer"
   # That's it! No entities, no configuration.yaml changes needed!
   ```
3. **Use immediately** - sync works automatically across all devices!

> 🤖 **[Automatic Installation Guide →](AUTO_INSTALL.md)**

### ⚡ Manual Setup (Alternative)

If you prefer manual control or automatic setup doesn't work:

#### Manual Setup:
1. **Add to `configuration.yaml`**:
   ```yaml
   input_text:
     timer_card_lighting_timer_data:
       name: "Lighting Timer Data"
       max: 10000
     timer_card_lighting_timer_backup:
       name: "Lighting Timer Backup" 
       max: 10000
   ```
2. **Restart Home Assistant**

> 📖 **[5-Minute Manual Setup Guide →](QUICK_SYNC_SETUP.md)**

### 🏠 Basic Home Assistant Sync (Alternative)

For simple setup using input_text entities:

1. **Add to `configuration.yaml`**:
   ```yaml
   input_text:
     timer_24h_card_lighting_timer:  # Based on your card title
       name: "Lighting Timer State"
       max: 10000
   ```

2. **Restart Home Assistant**

#### Advanced Storage Benefits:
- **⚡ Real-time sync**: Changes appear instantly on all devices
- **🏠 Server storage**: JSON files stored on Home Assistant server  
- **🔄 WebSocket events**: Live updates via Home Assistant events
- **📊 Manageable**: Easy backup, restore, and data management

#### Basic Sync Benefits:
- **📱 Multi-device sync**: Same settings on phone, tablet, computer
- **💾 Entity storage**: Uses Home Assistant input_text entities
- **🔒 Secure**: Data stays in your Home Assistant instance

#### Entity Name Generation:
| Card Title | Entity ID |
|------------|-----------|
| "Lighting Timer" | `input_text.timer_24h_card_lighting_timer` |
| "Bedroom Lights" | `input_text.timer_24h_card_bedroom_lights` |
| "טיימר תאורה" | `input_text.timer_24h_card_טיימר_תאורה` |

> 📖 **[Full Setup Guide →](SYNC_SETUP.md)**

### 💾 Browser Storage (Fallback)
If Home Assistant sync is disabled or fails, settings are saved locally in each browser.

```yaml
type: custom:timer-24h-card
save_to_ha: false  # Use browser storage only
```

---

## 🎯 How It Works

1. **🎨 Setting Times**: Click on segments in the circle or on the pointing triangle
   - **Outer circle**: Full hours (00:00, 01:00, etc.)
   - **Inner circle**: Half hours (00:30, 01:30, etc.)

2. **🏠 Presence Detection**: The card checks the configured sensors every minute
   - **OR**: At least one sensor must be active
   - **AND**: All sensors must be active

3. **🔧 Entity Control**: If you are at home and the time is active, entities will be turned on automatically

4. **💾 Persistence**: Settings are saved in the browser (if enabled)

## 🎨 Card Appearance

- **🟢 Green**: Active segments
- **⚪ Gray**: Inactive segments  
- **🔵 Blue**: Current segment (blue border)
- **🔴 Red**: Triangle when current time is inactive
- **🟢 Green**: Triangle when current time is active

## 🔧 Troubleshooting

### Card Doesn't Appear
1. Make sure files are copied correctly
2. Verify resources are added to `configuration.yaml`
3. Restart Home Assistant
4. Clear browser cache (Ctrl+F5)

### Entities Don't Activate
1. Verify entities exist and are available
2. Check that sensors return correct values
3. Make sure you are "at home" according to sensors
4. Check Home Assistant logs

### Settings Don't Save
1. Verify `save_state: true` in configuration
2. Check that browser allows Local Storage
3. Try refreshing the page

## 🎮 Try It Live

Want to see the card in action before installing? Try our interactive preview:

**[🔗 Live Interactive Preview](https://davidss20.github.io/timer-24h-card/preview.html)**

*Click on segments, try different presets, and see how the card responds!*

## 🆘 Support

- **🐛 Bug Reports**: [GitHub Issues](https://github.com/davidss20/home-assistant-timer-24h-card/issues)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/davidss20/home-assistant-timer-24h-card/discussions)
- **📖 Additional Documentation**: [Wiki](https://github.com/davidss20/home-assistant-timer-24h-card/wiki)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the Home Assistant community** 