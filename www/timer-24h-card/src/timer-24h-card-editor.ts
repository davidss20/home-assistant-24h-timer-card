/**
 * Timer 24H Card Editor for Home Assistant
 * 
 * Configuration editor for the Timer 24H card
 */

import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, Timer24HCardConfig, Schedule, Condition } from './timer-24h-card.js';

@customElement('timer-24h-card-editor')
export class Timer24HCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public config!: Timer24HCardConfig;
  
  @state() private schedules: { [id: string]: Schedule } = {};
  @state() private selectedScheduleId?: string;
  @state() private editingSchedule?: Schedule;
  @state() private newScheduleId = '';
  @state() private loading = false;
  @state() private error?: string;
  @state() private dragStart?: number;
  @state() private isDragging = false;

  public setConfig(config: Timer24HCardConfig): void {
    this.config = config;
    this.loadSchedules();
  }

  protected firstUpdated(): void {
    this.loadSchedules();
  }

  private async loadSchedules(): Promise<void> {
    if (!this.hass) return;

    try {
      this.loading = true;
      this.error = undefined;

      const response = await this.hass.callWS({
        type: 'timer24h/list'
      });

      const schedulePromises = response.map(async (item: any) => {
        const detail = await this.hass.callWS({
          type: 'timer24h/get',
          schedule_id: item.schedule_id
        });
        return detail;
      });

      const scheduleDetails = await Promise.all(schedulePromises);
      
      this.schedules = {};
      for (const detail of scheduleDetails) {
        if (detail && detail.schedule) {
          this.schedules[detail.schedule.schedule_id] = detail.schedule;
        }
      }

      // Select first schedule or default
      if (!this.selectedScheduleId && Object.keys(this.schedules).length > 0) {
        this.selectedScheduleId = Object.keys(this.schedules)[0];
        this.editingSchedule = { ...this.schedules[this.selectedScheduleId] };
      }

    } catch (error) {
      console.error('Failed to load schedules:', error);
      this.error = 'Failed to load schedules';
    } finally {
      this.loading = false;
    }
  }

  private fireConfigChanged(): void {
    const event = new CustomEvent('config-changed', {
      detail: { config: this.config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  private updateConfig(updates: Partial<Timer24HCardConfig>): void {
    this.config = { ...this.config, ...updates };
    this.fireConfigChanged();
  }

  private async createSchedule(): Promise<void> {
    if (!this.newScheduleId.trim()) {
      this.error = 'Schedule ID is required';
      return;
    }

    if (this.schedules[this.newScheduleId]) {
      this.error = 'Schedule ID already exists';
      return;
    }

    const newSchedule: Schedule = {
      schedule_id: this.newScheduleId.trim(),
      target_entity_id: '',
      slots: new Array(48).fill(false),
      enabled: true,
      timezone: undefined,
      conditions: []
    };

    this.editingSchedule = newSchedule;
    this.selectedScheduleId = newSchedule.schedule_id;
    this.newScheduleId = '';
    this.error = undefined;
  }

  private async saveSchedule(): Promise<void> {
    if (!this.editingSchedule) return;

    if (!this.editingSchedule.target_entity_id) {
      this.error = 'Target entity is required';
      return;
    }

    try {
      await this.hass.callService('timer24h', 'set_schedule', {
        schedule_id: this.editingSchedule.schedule_id,
        target_entity_id: this.editingSchedule.target_entity_id,
        slots: this.editingSchedule.slots,
        enabled: this.editingSchedule.enabled,
        timezone: this.editingSchedule.timezone || undefined
      });

      if (this.editingSchedule.conditions.length > 0) {
        await this.hass.callService('timer24h', 'set_conditions', {
          schedule_id: this.editingSchedule.schedule_id,
          conditions: this.editingSchedule.conditions
        });
      }

      // Update local state
      this.schedules[this.editingSchedule.schedule_id] = { ...this.editingSchedule };
      this.error = undefined;
      
      // Show success message
      const event = new CustomEvent('hass-notification', {
        detail: { message: 'Schedule saved successfully' },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);

    } catch (error) {
      console.error('Failed to save schedule:', error);
      this.error = 'Failed to save schedule';
    }
  }

  private async deleteSchedule(): Promise<void> {
    if (!this.selectedScheduleId) return;

    if (!confirm(`Delete schedule "${this.selectedScheduleId}"?`)) return;

    try {
      await this.hass.callService('timer24h', 'remove', {
        schedule_id: this.selectedScheduleId
      });

      delete this.schedules[this.selectedScheduleId];
      this.selectedScheduleId = undefined;
      this.editingSchedule = undefined;

      const event = new CustomEvent('hass-notification', {
        detail: { message: 'Schedule deleted successfully' },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);

    } catch (error) {
      console.error('Failed to delete schedule:', error);
      this.error = 'Failed to delete schedule';
    }
  }

  private onScheduleSelect(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this.selectedScheduleId = select.value;
    
    if (this.selectedScheduleId && this.schedules[this.selectedScheduleId]) {
      this.editingSchedule = { ...this.schedules[this.selectedScheduleId] };
    }
  }

  private toggleSlot(slotIndex: number): void {
    if (!this.editingSchedule) return;

    this.editingSchedule.slots[slotIndex] = !this.editingSchedule.slots[slotIndex];
    this.requestUpdate();
  }

  private onSlotMouseDown(slotIndex: number, e: MouseEvent): void {
    this.dragStart = slotIndex;
    this.isDragging = true;
    e.preventDefault();
  }

  private onSlotMouseEnter(slotIndex: number): void {
    if (!this.isDragging || this.dragStart === undefined || !this.editingSchedule) return;

    const start = Math.min(this.dragStart, slotIndex);
    const end = Math.max(this.dragStart, slotIndex);
    const newValue = !this.editingSchedule.slots[this.dragStart];

    for (let i = start; i <= end; i++) {
      this.editingSchedule.slots[i] = newValue;
    }
    
    this.requestUpdate();
  }

  private onSlotMouseUp(): void {
    this.isDragging = false;
    this.dragStart = undefined;
  }

  private addCondition(): void {
    if (!this.editingSchedule) return;

    this.editingSchedule.conditions.push({
      entity_id: '',
      expected: 'on',
      policy: 'skip'
    });
    
    this.requestUpdate();
  }

  private removeCondition(index: number): void {
    if (!this.editingSchedule) return;

    this.editingSchedule.conditions.splice(index, 1);
    this.requestUpdate();
  }

  private updateCondition(index: number, field: keyof Condition, value: string): void {
    if (!this.editingSchedule) return;

    (this.editingSchedule.conditions[index] as any)[field] = value;
    this.requestUpdate();
  }

  private getEntityOptions(): string[] {
    if (!this.hass) return [];

    return Object.keys(this.hass.states)
      .filter(entityId => {
        const domain = entityId.split('.')[0];
        return ['light', 'switch', 'fan', 'climate', 'media_player', 'cover', 'input_boolean'].includes(domain);
      })
      .sort();
  }

  private getAllEntityOptions(): string[] {
    if (!this.hass) return [];
    return Object.keys(this.hass.states).sort();
  }

  private formatTime(slotIndex: number): string {
    const hour = Math.floor(slotIndex / 2);
    const minute = (slotIndex % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private renderCardConfig(): TemplateResult {
    return html`
      <div class="config-section">
        <h3>Card Configuration</h3>
        
        <div class="config-row">
          <label>Title:</label>
          <input
            type="text"
            .value=${this.config.title || ''}
            @input=${(e: Event) => this.updateConfig({ title: (e.target as HTMLInputElement).value })}
          />
        </div>

        <div class="config-row">
          <label>Show Preview:</label>
          <input
            type="checkbox"
            .checked=${this.config.show_preview !== false}
            @change=${(e: Event) => this.updateConfig({ show_preview: (e.target as HTMLInputElement).checked })}
          />
        </div>

        <div class="config-row">
          <label>Show Conditions:</label>
          <input
            type="checkbox"
            .checked=${this.config.show_conditions !== false}
            @change=${(e: Event) => this.updateConfig({ show_conditions: (e.target as HTMLInputElement).checked })}
          />
        </div>

        <div class="config-row">
          <label>Compact Mode:</label>
          <input
            type="checkbox"
            .checked=${this.config.compact_mode === true}
            @change=${(e: Event) => this.updateConfig({ compact_mode: (e.target as HTMLInputElement).checked })}
          />
        </div>
      </div>
    `;
  }

  private renderScheduleManager(): TemplateResult {
    if (this.loading) {
      return html`<div class="loading">Loading schedules...</div>`;
    }

    return html`
      <div class="config-section">
        <h3>Schedule Management</h3>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}

        <!-- Schedule selector -->
        <div class="config-row">
          <label>Select Schedule:</label>
          <select @change=${this.onScheduleSelect}>
            <option value="">-- Select Schedule --</option>
            ${Object.keys(this.schedules).map(id => html`
              <option value="${id}" ?selected=${id === this.selectedScheduleId}>
                ${id}
              </option>
            `)}
          </select>
        </div>

        <!-- New schedule -->
        <div class="config-row">
          <label>New Schedule ID:</label>
          <div class="input-group">
            <input
              type="text"
              .value=${this.newScheduleId}
              @input=${(e: Event) => this.newScheduleId = (e.target as HTMLInputElement).value}
              placeholder="schedule_id"
            />
            <button @click=${this.createSchedule}>Create</button>
          </div>
        </div>

        ${this.selectedScheduleId ? html`
          <button class="delete-btn" @click=${this.deleteSchedule}>
            Delete Schedule
          </button>
        ` : ''}
      </div>
    `;
  }

  private renderScheduleEditor(): TemplateResult {
    if (!this.editingSchedule) return html``;

    return html`
      <div class="config-section">
        <h3>Schedule Settings</h3>

        <div class="config-row">
          <label>Target Entity:</label>
          <select
            .value=${this.editingSchedule.target_entity_id}
            @change=${(e: Event) => {
              if (this.editingSchedule) {
                this.editingSchedule.target_entity_id = (e.target as HTMLSelectElement).value;
                this.requestUpdate();
              }
            }}
          >
            <option value="">-- Select Entity --</option>
            ${this.getEntityOptions().map(entityId => html`
              <option value="${entityId}">${entityId}</option>
            `)}
          </select>
        </div>

        <div class="config-row">
          <label>Enabled:</label>
          <input
            type="checkbox"
            .checked=${this.editingSchedule.enabled}
            @change=${(e: Event) => {
              if (this.editingSchedule) {
                this.editingSchedule.enabled = (e.target as HTMLInputElement).checked;
                this.requestUpdate();
              }
            }}
          />
        </div>

        <div class="config-row">
          <label>Timezone:</label>
          <input
            type="text"
            .value=${this.editingSchedule.timezone || ''}
            @input=${(e: Event) => {
              if (this.editingSchedule) {
                this.editingSchedule.timezone = (e.target as HTMLInputElement).value || undefined;
                this.requestUpdate();
              }
            }}
            placeholder="Leave empty to use HA timezone"
          />
        </div>

        <button class="save-btn" @click=${this.saveSchedule}>
          Save Schedule
        </button>
      </div>
    `;
  }

  private renderTimeSlotEditor(): TemplateResult {
    if (!this.editingSchedule) return html``;

    return html`
      <div class="config-section">
        <h3>Time Slots</h3>
        <p>Click and drag to select time slots</p>

        <div class="slots-grid" @mouseup=${this.onSlotMouseUp} @mouseleave=${this.onSlotMouseUp}>
          ${this.editingSchedule.slots.map((isActive, index) => html`
            <div
              class="slot ${isActive ? 'active' : ''}"
              title="${this.formatTime(index)}"
              @mousedown=${(e: MouseEvent) => this.onSlotMouseDown(index, e)}
              @mouseenter=${() => this.onSlotMouseEnter(index)}
              @click=${() => this.toggleSlot(index)}
            >
              ${this.formatTime(index)}
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderConditionsEditor(): TemplateResult {
    if (!this.editingSchedule) return html``;

    return html`
      <div class="config-section">
        <h3>Conditions</h3>

        <button @click=${this.addCondition}>Add Condition</button>

        ${this.editingSchedule.conditions.map((condition, index) => html`
          <div class="condition-row">
            <select
              .value=${condition.entity_id}
              @change=${(e: Event) => this.updateCondition(index, 'entity_id', (e.target as HTMLSelectElement).value)}
            >
              <option value="">-- Select Entity --</option>
              ${this.getAllEntityOptions().map(entityId => html`
                <option value="${entityId}">${entityId}</option>
              `)}
            </select>

            <input
              type="text"
              .value=${condition.expected || ''}
              @input=${(e: Event) => this.updateCondition(index, 'expected', (e.target as HTMLInputElement).value)}
              placeholder="Expected state (e.g., on, off)"
            />

            <select
              .value=${condition.policy}
              @change=${(e: Event) => this.updateCondition(index, 'policy', (e.target as HTMLSelectElement).value)}
            >
              <option value="skip">Skip</option>
              <option value="force_off">Force Off</option>
              <option value="defer">Defer</option>
            </select>

            <button @click=${() => this.removeCondition(index)}>Remove</button>
          </div>
        `)}
      </div>
    `;
  }

  protected render(): TemplateResult {
    return html`
      <div class="card-config">
        ${this.renderCardConfig()}
        ${this.renderScheduleManager()}
        ${this.renderScheduleEditor()}
        ${this.renderTimeSlotEditor()}
        ${this.renderConditionsEditor()}
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      .card-config {
        padding: 16px;
      }

      .config-section {
        margin-bottom: 24px;
        padding: 16px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        background: var(--card-background-color);
      }

      .config-section h3 {
        margin: 0 0 16px 0;
        color: var(--primary-text-color);
      }

      .config-row {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
      }

      .config-row label {
        min-width: 120px;
        color: var(--primary-text-color);
      }

      .config-row input,
      .config-row select {
        flex: 1;
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }

      .input-group {
        display: flex;
        flex: 1;
        gap: 8px;
      }

      .input-group input {
        flex: 1;
      }

      .slots-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 2px;
        margin-top: 12px;
        user-select: none;
      }

      .slot {
        padding: 8px 4px;
        text-align: center;
        font-size: 10px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        cursor: pointer;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        transition: all 0.2s;
      }

      .slot:hover {
        background: var(--secondary-background-color);
      }

      .slot.active {
        background: var(--primary-color);
        color: var(--text-primary-color);
      }

      .condition-row {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        align-items: center;
      }

      .condition-row select,
      .condition-row input {
        flex: 1;
        padding: 6px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }

      .save-btn {
        background: var(--primary-color);
        color: var(--text-primary-color);
        border: none;
        padding: 12px 24px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }

      .save-btn:hover {
        opacity: 0.9;
      }

      .delete-btn {
        background: var(--error-color);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }

      .delete-btn:hover {
        opacity: 0.9;
      }

      button {
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        border: 1px solid var(--divider-color);
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }

      button:hover {
        background: var(--primary-color);
        color: var(--text-primary-color);
      }

      .loading {
        text-align: center;
        padding: 20px;
        color: var(--secondary-text-color);
      }

      .error {
        background: var(--error-color);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        margin-bottom: 12px;
        font-size: 14px;
      }

      @media (max-width: 600px) {
        .card-config {
          padding: 8px;
        }

        .config-row {
          flex-direction: column;
          align-items: stretch;
        }

        .config-row label {
          min-width: auto;
          margin-bottom: 4px;
        }

        .slots-grid {
          grid-template-columns: repeat(6, 1fr);
        }

        .condition-row {
          flex-direction: column;
        }
      }
    `;
  }
}
