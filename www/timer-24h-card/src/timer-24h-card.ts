/**
 * Timer 24H Card for Home Assistant
 * 
 * A Lovelace card that provides a UI for managing 24-hour schedules
 * with server-side integration support.
 */

import { LitElement, html, css, CSSResultGroup, TemplateResult, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

// Types for Home Assistant
export interface HomeAssistant {
  config: any;
  connection: any;
  states: { [entity_id: string]: any };
  services: { [domain: string]: { [service: string]: any } };
  callService: (domain: string, service: string, data?: any) => Promise<any>;
  callWS: (message: any) => Promise<any>;
  localize: (key: string, ...args: any[]) => string;
  language: string;
  themes: any;
  user: any;
}

export interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: Timer24HCardConfig): void;
  getCardSize?(): number;
}

export interface LovelaceCardConfig {
  type: string;
  [key: string]: any;
}

export interface Timer24HCardConfig extends LovelaceCardConfig {
  title?: string;
  schedule_id?: string;
  show_preview?: boolean;
  show_conditions?: boolean;
  compact_mode?: boolean;
  language?: string;
}

export interface Schedule {
  schedule_id: string;
  target_entity_id: string;
  slots: boolean[];
  enabled: boolean;
  timezone?: string;
  conditions: Condition[];
}

export interface Condition {
  entity_id: string;
  expected?: string;
  policy: 'skip' | 'force_off' | 'defer';
}

export interface ScheduleState {
  desired_state?: boolean;
  last_applied_state?: boolean;
  last_condition_evaluation?: string;
  next_tick_time?: string;
}

// Load translations dynamically
class I18n {
  private static translations: { [lang: string]: any } = {};
  
  static async loadTranslations(lang: string): Promise<void> {
    if (this.translations[lang]) return;
    
    try {
      const response = await fetch(`/local/timer-24h-card/i18n/${lang}.json`);
      this.translations[lang] = await response.json();
    } catch (error) {
      console.warn(`Failed to load translations for ${lang}, falling back to English`);
      if (lang !== 'en') {
        await this.loadTranslations('en');
        this.translations[lang] = this.translations['en'];
      }
    }
  }
  
  static t(lang: string, key: string, ...args: any[]): string {
    const translations = this.translations[lang] || this.translations['en'] || {};
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      value = value?.[k];
      if (!value) break;
    }
    
    if (typeof value === 'string') {
      // Simple placeholder replacement
      return value.replace(/\{(\w+)\}/g, (match, placeholder) => {
        const index = parseInt(placeholder);
        return !isNaN(index) && args[index] !== undefined ? args[index] : match;
      });
    }
    
    return key; // Return key if translation not found
  }
}

@customElement('timer-24h-card')
export class Timer24HCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private config!: Timer24HCardConfig;
  @state() private schedules: { [id: string]: Schedule } = {};
  @state() private selectedScheduleId?: string;
  @state() private currentSlot: number = 0;
  @state() private nextSlotTime?: string;
  @state() private loading = false;
  @state() private error?: string;
  @state() private language = 'en';

  // Grid support for dashboard layout
  public static getLayoutOptions() {
    return {
      grid_rows: 3,
      grid_columns: 6,
      grid_min_rows: 2,
      grid_min_columns: 3
    };
  }

  public getCardSize(): number {
    return this.config?.compact_mode ? 2 : 3;
  }

  public static async getConfigElement() {
    // Dynamically import the editor
    await import('./timer-24h-card-editor.js');
    return document.createElement('timer-24h-card-editor');
  }

  public static getStubConfig(): Timer24HCardConfig {
    return {
      type: 'custom:timer-24h-card',
      title: 'Timer 24H',
      show_preview: true,
      show_conditions: true,
      compact_mode: false
    };
  }

  public setConfig(config: Timer24HCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    this.config = {
      title: 'Timer 24H',
      show_preview: true,
      show_conditions: true,
      compact_mode: false,
      ...config
    };

    // Detect language
    this.language = config.language || this.hass?.language || 'en';
    
    // Load translations
    I18n.loadTranslations(this.language);
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    
    if (changedProps.has('hass') && this.hass) {
      this.loadSchedules();
    }
  }

  private async loadSchedules(): Promise<void> {
    if (!this.hass) return;

    try {
      this.loading = true;
      this.error = undefined;

      // Get all schedules via WebSocket
      const response = await this.hass.callWS({
        type: 'timer24h/list'
      });

      // Get detailed schedule data
      const schedulePromises = response.map(async (item: any) => {
        const detail = await this.hass.callWS({
          type: 'timer24h/get',
          schedule_id: item.schedule_id
        });
        return detail;
      });

      const scheduleDetails = await Promise.all(schedulePromises);
      
      // Build schedules object
      this.schedules = {};
      for (const detail of scheduleDetails) {
        if (detail && detail.schedule) {
          this.schedules[detail.schedule.schedule_id] = detail.schedule;
        }
      }

      // Get current time info
      const allStates = await this.hass.callWS({
        type: 'timer24h/get_all_states'
      });

      if (allStates) {
        this.currentSlot = allStates.current_slot;
        this.nextSlotTime = allStates.next_slot_time;
      }

      // Select first schedule if none selected
      if (!this.selectedScheduleId && Object.keys(this.schedules).length > 0) {
        this.selectedScheduleId = Object.keys(this.schedules)[0];
      }

    } catch (error) {
      console.error('Failed to load schedules:', error);
      this.error = I18n.t(this.language, 'messages.websocket_error');
    } finally {
      this.loading = false;
    }
  }

  private async toggleSlot(slotIndex: number): Promise<void> {
    if (!this.selectedScheduleId || !this.schedules[this.selectedScheduleId]) return;

    const schedule = this.schedules[this.selectedScheduleId];
    const newSlots = [...schedule.slots];
    newSlots[slotIndex] = !newSlots[slotIndex];

    try {
      await this.hass.callService('timer24h', 'set_schedule', {
        schedule_id: schedule.schedule_id,
        target_entity_id: schedule.target_entity_id,
        slots: newSlots,
        enabled: schedule.enabled,
        timezone: schedule.timezone
      });

      // Update local state
      schedule.slots = newSlots;
      this.requestUpdate();

    } catch (error) {
      console.error('Failed to update schedule:', error);
      this.error = I18n.t(this.language, 'messages.service_call_failed');
    }
  }

  private formatTime(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private getSlotTime(slotIndex: number): string {
    const hour = Math.floor(slotIndex / 2);
    const minute = (slotIndex % 2) * 30;
    return this.formatTime(hour, minute);
  }

  private renderScheduleSelector(): TemplateResult {
    const scheduleIds = Object.keys(this.schedules);
    
    if (scheduleIds.length === 0) {
      return html`
        <div class="no-schedules">
          ${I18n.t(this.language, 'card.no_schedules')}
        </div>
      `;
    }

    return html`
      <div class="schedule-selector">
        <select @change=${this.onScheduleChange}>
          ${scheduleIds.map(id => html`
            <option value="${id}" ?selected=${id === this.selectedScheduleId}>
              ${id} (${this.schedules[id].target_entity_id})
            </option>
          `)}
        </select>
      </div>
    `;
  }

  private onScheduleChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this.selectedScheduleId = select.value;
  }

  private renderTimeGrid(): TemplateResult {
    if (!this.selectedScheduleId || !this.schedules[this.selectedScheduleId]) {
      return html``;
    }

    const schedule = this.schedules[this.selectedScheduleId];
    const centerX = 200;
    const centerY = 200;
    const outerRadius = 180;
    const innerRadius = 50;

    return html`
      <div class="timer-container">
        <svg class="timer-svg" viewBox="0 0 400 400">
          <!-- Border circles -->
          <circle cx="${centerX}" cy="${centerY}" r="${outerRadius}" 
                  fill="none" stroke="var(--divider-color)" stroke-width="2"/>
          <circle cx="${centerX}" cy="${centerY}" r="${innerRadius}" 
                  fill="none" stroke="var(--divider-color)" stroke-width="2"/>
          
          <!-- Dividing lines -->
          ${Array.from({ length: 24 }, (_, i) => {
            const angle = (i * 360 / 24 - 90) * (Math.PI / 180);
            const xInner = centerX + innerRadius * Math.cos(angle);
            const yInner = centerY + innerRadius * Math.sin(angle);
            const xOuter = centerX + outerRadius * Math.cos(angle);
            const yOuter = centerY + outerRadius * Math.sin(angle);
            return html`
              <line x1="${xInner}" y1="${yInner}" x2="${xOuter}" y2="${yOuter}" 
                    stroke="var(--divider-color)" stroke-width="1"/>
            `;
          })}
          
          <!-- Outer ring (full hours) -->
          ${Array.from({ length: 24 }, (_, hour) => {
            const slotIndex = hour * 2;
            const isActive = schedule.slots[slotIndex];
            const isCurrent = this.currentSlot === slotIndex;
            const sectorPath = this.createSectorPath(hour, 24, innerRadius, outerRadius, centerX, centerY);
            const textPos = this.getTextPosition(hour, 24, (innerRadius + outerRadius) / 2, centerX, centerY);
            
            return html`
              <path d="${sectorPath}" 
                    fill="${isActive ? 'var(--primary-color)' : 'var(--card-background-color)'}"
                    stroke="${isCurrent ? 'var(--accent-color)' : 'var(--divider-color)'}"
                    stroke-width="${isCurrent ? '3' : '1'}"
                    class="sector"
                    @click="${() => this.toggleSlot(slotIndex)}"/>
              <text x="${textPos.x}" y="${textPos.y + 3}" 
                    text-anchor="middle" font-size="10" font-weight="bold"
                    class="sector-text"
                    fill="${isActive ? 'var(--text-primary-color)' : 'var(--primary-text-color)'}">
                ${this.getSlotTime(slotIndex)}
              </text>
            `;
          })}
          
          <!-- Inner ring (half hours) -->
          ${Array.from({ length: 24 }, (_, hour) => {
            const slotIndex = hour * 2 + 1;
            const isActive = schedule.slots[slotIndex];
            const isCurrent = this.currentSlot === slotIndex;
            const sectorPath = this.createSectorPath(hour, 24, 50, innerRadius, centerX, centerY);
            const textPos = this.getTextPosition(hour, 24, (50 + innerRadius) / 2, centerX, centerY);
            
            return html`
              <path d="${sectorPath}" 
                    fill="${isActive ? 'var(--primary-color)' : 'var(--card-background-color)'}"
                    stroke="${isCurrent ? 'var(--accent-color)' : 'var(--divider-color)'}"
                    stroke-width="${isCurrent ? '3' : '1'}"
                    class="sector"
                    @click="${() => this.toggleSlot(slotIndex)}"/>
              <text x="${textPos.x}" y="${textPos.y + 2}" 
                    text-anchor="middle" font-size="8" font-weight="bold"
                    class="sector-text"
                    fill="${isActive ? 'var(--text-primary-color)' : 'var(--primary-text-color)'}">
                ${this.getSlotTime(slotIndex)}
              </text>
            `;
          })}
        </svg>
      </div>
    `;
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

  private renderScheduleInfo(): TemplateResult {
    if (!this.selectedScheduleId || !this.schedules[this.selectedScheduleId]) {
      return html``;
    }

    const schedule = this.schedules[this.selectedScheduleId];
    const activeSlots = schedule.slots.filter(slot => slot).length;

    return html`
      <div class="schedule-info">
        <div class="info-item">
          <span class="label">${I18n.t(this.language, 'schedule.target_entity')}:</span>
          <span class="value">${schedule.target_entity_id}</span>
        </div>
        <div class="info-item">
          <span class="label">${I18n.t(this.language, 'schedule.active_slots')}:</span>
          <span class="value">${activeSlots} / 48</span>
        </div>
        <div class="info-item">
          <span class="label">${I18n.t(this.language, 'card.current_slot')}:</span>
          <span class="value">${this.getSlotTime(this.currentSlot)}</span>
        </div>
        ${schedule.conditions.length > 0 ? html`
          <div class="info-item">
            <span class="label">${I18n.t(this.language, 'schedule.conditions')}:</span>
            <span class="value">${schedule.conditions.length}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  protected render(): TemplateResult {
    if (this.loading) {
      return html`
        <ha-card>
          <div class="card-content loading">
            ${I18n.t(this.language, 'common.loading')}
          </div>
        </ha-card>
      `;
    }

    if (this.error) {
      return html`
        <ha-card>
          <div class="card-content error">
            ${this.error}
          </div>
        </ha-card>
      `;
    }

    return html`
      <ha-card>
        <div class="card-header">
          <div class="name">${this.config.title}</div>
        </div>
        
        <div class="card-content">
          ${this.renderScheduleSelector()}
          ${this.renderTimeGrid()}
          ${this.config.show_preview ? this.renderScheduleInfo() : ''}
        </div>
      </ha-card>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
      }

      ha-card {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .card-header {
        padding: 16px;
        border-bottom: 1px solid var(--divider-color);
      }

      .name {
        font-size: 1.2em;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .card-content {
        padding: 16px;
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .loading, .error {
        text-align: center;
        padding: 32px;
        color: var(--secondary-text-color);
      }

      .error {
        color: var(--error-color);
      }

      .no-schedules {
        text-align: center;
        padding: 32px;
        color: var(--secondary-text-color);
      }

      .schedule-selector {
        margin-bottom: 16px;
      }

      .schedule-selector select {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }

      .timer-container {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 300px;
      }

      .timer-svg {
        width: 100%;
        height: 100%;
        max-width: 400px;
        max-height: 400px;
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
      }

      .schedule-info {
        margin-top: 16px;
        padding: 12px;
        background: var(--secondary-background-color);
        border-radius: 8px;
      }

      .info-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      .info-item:last-child {
        margin-bottom: 0;
      }

      .label {
        color: var(--secondary-text-color);
        font-size: 0.9em;
      }

      .value {
        color: var(--primary-text-color);
        font-weight: 500;
        font-size: 0.9em;
      }

      /* Responsive adjustments */
      @media (max-width: 600px) {
        .timer-container {
          min-height: 250px;
        }
        
        .card-content {
          padding: 12px;
        }
        
        .sector-text {
          font-size: 6px !important;
        }
      }
    `;
  }
}

// Register the card
console.info(
  '%c  TIMER-24H-CARD  %c  Version 1.0.0  ',
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// Add to window for HACS
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'timer-24h-card',
  name: 'Timer 24H Card',
  description: 'A 24-hour timer card with server-side integration support',
  preview: true,
  documentationURL: 'https://github.com/home-assistant-community/timer-24h'
});
