import {
  LitElement,
  html,
  css,
  CSSResultGroup,
  TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';

interface Timer24HCardConfig {
  title?: string;
  home_sensors?: string[];
  home_logic?: 'OR' | 'AND';
  entities?: string[];
  save_state?: boolean;
  storage_entity_id?: string;
  auto_create_helper?: boolean;
  allow_local_fallback?: boolean;
}

@customElement('timer-24h-card-editor')
export class Timer24HCardEditor extends LitElement implements LovelaceCardEditor {
  
  private handleAutoCreateChange(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this.config = { ...this.config, auto_create_helper: target.checked };
    this.configChanged();
  }
  private handleLocalFallbackChange(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this.config = { ...this.config, allow_local_fallback: target.checked };
    this.configChanged();
  }
  private handleStorageEntityInput(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this.config = { ...this.config, storage_entity_id: target.value };
    this.configChanged();
  }
@property({ attribute: false }) public hass!: HomeAssistant;
  @state() private config!: Timer24HCardConfig;
  @state() private entityFilter: string = '';

  public setConfig(config: Timer24HCardConfig): void {
    this.config = { ...config };
  }

  protected render(): TemplateResult {
    if (!this.hass) {
      return html`<div class="loading">
        <div class="spinner"></div>
        <p>Loading Home Assistant entities...</p>
      </div>`;
    }

    // Get list of all entities
    const entities = Object.keys(this.hass.states);
    const sensors = entities.filter(e => 
      e.startsWith('sensor.') || 
      e.startsWith('binary_sensor.') || 
      e.startsWith('person.') || 
      e.startsWith('device_tracker.') ||
      e.startsWith('input_boolean.')
    ).sort();
    const controllableEntities = entities.filter(e => 
      e.startsWith('light.') || 
      e.startsWith('switch.') || 
      e.startsWith('fan.') || 
      e.startsWith('climate.') || 
      e.startsWith('media_player.') ||
      e.startsWith('cover.') ||
      e.startsWith('input_boolean.')
    ).sort();

    return html`
      <div class="card-config">
        <div class="config-header">
          <h2>🕐 הגדרת כרטיס טיימר 24 שעות</h2>
          <p>הגדר את הטיימר שלך עם בקרה אוטומטית על ישויות</p>
        </div>

        <div class="config-row">
          <label for="title">Card Title</label>
          <input
            type="text"
            id="title"
            .value="${this.config.title || '24 Hour Timer'}"
            placeholder="Enter card title"
            @input="${this.handleTitleChange}"
          />
          <div class="help-text">The title displayed at the top of the card</div>
        </div>
        
        <div class="section-title">Home Presence Settings</div>
        
        <div class="config-row">
          <label>Sensors for home presence detection</label>
          <div class="entity-list" id="sensor-list">
            ${sensors.length > 0 ? sensors.map(entityId => {
              const entity = this.hass.states[entityId];
              const isChecked = (this.config.home_sensors || []).includes(entityId);
              const friendlyName = entity?.attributes?.friendly_name || entityId;
              const domain = entityId.split('.')[0];
              const icon = this.getEntityIcon(domain);
              
              return html`
                <div class="entity-item ${isChecked ? 'selected' : ''}">
                  <input
                    type="checkbox"
                    .checked="${isChecked}"
                    .entityId="${entityId}"
                    @change="${this.handleSensorChange}"
                  />
                  <div class="entity-info">
                    <span class="entity-icon">${icon}</span>
                    <div class="entity-details">
                      <span class="entity-name">${friendlyName}</span>
                      <span class="entity-id">${entityId}</span>
                    </div>
                  </div>
                  <span class="entity-state ${entity?.state === 'on' || entity?.state === 'home' ? 'active' : ''}">${entity?.state || 'unavailable'}</span>
                </div>
              `;
            }) : html`<div class="no-entities">No suitable sensors found</div>`}
          </div>
          <div class="help-text">💡 Select sensors that indicate when you are at home (person, device_tracker, binary_sensor, etc.)</div>
        </div>
        
        <div class="config-row">
          <label for="home-logic">Home detection logic</label>
          <select
            id="home-logic"
            .value="${this.config.home_logic || 'OR'}"
            @change="${this.handleLogicChange}"
          >
            <option value="OR" ?selected="${this.config.home_logic === 'OR' || !this.config.home_logic}">
              🔀 OR - At least one sensor must be active
            </option>
            <option value="AND" ?selected="${this.config.home_logic === 'AND'}">
              🔗 AND - All sensors must be active
            </option>
          </select>
          <div class="help-text">🤔 How to determine if you are at home based on the selected sensors</div>
        </div>
        
        <div class="section-title">Entity Control</div>
        
        <div class="config-row">
          <label>Entities to control based on timer</label>
          <div class="entity-search">
            <input
              type="text"
              id="entity-filter"
              placeholder="🔍 Search entities..."
              @input="${this.handleEntityFilter}"
            />
          </div>
          <div class="entity-list" id="entity-list">
            ${controllableEntities.length > 0 ? controllableEntities
              .filter(entityId => !this.entityFilter || 
                entityId.toLowerCase().includes(this.entityFilter.toLowerCase()) ||
                (this.hass.states[entityId]?.attributes?.friendly_name || '').toLowerCase().includes(this.entityFilter.toLowerCase())
              )
              .map(entityId => {
              const entity = this.hass.states[entityId];
              const isChecked = (this.config.entities || []).includes(entityId);
              const friendlyName = entity?.attributes?.friendly_name || entityId;
              const domain = entityId.split('.')[0];
              const icon = this.getEntityIcon(domain);
              
              return html`
                <div class="entity-item ${isChecked ? 'selected' : ''}">
                  <input
                    type="checkbox"
                    .checked="${isChecked}"
                    .entityId="${entityId}"
                    @change="${this.handleEntityChange}"
                  />
                  <div class="entity-info">
                    <span class="entity-icon">${icon}</span>
                    <div class="entity-details">
                      <span class="entity-name">${friendlyName}</span>
                      <span class="entity-id">${entityId}</span>
                    </div>
                  </div>
                  <span class="entity-state ${entity?.state === 'on' ? 'active' : ''}">${entity?.state || 'unavailable'}</span>
                </div>
              `;
            }) : html`<div class="no-entities">No controllable entities found</div>`}
          </div>
          <div class="help-text">⚡ Select entities that will be automatically turned on/off according to the schedule</div>
        </div>
        
        <div class="section-title">Additional Settings</div>
        
        <div class="checkbox-container">
          <input
            type="checkbox"
            id="save-state"
            .checked="${this.config.save_state !== false}"
            @change="${this.handleSaveStateChange}"
          />
          <label for="save-state">💾 Save timer settings in browser</label>
        </div>

        <div class="checkbox-container">
          <input type="checkbox" id="auto-create"
            .checked="${this.config.auto_create_helper !== false}"
            @change="${this.handleAutoCreateChange}" />
          <label for="auto-create">🧰 Auto-create server helper if missing</label>
        </div>

        <div class="checkbox-container">
          <input type="checkbox" id="local-fallback"
            .checked="${this.config.allow_local_fallback !== false}"
            @change="${this.handleLocalFallbackChange}" />
          <label for="local-fallback">💾 Also keep a local fallback (optional)</label>
        </div>

        <div class="field">
          <label for="storage-entity">Storage entity_id (optional)</label>
          <input id="storage-entity" type="text"
            placeholder="input_text.timer_24h_card_my_timer"
            .value="${this.config.storage_entity_id || ''}"
            @input="${this.handleStorageEntityInput}" />
          <div class="help-text">If empty, the card generates an id from the title.</div>
        </div>
        <div class="help-text">💡 If checked, your timer settings will be saved even after refreshing the page or closing the browser</div>
        
        <div class="config-footer">
          <p>✨ Your card is ready! The timer will automatically control your selected entities based on your schedule and home presence.</p>
        </div>
      </div>
    `;
  }

  private handleTitleChange(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this.config = { ...this.config, title: target.value };
    this.configChanged();
  }

  private handleEntityFilter(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this.entityFilter = target.value;
  }

  private getEntityIcon(domain: string): string {
    const icons: Record<string, string> = {
      'person': '👤',
      'device_tracker': '📱',
      'binary_sensor': '🔘',
      'sensor': '📊',
      'input_boolean': '🔘',
      'light': '💡',
      'switch': '🔌',
      'fan': '🌀',
      'climate': '🌡️',
      'media_player': '📺',
      'cover': '🪟',
      'default': '⚙️'
    };
    return icons[domain] || icons.default;
  }

  private handleLogicChange(ev: Event): void {
    const target = ev.target as HTMLSelectElement;
    const value = target.value as 'OR' | 'AND';
    this.config = { ...this.config, home_logic: value };
    this.configChanged();
  }

  private handleSaveStateChange(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this.config = { ...this.config, save_state: target.checked };
    this.configChanged();
  }

  private handleSensorChange(ev: Event): void {
    const target = ev.target as any;
    const entityId = target.entityId;
    const sensors = [...(this.config.home_sensors || [])];
    const index = sensors.indexOf(entityId);
    
    if (target.checked && index === -1) {
      sensors.push(entityId);
    } else if (!target.checked && index > -1) {
      sensors.splice(index, 1);
    }
    
    this.config = { ...this.config, home_sensors: sensors };
    this.configChanged();
  }

  private handleEntityChange(ev: Event): void {
    const target = ev.target as any;
    const entityId = target.entityId;
    const entities = [...(this.config.entities || [])];
    const index = entities.indexOf(entityId);
    
    if (target.checked && index === -1) {
      entities.push(entityId);
    } else if (!target.checked && index > -1) {
      entities.splice(index, 1);
    }
    
    this.config = { ...this.config, entities: entities };
    this.configChanged();
  }

  private configChanged(): void {
    const event = new CustomEvent('config-changed', {
      detail: { config: this.config },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  static get styles(): CSSResultGroup {
    return css`
      .card-config {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 20px;
        background: var(--card-background-color);
        border-radius: 8px;
        max-width: 600px;
        margin: 0 auto;
      }
      
      .config-header {
        text-align: center;
        margin-bottom: 20px;
      }
      
      .config-header h2 {
        margin: 0 0 8px 0;
        color: var(--primary-text-color);
        font-size: 24px;
      }
      
      .config-header p {
        margin: 0;
        color: var(--secondary-text-color);
        font-size: 14px;
      }
      
      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        gap: 16px;
      }
      
      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--divider-color);
        border-top: 3px solid var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .config-row {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      label {
        font-weight: 600;
        color: var(--primary-text-color);
        font-size: 16px;
      }
      
      input[type="text"], select {
        padding: 12px 16px;
        border: 2px solid var(--divider-color);
        border-radius: 8px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
        transition: border-color 0.2s;
      }
      
      input[type="text"]:focus, select:focus {
        outline: none;
        border-color: var(--primary-color);
      }
      
      .entity-search {
        margin-bottom: 12px;
      }
      
      .entity-list {
        max-height: 300px;
        overflow-y: auto;
        border: 2px solid var(--divider-color);
        border-radius: 8px;
        background: var(--card-background-color);
      }
      
      .entity-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--divider-color);
        transition: background-color 0.2s;
        cursor: pointer;
      }
      
      .entity-item:hover {
        background: var(--secondary-background-color, rgba(0,0,0,0.05));
      }
      
      .entity-item.selected {
        background: var(--primary-color-light, rgba(25, 118, 210, 0.1));
        border-left: 4px solid var(--primary-color);
      }
      
      .entity-item:last-child {
        border-bottom: none;
      }
      
      .entity-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
      }
      
      .entity-icon {
        font-size: 20px;
        width: 24px;
        text-align: center;
      }
      
      .entity-details {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      
      .entity-name {
        font-weight: 500;
        color: var(--primary-text-color);
        font-size: 14px;
      }
      
      .entity-id {
        font-size: 12px;
        color: var(--secondary-text-color);
        font-family: monospace;
      }
      
      .entity-state {
        font-size: 12px;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 12px;
        background: var(--divider-color);
        color: var(--secondary-text-color);
      }
      
      .entity-state.active {
        background: var(--success-color, #4caf50);
        color: white;
      }
      
      .no-entities {
        padding: 20px;
        text-align: center;
        color: var(--secondary-text-color);
        font-style: italic;
      }
      
      .help-text {
        font-size: 13px;
        color: var(--secondary-text-color);
        line-height: 1.4;
        margin-top: 8px;
        padding: 8px 12px;
        background: var(--secondary-background-color, rgba(0,0,0,0.05));
        border-radius: 6px;
        border-left: 3px solid var(--primary-color);
      }
      
      .checkbox-container {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: var(--secondary-background-color, rgba(0,0,0,0.05));
        border-radius: 8px;
      }
      
      .checkbox-container input[type="checkbox"] {
        width: 18px;
        height: 18px;
        margin: 0;
      }
      
      .checkbox-container label {
        font-weight: normal;
        font-size: 14px;
        cursor: pointer;
      }
      
      .section-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--primary-text-color);
        margin: 24px 0 16px 0;
        padding: 0 0 8px 0;
        border-bottom: 2px solid var(--primary-color);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .section-title::before {
        content: "▶";
        color: var(--primary-color);
        font-size: 14px;
      }
      
      .config-footer {
        margin-top: 24px;
        padding: 16px;
        background: linear-gradient(135deg, var(--primary-color-light, rgba(25, 118, 210, 0.1)), var(--accent-color-light, rgba(255, 193, 7, 0.1)));
        border-radius: 8px;
        border: 1px solid var(--primary-color-light, rgba(25, 118, 210, 0.2));
      }
      
      .config-footer p {
        margin: 0;
        color: var(--primary-text-color);
        font-size: 14px;
        text-align: center;
        font-weight: 500;
      }
    `;
  }
}
