# Changelog - Timer 24H Card

## [2.1.0] - 2024-12-19

### ✨ New Features
- **Split Hour Sectors**: Each hour now divided into outer (full hour) and inner (half hour) segments
- **Current Time Indicator**: Red pulsing circle shows exactly where you are in the day
- **True Cross-Device Sync**: Settings now sync automatically across all devices
- **Server-Side Storage**: Data saved in Home Assistant entities (not browser storage)
- **Auto-Sync Polling**: Checks for updates from other devices every 2 minutes

### 🎨 Visual Improvements  
- **Enhanced Sector Design**: Clear visual separation between full hour and half hour
- **Animated Current Time**: Pulsing red indicator for current time segment
- **Better Color Contrast**: Improved active/inactive state visibility
- **Middle Ring Divider**: Clear line separating inner and outer segments
- **Red Border Highlight**: Current time segment has red border instead of blue

### 🔧 Technical Improvements
- **Grid Layout Support**: Full compatibility with Home Assistant's new section layout
- **Automatic Entity Creation**: Creates input_text entities automatically for storage
- **Improved Error Handling**: Better fallback mechanisms and error messages
- **Enhanced Sync Logic**: Detects changes from other devices and updates automatically
- **Performance Optimizations**: Reduced unnecessary re-renders and API calls

### 🐛 Bug Fixes
- Fixed "Cannot set properties of undefined (setting 'layout')" error
- Fixed "timeSlots.find is not a function" error  
- Fixed sync issues between different devices
- Improved entity creation and storage reliability
- Better handling of missing or invalid data

### 🔄 Migration Notes
- Existing localStorage data will be automatically migrated to Home Assistant storage
- No manual configuration needed - entities are created automatically
- Old settings will be preserved during the upgrade

---

## [2.0.0] - 2024-12-18

### 🚀 Major Release
- Complete rewrite from TypeScript to vanilla JavaScript
- Removed build dependencies for easier installation
- Added Hebrew language support with RTL layout
- Introduced visual configuration editor
- Added home presence detection with multiple sensors
- Implemented automatic entity control based on schedule

### ✨ Features
- 24-hour circular timer with half-hour precision
- Smart home presence detection
- Automatic entity control
- Multi-language support (English/Hebrew)
- Responsive design for all devices
- Visual configuration editor
- Settings persistence in browser storage

---

## [1.0.0] - 2024-12-15

### 🎉 Initial Release
- Basic 24-hour timer functionality
- Simple on/off scheduling
- Basic Home Assistant integration
- Manual YAML configuration only
