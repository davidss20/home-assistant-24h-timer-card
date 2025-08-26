import {
  LitElement,
  html,
  css,
  CSSResultGroup,
  TemplateResult,
  PropertyValues,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCard, LovelaceCardConfig } from 'custom-card-helpers';

// Types
interface Timer24HCardConfig extends LovelaceCardConfig {
  title?: string;
  home_sensors?: string[];
  home_logic?: 'OR' | 'AND';
  entities?: string[];
  save_state?: boolean;
  storage_entity_id?: string;
  auto_create_helper?: boolean;
  allow_local_fallback?: boolean;
}

interface TimeSlot {
  hour: number;
  minute: number;
  isActive: boolean;
}



// Validation schema
interface SchemaProperty {
  type: string;
  optional: boolean;
  enum?: string[];
}

const CARD_CONFIG_SCHEMA: Record<string, SchemaProperty> = {
  title: { type: 'string', optional: true },
  home_sensors: { type: 'array', optional: true },
  home_logic: { type: 'string', enum: ['OR', 'AND'], optional: true },
  entities: { type: 'array', optional: true },
  save_state: { type: 'boolean', optional: true },
  storage_entity_id: { type: 'string', optional: true },
  auto_create_helper: { type: 'boolean', optional: true },
  allow_local_fallback: { type: 'boolean', optional: true }
};

@customElement('timer-24h-card')
export class Timer24HCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private config!: Timer24HCardConfig;
  @state() private timeSlots: TimeSlot[] = [];
  @state() private currentTime: Date = new Date();
  @state() private isSystemActive: boolean = false;
  
  private lastControlledStates = new Map<string, boolean>();
  private lastHomeStatus?: boolean;
  private updateInterval?: number;

  // Grid support
  public static getLayoutOptions() {
    return {
      grid_rows: 2,
      grid_columns: 6,
      grid_min_rows: 2,
      grid_min_columns: 3
    };
  }

  public getCardSize(): number {
    return 3;
  }

  public static async getConfigElement() {
    // Dynamically import the editor for Home Assistant
    await import('./timer-24h-card-editor.js');
    return document.createElement('timer-24h-card-editor');
  }

  public static getStubConfig(): Timer24HCardConfig {
    return {
      title: '24 Hour Timer',
      home_sensors: [],
      home_logic: 'OR',
      entities: [],
      save_state: true
    };
  }



  constructor() {
    super();
    this.timeSlots = this.initializeTimeSlots();
  }

  public setConfig(config: Timer24HCardConfig): void {
    this.validateConfig(config);
    this.config = {
      title: '24 Hour Timer',
      home_sensors: [],
      home_logic: 'OR',
      entities: [],
      save_state: true,
      ...config
    };
    this.loadSavedState();
  }

  private validateConfig(config: Timer24HCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration: config is required');
    }

    // Validate each property
    Object.entries(CARD_CONFIG_SCHEMA).forEach(([key, schema]) => {
      const value = (config as any)[key];
      
      if (value !== undefined) {
        if (schema.type === 'string' && typeof value !== 'string') {
          throw new Error(`Invalid configuration: ${key} must be a string`);
        }
        if (schema.type === 'boolean' && typeof value !== 'boolean') {
          throw new Error(`Invalid configuration: ${key} must be a boolean`);
        }
        if (schema.type === 'array' && !Array.isArray(value)) {
          throw new Error(`Invalid configuration: ${key} must be an array`);
        }
        if (schema.enum && !schema.enum.includes(value)) {
          throw new Error(`Invalid configuration: ${key} must be one of ${schema.enum.join(', ')}`);
        }
      } else if (!schema.optional) {
        throw new Error(`Invalid configuration: ${key} is required`);
      }
    });

    // Validate entities exist in hass (if available)
    if (this.hass && config.entities) {
      const invalidEntities = config.entities.filter(entityId => !this.hass.states[entityId]);
      if (invalidEntities.length > 0) {
        console.warn(`Timer Card: Some entities not found: ${invalidEntities.join(', ')}`);
      }
    }
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    
    if (changedProps.has('hass') && this.hass) {
      const oldSystemStatus = this.isSystemActive;
      this.checkSystemStatus();
      
      // Only run control if system status changed
      if (oldSystemStatus !== this.isSystemActive) {
        this.controlEntities();
      }
      
      this.updateCurrentTime();
    }
  }

  
  private generateCardId(): string {
    const title = this.config?.title || 'Timer 24H';
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  private getStorageEntityId(): string {
    if (this.config?.storage_entity_id) return this.config.storage_entity_id;
    const cardId = this.generateCardId();
    return `input_text.timer_24h_card_${cardId}`;
  }

  private async ensureEntityExists(cardTitle: string): Promise<void> {
    const entityId = this.getStorageEntityId();
    if (this.hass?.states?.[entityId]) return;
    // Try to create helper via WebSocket (HA Admin required)
    try {
      await (this.hass as any).callWS?.({
        type: 'input_text/create',
        name: 'Timer 24H Card - 24 Hour Timer',
        initial: '{}',
        max: 10000,
        // Some HA versions support 'id' or 'icon'; we keep minimal fields
      });
    } catch (e) {
      // Swallow: on some HA versions WS create may not be available
      console.warn('Timer Card: input_text/create WS failed (non-fatal)', e);
    }
  }

  private async bootstrapServerStorage(): Promise<void> {
    if (!this.config?.save_state) return;
    if (!this.hass) return;
    const entityId = this.getStorageEntityId();
    if (!this.hass.states[entityId] && this.config.auto_create_helper !== false) {
      await this.ensureEntityExists(this.config.title ?? 'Timer 24H');
    }
    // Initialize with "{}" if empty
    try {
      const st = this.hass.states[entityId]?.state;
      if (!st || st === 'unknown' || st === '') {
        await this.hass.callService('input_text', 'set_value', { entity_id: entityId, value: '{}' });
      }
    } catch (e) {
      console.warn('Timer Card: bootstrap set_value failed', e);
    }
  }
connectedCallback(): void {
    super.connectedCallback();
    this.startTimer();
    // Auto-bootstrap server storage and subscribe to immediate state changes
    this.bootstrapServerStorage();
    try {
      const targetId = this.getStorageEntityId();
      (this.hass as any)?.connection?.subscribeEvents?.((ev: any) => {
        if (ev?.data?.entity_id === targetId) {
          const st = this.hass.states[targetId];
          if (st?.state) {
            try {
              const data = JSON.parse(st.state);
              if (Array.isArray(data?.timeSlots)) {
                this.timeSlots = data.timeSlots;
                this.requestUpdate();
              }
            } catch {}
          }
        }
      }, 'state_changed');
    } catch (e) {
      console.warn('Timer Card: subscribeEvents failed', e);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  private initializeTimeSlots(): TimeSlot[] {
    const slots: TimeSlot[] = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push({ hour, minute: 0, isActive: false });
      slots.push({ hour, minute: 30, isActive: false });
    }
    return slots;
  }

  private startTimer(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = window.setInterval(() => {
      this.updateCurrentTime();
    }, 120000); // Check every 2 minutes
  }

  private checkSystemStatus(): void {
    if (!this.hass || !this.config.home_sensors?.length) {
      this.isSystemActive = true; // Default - system active
      return;
    }

    const logic = this.config.home_logic || 'OR';
    let systemStatus = logic === 'AND';
    
    for (const sensorId of this.config.home_sensors) {
      const sensor = this.hass.states[sensorId];
      if (!sensor) continue;
      
      let isTrue: boolean;
      
      // Special handling for jewish calendar sensor
      if (sensorId === 'binary_sensor.jewish_calendar_issur_melacha_in_effect') {
        // For this sensor: 'on' means there IS an issur melacha (restriction), so system should be ACTIVE
        // 'off' means there is NO issur melacha, so system should be INACTIVE
        isTrue = sensor.state.toLowerCase() === 'on';
      } else {
        isTrue = ['on', 'home', 'true', '1', 'yes'].includes(sensor.state.toLowerCase());
      }
      
      if (logic === 'OR') {
        if (isTrue) {
          systemStatus = true;
          break;
        }
      } else { // AND
        if (!isTrue) {
          systemStatus = false;
          break;
        }
      }
    }
    
    this.isSystemActive = systemStatus;
    
    // Debug logging (only when status changes)
    if (this.lastHomeStatus !== homeStatus) {
      console.log(`Timer Card - Home Status changed to: ${homeStatus ? 'At Home' : 'Away'}`);
      this.lastHomeStatus = homeStatus;
    }
  }

  private updateCurrentTime(): void {
    const newTime = new Date();
    const oldHour = this.currentTime.getHours();
    const oldMinute = Math.floor(this.currentTime.getMinutes() / 30) * 30;
    const newHour = newTime.getHours();
    const newMinute = Math.floor(newTime.getMinutes() / 30) * 30;
    
    this.currentTime = newTime;
    
    // Only control entities if time segment changed
    if (oldHour !== newHour || oldMinute !== newMinute) {
      console.log(`Timer Card: Time segment changed to ${newHour}:${newMinute === 0 ? '00' : '30'}`);
      this.controlEntities();
    }
  }

  private controlEntities(): void {
    if (!this.hass || !this.config.entities?.length || !this.isSystemActive) {
      return;
    }

    const currentHour = this.currentTime.getHours();
    const currentMinute = this.currentTime.getMinutes();
    const minute = currentMinute < 30 ? 0 : 30;
    
    const currentSlot = this.timeSlots.find(slot => 
      slot.hour === currentHour && slot.minute === minute
    );
    
    const shouldBeOn = currentSlot?.isActive || false;
    
    // Control entities
    for (const entityId of this.config.entities) {
      const entity = this.hass.states[entityId];
      if (!entity) continue;
      
      const currentState = entity.state === 'on';
      const lastControlledState = this.lastControlledStates.get(entityId);
      
      // Only send command if state differs and we haven't sent this command
      if (currentState !== shouldBeOn && lastControlledState !== shouldBeOn) {
        try {
          this.hass.callService('homeassistant', shouldBeOn ? 'turn_on' : 'turn_off', {
            entity_id: entityId
          });
          console.log(`Timer Card: ${shouldBeOn ? 'Turned on' : 'Turned off'} ${entityId}`);
          
          // Remember what command we sent
          this.lastControlledStates.set(entityId, shouldBeOn);
          
          // Clear the memory after some time
          setTimeout(() => {
            if (this.lastControlledStates.get(entityId) === shouldBeOn) {
              this.lastControlledStates.delete(entityId);
            }
          }, 30000);
          
        } catch (error) {
          console.error(`Timer Card: Failed to control ${entityId}:`, error);
        }
      }
    }
  }

  private toggleTimeSlot(hour: number, minute: number): void {
    const slot = this.timeSlots.find(s => s.hour === hour && s.minute === minute);
    if (slot) {
      slot.isActive = !slot.isActive;
      this.saveState();
      this.requestUpdate();
      
      // Clear control memory when manually changing settings
      this.lastControlledStates.clear();
      this.controlEntities();
      this.requestUpdate();
    }
  }

  private saveState(): void {
    if (!this.config?.save_state) return;
    const entityId = this.getStorageEntityId();
    const jsonData = JSON.stringify({ timeSlots: this.timeSlots, timestamp: Date.now(), version: 1 });
    try {
      if (!this.hass.states[entityId] && this.config.auto_create_helper !== false) {
        this.ensureEntityExists(this.config.title ?? 'Timer 24H');
      }
      this.hass.callService('input_text','set_value',{ entity_id: entityId, value: jsonData });
    } catch (e) {
      console.warn('Timer Card: server save failed', e);
    }
    if (this.config.allow_local_fallback !== false) {
      try { localStorage.setItem(`timer-24h-${this.config.title}`, JSON.stringify(this.timeSlots)); } catch {}
    }
  }

  private loadSavedState(): void {
    if (!this.config?.save_state) return;
    const entityId = this.getStorageEntityId();
    try {
      const st = this.hass?.states?.[entityId]?.state;
      if (st && st !== 'unknown' && st !== '{}') {
        const data = JSON.parse(st);
        if (Array.isArray(data?.timeSlots)) {
          this.timeSlots = data.timeSlots;
          return;
        }
      }
    } catch (error) {
      console.warn('Timer Card: failed to read server state', error);
    }
    if (this.config.allow_local_fallback !== false) {
      const saved = localStorage.getItem(`timer-24h-${this.config.title}`);
      if (saved) {
        try {
          const arr = JSON.parse(saved);
          if (Array.isArray(arr)) this.timeSlots = arr;
        } catch (error) {
          console.error('Timer Card: Failed to load local fallback:', error);
        }
      }
    }
  }

  private createSectorPath(hour: number, totalSectors: number, innerRadius: number, outerRadius: number, centerX: number, centerY: number): string {
    const startAngle = (hour * 360 / totalSectors - 90) * (Math.PI / 180);
    const endAngle = ((hour + 1) * 360 / totalSectors - 90) * (Math.PI / 180);
    
    const x1 = centerX + innerRadius * Math.cos(startAngle);
    const y1 = centerY + innerRadius * Math.sin(startAngle);
    const x2 = centerX + outerRadius * Math.cos(startAngle);
    const y2 = centerY + outerRadius * Math.sin(startAngle);
    const x3 = centerX + outerRadius * Math.cos(endAngle);
    const y3 = centerY + outerRadius * Math.sin(endAngle);
    const x4 = centerX + innerRadius * Math.cos(endAngle);
    const y4 = centerY + innerRadius * Math.sin(endAngle);
    
    const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;
    
    return `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1} ${y1}`;
  }

  private getTextPosition(hour: number, totalSectors: number, radius: number, centerX: number, centerY: number): { x: number; y: number } {
    const angle = ((hour + 0.5) * 360 / totalSectors - 90) * (Math.PI / 180);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { x, y };
  }

  private getTimeLabel(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }



  protected render(): TemplateResult {
    const centerX = 200;
    const centerY = 200;
    const outerRadius = 180;
    const innerRadius = 50;

    return html`
      <ha-card>
        <div class="header">
          <div class="title">${this.config.title}</div>
          <div class="system-status ${this.isSystemActive ? 'active' : 'inactive'}">
            ${this.isSystemActive ? 'מופעל' : 'מושבת'}
          </div>
        </div>
        
        <div class="timer-container">
          <svg class="timer-svg" viewBox="0 0 400 400">
            <!-- Border circles -->
            <circle cx="${centerX}" cy="${centerY}" r="${outerRadius}" 
                    fill="none" stroke="var(--divider-color)" stroke-width="2"/>
            <circle cx="${centerX}" cy="${centerY}" r="${innerRadius}" 
                    fill="none" stroke="var(--divider-color)" stroke-width="2"/>
            
            <!-- Dividing lines (only in outer ring) -->
            ${Array.from({ length: 24 }, (_, i) => {
              const angle = (i * 360 / 24 - 90) * (Math.PI / 180);
              const xInner = centerX + innerRadius * Math.cos(angle);
              const yInner = centerY + innerRadius * Math.sin(angle);
              const xOuter = centerX + outerRadius * Math.cos(angle);
              const yOuter = centerY + outerRadius * Math.sin(angle);
              return html`<line x1="${xInner}" y1="${yInner}" x2="${xOuter}" y2="${yOuter}" 
                               stroke="var(--divider-color)" stroke-width="1"/>`;
            })}
            
            <!-- Outer sectors -->
            ${Array.from({ length: 24 }, (_, hour) => {
              const sectorPath = this.createSectorPath(hour, 24, innerRadius, outerRadius, centerX, centerY);
              const textPos = this.getTextPosition(hour, 24, (innerRadius + outerRadius) / 2, centerX, centerY);
              const slot = this.timeSlots.find(s => s.hour === hour && s.minute === 0);
              const isActive = slot?.isActive || false; // Buttons show user settings
              const isCurrent = this.currentTime.getHours() === hour && this.currentTime.getMinutes() < 30;
              
              return html`
                <path d="${sectorPath}" 
                      fill="${isActive ? 'var(--primary-color)' : 'var(--card-background-color)'}"
                      stroke="${isCurrent ? 'var(--accent-color)' : 'var(--divider-color)'}"
                      stroke-width="${isCurrent ? '3' : '1'}"
                      style="cursor: pointer; transition: opacity 0.2s;"
                      @click="${() => this.toggleTimeSlot(hour, 0)}"/>
                <text x="${textPos.x}" y="${textPos.y + 3}" 
                      text-anchor="middle" font-size="10" font-weight="bold"
                      style="pointer-events: none; user-select: none; font-weight: bold;"
                      fill="${isActive ? 'var(--text-primary-color)' : 'var(--primary-text-color)'}">
                  ${this.getTimeLabel(hour, 0)}
                </text>
              `;
            })}
            
            <!-- Inner sectors -->
            ${Array.from({ length: 24 }, (_, hour) => {
              const sectorPath = this.createSectorPath(hour, 24, 50, innerRadius, centerX, centerY);
              const textPos = this.getTextPosition(hour, 24, (50 + innerRadius) / 2, centerX, centerY);
              const slot = this.timeSlots.find(s => s.hour === hour && s.minute === 30);
              const isActive = slot?.isActive || false; // Buttons show user settings
              const isCurrent = this.currentTime.getHours() === hour && this.currentTime.getMinutes() >= 30;
              
              return html`
                <path d="${sectorPath}" 
                      fill="${isActive ? 'var(--primary-color)' : 'var(--card-background-color)'}"
                      stroke="${isCurrent ? 'var(--accent-color)' : 'var(--divider-color)'}"
                      stroke-width="${isCurrent ? '3' : '1'}"
                      style="cursor: pointer; transition: opacity 0.2s;"
                      @click="${() => this.toggleTimeSlot(hour, 30)}"/>
                <text x="${textPos.x}" y="${textPos.y + 2}" 
                      text-anchor="middle" font-size="8" font-weight="bold"
                      style="pointer-events: none; user-select: none; font-weight: bold;"
                      fill="${isActive ? 'var(--text-primary-color)' : 'var(--primary-text-color)'}">
                  ${this.getTimeLabel(hour, 30)}
                </text>
              `;
            })}
          </svg>
        </div>
      </ha-card>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
        font-family: var(--primary-font-family, sans-serif);
      }
      
      ha-card {
        padding: 0;
        overflow: hidden;
        height: 100%;
        min-height: 200px;
        display: flex;
        flex-direction: column;
        container-type: inline-size;
      }
      
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        padding: 4px 8px 0 8px;
      }
      
      .title {
        font-size: 1rem;
        font-weight: bold;
        color: var(--primary-text-color);
      }
      
      .home-status {
        font-size: 0.7rem;
        text-align: center;
        margin: 0;
      }
      
      .home-status.home {
        color: var(--success-color, #10b981);
      }
      
      .home-status.away {
        color: var(--warning-color, #f59e0b);
      }
      
      .timer-container {
        display: flex;
        justify-content: center;
        margin: 0;
        padding: 0;
        flex: 1;
        min-height: 0;
      }
      
      .timer-svg {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        display: block;
        object-fit: contain;
      }
      
      .sector {
        cursor: pointer;
        transition: opacity 0.2s;
      }
      
      .sector:hover {
        opacity: 0.8;
      }
      
      .sector-text {
        pointer-events: none;
        user-select: none;
        font-weight: bold;
      }
      
      /* Responsive adjustments */
      @container (max-width: 250px) {
        .header {
          padding: 1px 2px 0 2px;
          margin-bottom: 1px;
        }
        
        .title {
          font-size: 0.8rem;
        }
        
        .home-status {
          font-size: 0.6rem;
        }
        
        .sector-text {
          font-size: 6px !important;
        }
      }
      
      @container (min-width: 400px) {
        .title {
          font-size: 1.1rem;
        }
        
        .home-status {
          font-size: 0.8rem;
        }
        
        .header {
          padding: 6px 10px 0 10px;
        }
      }
      
      @container (min-width: 600px) {
        .title {
          font-size: 1.3rem;
        }
        
        .home-status {
          font-size: 0.9rem;
        }
        
        .header {
          padding: 8px 12px 0 12px;
        }
      }
    `;
  }
}

// Card info for Home Assistant
console.info(
  '%c  TIMER-24H-CARD  %c  Version 2.0.0  ',
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// Register card for HACS and Home Assistant UI
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'timer-24h-card',
  name: 'Timer 24H Card',
  description: '24 Hour Timer Card with automatic entity control',
  preview: true,
  documentationURL: 'https://github.com/davidss20/home-assistant-timer-card'
});
