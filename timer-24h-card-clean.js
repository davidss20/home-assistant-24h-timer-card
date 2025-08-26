import { LitElement, html, css } from 'https://unpkg.com/lit@3/index.js?module';

class Timer24HCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      timeSlots: { type: Array }
    };
  }

  static get layoutOptions() {
    return {
      grid_rows: 3,
      grid_columns: 3,
      grid_min_rows: 3,
      grid_min_columns: 3
    };
  }

  // Home Assistant required methods
  // GUI editor disabled - use YAML configuration only
  // static async getConfigElement() {
  //   return null;
  // }

  static getStubConfig() {
    // Generate unique storage entity ID
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const uniqueId = `timer_24h_card_${timestamp}_${random}`;
    
    return {
      title: 'Timer 24H',
      home_logic: 'OR',
      entities: [],
      home_sensors: [],
      save_state: true, // Always save to server
      storage_entity_id: `input_text.${uniqueId}`,
      auto_create_helper: true,
      allow_local_fallback: true
    };
  }

  // Layout support
  get layout() {
    return this._layout || {
      grid_rows: 3,
      grid_columns: 3,
      grid_min_rows: 3,
      grid_min_columns: 3
    };
  }

  set layout(layout) {
    this._layout = layout;
    this.requestUpdate();
  }

  getLayoutOptions() {
    return {
      grid_rows: 3,
      grid_columns: 3,
      grid_min_rows: 3,
      grid_min_columns: 3
    };
  }

  constructor() {
    super();
    this.timeSlots = this.initializeTimeSlots();
    this.config = {};
    this.updateInterval = null;
    this.syncInterval = null;
    this._layout = {
      grid_rows: 3,
      grid_columns: 3,
      grid_min_rows: 3,
      grid_min_columns: 3
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this.startUpdateLoop();
    this.setupAutoSync();
  }

  startUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.updateInterval = setInterval(() => {
      this.requestUpdate();
    }, 60000); // עדכון כל דקה
  }

  setupAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(async () => {
      if (this.config?.save_state && this.config?.storage_entity_id && this.hass) {
        try {
          const serverData = await this.loadFromServer();
          if (serverData && serverData.timeSlots && Array.isArray(serverData.timeSlots)) {
            // Check if there's a change in data
            if (JSON.stringify(this.timeSlots) !== JSON.stringify(serverData.timeSlots)) {
              console.log('Timer Card: Server data changed, updating local state');
              this.timeSlots = serverData.timeSlots;
              this.requestUpdate();
            }
          }
        } catch (error) {
          // שגיאות סינכרון לא קריטיות
        }
      }
    }, 60000); // כל דקה
  }

  disconnectedCallback() {
    super.disconnectedCallback && super.disconnectedCallback();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Cleanup helper entities when card is removed
    this._scheduleCleanup();
  }

  _scheduleCleanup() {
    // Wait a bit to see if card is reconnected (e.g., during refresh)
    setTimeout(() => {
      if (!this.isConnected && this.config?.storage_entity_id && this.hass) {
        this._cleanupHelperEntity();
      }
    }, 5000); // Wait 5 seconds
  }

  async _cleanupHelperEntity() {
    try {
      const entityId = this.config.storage_entity_id;
      
      // Check if entity still exists and was created by us
      if (!this.hass.states[entityId]) {
        return; // Already deleted
      }

      // Only delete if it's our timer card entity
      if (!entityId.includes('timer_24h_card_')) {
        return; // Not our entity
      }

      console.log(`Timer Card: Cleaning up helper entity: ${entityId}`);

      // Try to delete via WebSocket API
      try {
        await this.hass.callWS({
          type: 'config/input_text/delete',
          entity_id: entityId.replace('input_text.', '')
        });
        console.log(`✅ Timer Card: Successfully deleted helper entity: ${entityId}`);
      } catch (wsError) {
        // Try alternative API
        try {
          await this.hass.callWS({
            type: 'config/helpers/delete',
            entity_id: entityId
          });
          console.log(`✅ Timer Card: Successfully deleted helper entity via legacy API: ${entityId}`);
        } catch (legacyError) {
          console.warn(`Timer Card: Could not auto-delete helper entity ${entityId}. Please delete manually.`);
        }
      }

    } catch (error) {
      console.warn('Timer Card: Error during cleanup:', error);
    }
  }

  setConfig(config) {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    
    // Safe config merging with validation
    this.config = {
              title: '24 Hour Timer',
      home_sensors: [],
      home_logic: 'OR',
      entities: [],
      save_state: true
    };
    
    // Safely merge user config
    try {
      if (config.title && typeof config.title === 'string') {
        this.config.title = config.title;
      }
      if (config.home_logic === 'AND' || config.home_logic === 'OR') {
        this.config.home_logic = config.home_logic;
      }
      if (config.entities && Array.isArray(config.entities)) {
        this.config.entities = config.entities.filter(e => e && typeof e === 'string');
      }
      if (config.home_sensors && Array.isArray(config.home_sensors)) {
        this.config.home_sensors = config.home_sensors.filter(s => s && typeof s === 'string');
      }
      if (typeof config.save_state === 'boolean') {
        this.config.save_state = config.save_state;
      }
      if (config.storage_entity_id && typeof config.storage_entity_id === 'string') {
        this.config.storage_entity_id = config.storage_entity_id;
      }
      if (typeof config.auto_create_helper === 'boolean') {
        this.config.auto_create_helper = config.auto_create_helper;
      }
      if (typeof config.allow_local_fallback === 'boolean') {
        this.config.allow_local_fallback = config.allow_local_fallback;
      }
    } catch (e) {
      console.warn('Timer Card: Config validation error, using defaults:', e);
    }
    
    // Load saved state asynchronously
    this.loadSavedState().then(() => {
      if (this.shadowRoot) {
        this.render();
      }
    }).catch(error => {
      console.error('Timer Card: Error loading saved state:', error);
      // Ensure timeSlots is still an array even if loading fails
      if (!Array.isArray(this.timeSlots)) {
        this.timeSlots = this.initializeTimeSlots();
      }
      if (this.shadowRoot) {
        this.render();
      }
    });
  }

  set hass(hass) {
    this._hass = hass;
    this.requestUpdate();
  }

  get hass() {
    return this._hass;
  }

  initializeTimeSlots() {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push({
          hour,
          minute,
          active: false
        });
      }
    }
    return slots;
  }

  async loadSavedState() {
    try {
      let savedData = null;
      
      // Try Frontend Storage first (server-side)
      if (this.hass && this.config?.storage_entity_id) {
        try {
          const response = await this.hass.connection.sendMessagePromise({
            type: 'frontend/get_user_data',
            key: this.config.storage_entity_id
          });
          if (response && response.value) {
            savedData = JSON.parse(response.value);
            console.log('Timer Card: Loaded from Frontend Storage');
          }
        } catch (frontendError) {
          console.log('Timer Card: Frontend Storage not available, trying notification fallback');
          
          // Try to load from persistent notifications as fallback
          try {
            const notifications = await this.hass.callWS({ type: 'persistent_notification/get' });
            const timerNotification = notifications.find(n => n.notification_id === this.config.storage_entity_id);
            if (timerNotification && timerNotification.message) {
              savedData = JSON.parse(timerNotification.message);
              console.log('Timer Card: Loaded from Persistent Notifications');
            }
          } catch (notificationError) {
            console.log('Timer Card: Persistent notifications not available');
          }
        }
      }
      
      // Fallback to localStorage if server storage fails
      if (!savedData && this.config?.allow_local_fallback !== false) {
        const localKey = `timer-24h-${this.config?.storage_entity_id || 'default'}`;
        const localData = localStorage.getItem(localKey);
        if (localData) {
          savedData = JSON.parse(localData);
          console.log('Timer Card: Loaded from localStorage');
        }
      }
      
      if (savedData && savedData.timeSlots && Array.isArray(savedData.timeSlots)) {
        this.timeSlots = savedData.timeSlots;
      }
    } catch (error) {
      console.warn('Timer Card: Error loading saved state:', error);
    }
  }

  async saveState() {
    const data = {
      timeSlots: this.timeSlots,
      timestamp: Date.now()
    };

    try {
      // Priority 1: Frontend Storage (server-side)
      if (this.hass && this.config?.storage_entity_id) {
        try {
          await this.hass.connection.sendMessagePromise({
            type: 'frontend/set_user_data',
            key: this.config.storage_entity_id,
            value: JSON.stringify(data)
          });
          console.log('✅ Timer Card: Saved to Frontend Storage (server-side)');
          return;
        } catch (frontendError) {
          console.log('Timer Card: Frontend Storage failed, trying notification fallback');
          
          // Fallback: Persistent Notifications
          try {
            await this.hass.callService('persistent_notification', 'create', {
              notification_id: this.config.storage_entity_id,
              title: 'Timer 24H Card Data',
              message: JSON.stringify(data)
            });
            console.log('✅ Timer Card: Saved to Persistent Notifications');
            return;
          } catch (notificationError) {
            console.warn('Timer Card: Persistent notification fallback failed:', notificationError);
          }
        }
      }
    } catch (error) {
      console.error('❌ Timer Card: Failed to save to Home Assistant:', error);
    }

    // Final fallback: localStorage
    if (this.config?.allow_local_fallback !== false) {
      try {
        const localKey = `timer-24h-${this.config?.storage_entity_id || 'default'}`;
        localStorage.setItem(localKey, JSON.stringify(data));
        console.log('💾 Timer Card: Saved to localStorage as fallback');
      } catch (localError) {
        console.error('❌ Timer Card: Even localStorage failed:', localError);
      }
    }
  }

  async loadFromServer() {
    try {
      if (!this.hass || !this.config?.storage_entity_id) return null;
      
      // Try Frontend Storage first
      try {
        const response = await this.hass.connection.sendMessagePromise({
          type: 'frontend/get_user_data',
          key: this.config.storage_entity_id
        });
        if (response && response.value) {
          return JSON.parse(response.value);
        }
      } catch (frontendError) {
        // Try persistent notifications fallback
        const notifications = await this.hass.callWS({ type: 'persistent_notification/get' });
        const timerNotification = notifications.find(n => n.notification_id === this.config.storage_entity_id);
        if (timerNotification && timerNotification.message) {
          return JSON.parse(timerNotification.message);
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Timer Card: Error loading from server:', error);
      return null;
    }
  }

  toggleTimeSlot(hour, minute) {
    const slot = this.timeSlots.find(s => s.hour === hour && s.minute === minute);
    if (slot) {
      slot.active = !slot.active;
      this.saveState();
      this.requestUpdate();
    }
  }

  isCurrentlyActive() {
    if (!Array.isArray(this.config.home_sensors) || this.config.home_sensors.length === 0) {
      return this.isTimeSlotActive();
    }

    const sensorStates = this.config.home_sensors.map(sensorId => {
      const entity = this.hass?.states[sensorId];
      if (!entity) return false;
      
      // Special handling for jewish calendar sensor
      if (sensorId === 'binary_sensor.jewish_calendar_issur_melacha_in_effect') {
        // For this sensor: 'on' means there IS an issur melacha (restriction), so system should be ACTIVE
        // 'off' means there is NO issur melacha, so system should be INACTIVE
        return entity.state?.toLowerCase() === 'on';
      }
      
      return ['on', 'home', 'true', 'active', 'detected'].includes(entity.state?.toLowerCase());
    });

        const isSystemActive = this.config.home_logic === 'AND'
      ? sensorStates.every(state => state)
      : sensorStates.some(state => state);

    return isSystemActive && this.isTimeSlotActive();
  }

  isTimeSlotActive() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const currentSlot = this.timeSlots.find(slot => {
      const slotStart = slot.hour * 60 + slot.minute;
      const slotEnd = slotStart + 30;
      const currentTime = currentHour * 60 + currentMinute;
      
      return currentTime >= slotStart && currentTime < slotEnd;
    });
    
    return currentSlot?.active || false;
  }

  async controlEntities(turnOn) {
    if (!this.config.entities || this.config.entities.length === 0) {
      return;
    }

    const promises = this.config.entities.map(async (entityId) => {
      try {
        const entity = this.hass?.states[entityId];
        if (!entity) {
          console.warn(`Entity not found: ${entityId}`);
          return;
        }

        const domain = entityId.split('.')[0];
        let service, serviceData;

        switch (domain) {
          case 'switch':
          case 'input_boolean':
            service = turnOn ? 'turn_on' : 'turn_off';
            serviceData = { entity_id: entityId };
            await this.hass.callService(domain, service, serviceData);
            break;
          case 'light':
            service = turnOn ? 'turn_on' : 'turn_off';
            serviceData = { entity_id: entityId };
            await this.hass.callService(domain, service, serviceData);
            break;
          case 'climate':
            if (turnOn) {
              await this.hass.callService('climate', 'set_hvac_mode', {
                entity_id: entityId,
                hvac_mode: 'heat'
              });
            } else {
              await this.hass.callService('climate', 'set_hvac_mode', {
                entity_id: entityId,
                hvac_mode: 'off'
              });
            }
            break;
          case 'script':
            if (turnOn) {
              await this.hass.callService('script', 'turn_on', { entity_id: entityId });
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to control ${entityId}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  static get styles() {
    return css`
      :host {
        position: relative;
        contain: layout style paint;
        margin: 8px;
        display: block;
        height: calc(100% - 16px);
      }
      
      .card {
        position: relative;
        z-index: 1;
        isolation: isolate;
        margin: 8px;
        height: calc(100% - 16px);
        background: var(--card-background-color, white);
        border-radius: var(--ha-card-border-radius, 8px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.1));
        padding: 16px;
        display: flex;
        flex-direction: column;
      }
      
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        flex-shrink: 0;
      }
      
      .title {
        font-size: 1.2em;
        font-weight: 500;
        color: var(--primary-text-color);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .icon {
        width: 24px;
        height: 24px;
      }
      
      .sync-status {
        font-size: 0.8em;
        color: var(--secondary-text-color);
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .timer-container {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
      }
      
      .timer-circle {
        width: 280px;
        height: 280px;
        position: relative;
      }
      
      .timer-svg {
        width: 100%;
        height: 100%;
      }
      
      .center-indicator {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        pointer-events: none;
      }
      
      .status-text {
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 4px;
      }
      
      .status-on {
        color: #4CAF50;
      }
      
      .status-off {
        color: #f44336;
        opacity: 0.6;
      }
      
      .current-time {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      
      .time-slot {
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .time-slot:hover {
        stroke-width: 3;
      }
      
      .time-slot.active {
        fill: #4CAF50;
        stroke: #388E3C;
      }
      
      .time-slot.inactive {
        fill: #E0E0E0;
        stroke: #BDBDBD;
      }
      
      .time-label {
        font-size: 10px;
        fill: var(--primary-text-color);
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
      }
    `;
  }

  render() {
    const now = new Date();
    const isCurrentlyActive = this.isCurrentlyActive();
    const currentTimeStr = now.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return html`
      <div class="card">
        <div class="header">
          <div class="title">
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 11l8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" fill="#41BDF5" stroke="#41BDF5"/>
              <path d="M11 9h2" stroke="white" stroke-width="1.6"/>
              <circle cx="12" cy="15" r="3.5" stroke="white" stroke-width="1.6" fill="none"/>
              <path d="M12 15l2-2" stroke="white" stroke-width="1.6"/>
            </svg>
            ${this.config.title || '24 Hour Timer'}
          </div>
          <div class="sync-status">
            ${this.config.save_state ? '🌐 מסונכרן' : '💾 מקומי'}
          </div>
        </div>
        
        <div class="timer-container">
          <div class="timer-circle">
            <svg class="timer-svg" viewBox="0 0 400 400">
              ${this.renderTimeSlots()}
              ${this.renderHourLabels()}
            </svg>
            
            <div class="center-indicator">
              <div class="status-text ${isCurrentlyActive ? 'status-on' : 'status-off'}">
                ${isCurrentlyActive ? 'מופעל' : 'מושבת'}
              </div>
              <div class="current-time">${currentTimeStr}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

    renderTimeSlots() {
    const centerX = 200;
    const centerY = 200;
    const radius = 120;
    
    return this.timeSlots.map((slot, index) => {
      const angle = (index / 48) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
             // Buttons show user settings - only center indicator checks sensors
       const slotClass = slot.active ? 'active' : 'inactive';
      
      return html`
        <circle
          class="time-slot ${slotClass}"
          cx="${x}"
          cy="${y}"
          r="8"
          @click="${() => this.toggleTimeSlot(slot.hour, slot.minute)}"
        />
      `;
    });
  }

  renderHourLabels() {
    const centerX = 200;
    const centerY = 200;
    const radius = 90;
    
    const hours = [];
    for (let hour = 0; hour < 24; hour += 2) {
      const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      hours.push(html`
        <text
          class="time-label"
          x="${x}"
          y="${y}"
        >
          ${hour.toString().padStart(2, '0')}
        </text>
      `);
    }
    
    return hours;
  }

  // Static helper methods for editor integration
  static async ensureStorageEntity(hass, desiredId) {
    // This method is kept for compatibility but not used since we removed the editor
    return desiredId || `input_text.timer_24h_card_${Date.now()}`;
  }

  static async readStorage(hass, entityId) {
    // This method is kept for compatibility but not used since we removed the editor
    return {};
  }

  static async writeStorage(hass, entityId, data) {
    // This method is kept for compatibility but not used since we removed the editor
    return true;
  }

  static async deleteStorageEntity(hass, entityId) {
    // This method is kept for compatibility but not used since we removed the editor
    return true;
  }

  // Additional methods for Home Assistant compatibility
  updated(changedProperties) {
    super.updated && super.updated(changedProperties);
  }

  getCardSize() {
    return 3;
  }

  // Layout support methods
  static get layoutOptions() {
    return {
      grid_rows: 3,
      grid_columns: 3,
      grid_min_rows: 3,
      grid_min_columns: 3
    };
  }

  // Define layout as a property for Home Assistant
  static defineLayoutProperty() {
    if (!Timer24HCard.prototype.hasOwnProperty('layout')) {
      Object.defineProperty(Timer24HCard.prototype, 'layout', {
        get: function() {
          return this._layout || {
            grid_rows: 3,
            grid_columns: 3,
            grid_min_rows: 3,
            grid_min_columns: 3
          };
        },
        set: function(layout) {
          this._layout = layout;
          this.requestUpdate();
        },
        getLayoutOptions: function() {
          return {
            grid_rows: 3,
            grid_columns: 3,
            grid_min_rows: 3,
            grid_min_columns: 3
          };
        },
        enumerable: true,
        configurable: true
      });
    }
  }
}

console.info(
  '%c  TIMER-24H-CARD  %c  Version 2.1.0 - YAML Only  ',
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray'
);

// Register the card
customElements.define('timer-24h-card', Timer24HCard);

// Add to custom cards registry
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'timer-24h-card',
  name: 'Timer 24H Card',
  description: '24h timer with YAML configuration only',
  preview: true,
  documentationURL: 'https://github.com/davidss20/home-assistant-timer-card',
  // configurable: true, // GUI editor disabled - YAML only
  // Custom icon for HACS and card picker
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" role="img" aria-label="Home timer icon" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 11l8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" fill="#41BDF5" stroke="#41BDF5"/>
    <path d="M11 9h2" stroke="white" stroke-width="1.6"/>
    <circle cx="12" cy="15" r="3.5" stroke="white" stroke-width="1.6" fill="none"/>
    <path d="M12 15l2-2" stroke="white" stroke-width="1.6"/>
  </svg>`,
  // Alternative PNG icon for HACS
  iconUrl: './icon.png',
  // Grid layout support
  grid_options: {
    rows: 3,
    columns: 3,
    min_rows: 3,
    min_columns: 3
  }
});

// Define layout property
Timer24HCard.defineLayoutProperty();
