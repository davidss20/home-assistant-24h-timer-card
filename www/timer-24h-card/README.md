# Timer 24H Card

A Lovelace card for the Timer 24H integration that provides a visual interface for managing 24-hour schedules with server-side automation.

## Features

- **Visual Schedule Editor**: Click and drag to set 48 half-hour time slots
- **Multiple Schedules**: Create and manage multiple named schedules
- **Condition Support**: Set conditions that must be met for schedules to activate
- **Real-time Updates**: Live synchronization with server-side integration
- **Internationalization**: Support for English, Spanish, and French
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Installation

### Prerequisites

This card requires the **Timer 24H Integration** to be installed first. The integration provides the server-side scheduling logic while this card provides the user interface.

### Via HACS (Recommended)

1. Install the Timer 24H Integration via HACS
2. Add this repository to HACS as a custom frontend repository
3. Install "Timer 24H Card"
4. Restart Home Assistant

### Manual Installation

1. Download `timer-24h-card.js` and `timer-24h-card-editor.js`
2. Copy the files to `config/www/timer-24h-card/`
3. Add the resource to Lovelace:

```yaml
resources:
  - url: /local/timer-24h-card/timer-24h-card.js
    type: module
```

4. Restart Home Assistant

## Configuration

### Via UI
1. Go to Lovelace edit mode
2. Add a new card
3. Search for "Timer 24H Card"
4. Configure using the visual editor

### Via YAML
```yaml
type: custom:timer-24h-card
title: "Lighting Timer"
show_preview: true
show_conditions: true
compact_mode: false
```

## Configuration Options

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `type` | string | **Required** | `custom:timer-24h-card` |
| `title` | string | "Timer 24H" | Card title |
| `schedule_id` | string | optional | Specific schedule to display (shows all if not set) |
| `show_preview` | boolean | true | Show schedule information |
| `show_conditions` | boolean | true | Show condition status |
| `compact_mode` | boolean | false | Use compact layout |
| `language` | string | auto | Force specific language (`en`, `es`, `fr`) |

## Usage

### Creating Schedules

1. Open the card editor
2. Enter a unique Schedule ID
3. Select the target entity to control
4. Click "Create" to create the schedule
5. Use the time slot grid to set active periods
6. Add conditions if needed
7. Save the schedule

### Time Slots

- **48 slots total**: Each represents 30 minutes (00:00, 00:30, 01:00, etc.)
- **Click individual slots**: Toggle single time periods
- **Click and drag**: Select multiple slots at once
- **Active slots**: Shown in primary color
- **Current time**: Highlighted with accent color border

### Conditions

Conditions determine when schedules should activate based on entity states:

- **Entity ID**: Any Home Assistant entity
- **Expected State**: The state the entity should have
- **Policy**: What to do when condition is not met:
  - **Skip**: Don't change state
  - **Force Off**: Turn off the target entity
  - **Defer**: Wait until condition is met

### Examples

#### Basic Lighting Schedule
```yaml
type: custom:timer-24h-card
title: "Living Room Lights"
show_preview: true
```

#### Compact Schedule Viewer
```yaml
type: custom:timer-24h-card
title: "Schedule Status"
compact_mode: true
show_conditions: false
```

#### Specific Schedule
```yaml
type: custom:timer-24h-card
title: "Garden Irrigation"
schedule_id: "garden_main"
```

## Internationalization

The card automatically detects your Home Assistant language and displays text accordingly. Supported languages:

- **English** (en)
- **Spanish** (es) 
- **French** (fr)

To force a specific language:
```yaml
type: custom:timer-24h-card
language: "es"
```

## Troubleshooting

### Card doesn't appear
- Ensure Timer 24H Integration is installed and configured
- Check that the resource is properly added to Lovelace
- Clear browser cache (Ctrl+F5)

### Schedule changes don't save
- Verify the target entity exists and is controllable
- Check Home Assistant logs for integration errors
- Ensure you have permission to call Timer 24H services

### Conditions not working
- Verify condition entities exist and have the expected states
- Check the condition policy settings
- Use the integration's sensor entities to debug condition evaluation

## Development

To build the card from source:

```bash
cd www/timer-24h-card
npm install
npm run build
```

## Support

- **Issues**: [GitHub Issues](https://github.com/home-assistant-community/timer-24h/issues)
- **Discussions**: [GitHub Discussions](https://github.com/home-assistant-community/timer-24h/discussions)
- **Documentation**: [Wiki](https://github.com/home-assistant-community/timer-24h/wiki)

## License

MIT License - see LICENSE file for details.
