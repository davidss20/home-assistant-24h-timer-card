import { r as c, i as u, x as o, a as p, n as h, t as g } from "./state-B8hF9UhQ.js";
var v = Object.defineProperty, S = Object.getOwnPropertyDescriptor, l = (e, t, i, s) => {
  for (var d = s > 1 ? void 0 : s ? S(t, i) : t, n = e.length - 1, a; n >= 0; n--)
    (a = e[n]) && (d = (s ? a(t, i, d) : a(d)) || d);
  return s && d && v(t, i, d), d;
};
let r = class extends u {
  constructor() {
    super(...arguments), this.schedules = {}, this.newScheduleId = "", this.loading = !1, this.isDragging = !1;
  }
  setConfig(e) {
    this.config = e, this.loadSchedules();
  }
  firstUpdated() {
    this.loadSchedules();
  }
  async loadSchedules() {
    if (this.hass)
      try {
        this.loading = !0, this.error = void 0;
        const t = (await this.hass.callWS({
          type: "timer24h/list"
        })).map(async (s) => await this.hass.callWS({
          type: "timer24h/get",
          schedule_id: s.schedule_id
        })), i = await Promise.all(t);
        this.schedules = {};
        for (const s of i)
          s && s.schedule && (this.schedules[s.schedule.schedule_id] = s.schedule);
        !this.selectedScheduleId && Object.keys(this.schedules).length > 0 && (this.selectedScheduleId = Object.keys(this.schedules)[0], this.editingSchedule = { ...this.schedules[this.selectedScheduleId] });
      } catch (e) {
        console.error("Failed to load schedules:", e), this.error = "Failed to load schedules";
      } finally {
        this.loading = !1;
      }
  }
  fireConfigChanged() {
    const e = new CustomEvent("config-changed", {
      detail: { config: this.config },
      bubbles: !0,
      composed: !0
    });
    this.dispatchEvent(e);
  }
  updateConfig(e) {
    this.config = { ...this.config, ...e }, this.fireConfigChanged();
  }
  async createSchedule() {
    if (!this.newScheduleId.trim()) {
      this.error = "Schedule ID is required";
      return;
    }
    if (this.schedules[this.newScheduleId]) {
      this.error = "Schedule ID already exists";
      return;
    }
    const e = {
      schedule_id: this.newScheduleId.trim(),
      target_entity_id: "",
      slots: new Array(48).fill(!1),
      enabled: !0,
      timezone: void 0,
      conditions: []
    };
    this.editingSchedule = e, this.selectedScheduleId = e.schedule_id, this.newScheduleId = "", this.error = void 0;
  }
  async saveSchedule() {
    if (this.editingSchedule) {
      if (!this.editingSchedule.target_entity_id) {
        this.error = "Target entity is required";
        return;
      }
      try {
        await this.hass.callService("timer24h", "set_schedule", {
          schedule_id: this.editingSchedule.schedule_id,
          target_entity_id: this.editingSchedule.target_entity_id,
          slots: this.editingSchedule.slots,
          enabled: this.editingSchedule.enabled,
          timezone: this.editingSchedule.timezone || void 0
        }), this.editingSchedule.conditions.length > 0 && await this.hass.callService("timer24h", "set_conditions", {
          schedule_id: this.editingSchedule.schedule_id,
          conditions: this.editingSchedule.conditions
        }), this.schedules[this.editingSchedule.schedule_id] = { ...this.editingSchedule }, this.error = void 0;
        const e = new CustomEvent("hass-notification", {
          detail: { message: "Schedule saved successfully" },
          bubbles: !0,
          composed: !0
        });
        this.dispatchEvent(e);
      } catch (e) {
        console.error("Failed to save schedule:", e), this.error = "Failed to save schedule";
      }
    }
  }
  async deleteSchedule() {
    if (this.selectedScheduleId && confirm(`Delete schedule "${this.selectedScheduleId}"?`))
      try {
        await this.hass.callService("timer24h", "remove", {
          schedule_id: this.selectedScheduleId
        }), delete this.schedules[this.selectedScheduleId], this.selectedScheduleId = void 0, this.editingSchedule = void 0;
        const e = new CustomEvent("hass-notification", {
          detail: { message: "Schedule deleted successfully" },
          bubbles: !0,
          composed: !0
        });
        this.dispatchEvent(e);
      } catch (e) {
        console.error("Failed to delete schedule:", e), this.error = "Failed to delete schedule";
      }
  }
  onScheduleSelect(e) {
    const t = e.target;
    this.selectedScheduleId = t.value, this.selectedScheduleId && this.schedules[this.selectedScheduleId] && (this.editingSchedule = { ...this.schedules[this.selectedScheduleId] });
  }
  toggleSlot(e) {
    this.editingSchedule && (this.editingSchedule.slots[e] = !this.editingSchedule.slots[e], this.requestUpdate());
  }
  onSlotMouseDown(e, t) {
    this.dragStart = e, this.isDragging = !0, t.preventDefault();
  }
  onSlotMouseEnter(e) {
    if (!this.isDragging || this.dragStart === void 0 || !this.editingSchedule) return;
    const t = Math.min(this.dragStart, e), i = Math.max(this.dragStart, e), s = !this.editingSchedule.slots[this.dragStart];
    for (let d = t; d <= i; d++)
      this.editingSchedule.slots[d] = s;
    this.requestUpdate();
  }
  onSlotMouseUp() {
    this.isDragging = !1, this.dragStart = void 0;
  }
  addCondition() {
    this.editingSchedule && (this.editingSchedule.conditions.push({
      entity_id: "",
      expected: "on",
      policy: "skip"
    }), this.requestUpdate());
  }
  removeCondition(e) {
    this.editingSchedule && (this.editingSchedule.conditions.splice(e, 1), this.requestUpdate());
  }
  updateCondition(e, t, i) {
    this.editingSchedule && (this.editingSchedule.conditions[e][t] = i, this.requestUpdate());
  }
  getEntityOptions() {
    return this.hass ? Object.keys(this.hass.states).filter((e) => {
      const t = e.split(".")[0];
      return ["light", "switch", "fan", "climate", "media_player", "cover", "input_boolean"].includes(t);
    }).sort() : [];
  }
  getAllEntityOptions() {
    return this.hass ? Object.keys(this.hass.states).sort() : [];
  }
  formatTime(e) {
    const t = Math.floor(e / 2), i = e % 2 * 30;
    return `${t.toString().padStart(2, "0")}:${i.toString().padStart(2, "0")}`;
  }
  renderCardConfig() {
    return o`
      <div class="config-section">
        <h3>Card Configuration</h3>
        
        <div class="config-row">
          <label>Title:</label>
          <input
            type="text"
            .value=${this.config.title || ""}
            @input=${(e) => this.updateConfig({ title: e.target.value })}
          />
        </div>

        <div class="config-row">
          <label>Show Preview:</label>
          <input
            type="checkbox"
            .checked=${this.config.show_preview !== !1}
            @change=${(e) => this.updateConfig({ show_preview: e.target.checked })}
          />
        </div>

        <div class="config-row">
          <label>Show Conditions:</label>
          <input
            type="checkbox"
            .checked=${this.config.show_conditions !== !1}
            @change=${(e) => this.updateConfig({ show_conditions: e.target.checked })}
          />
        </div>

        <div class="config-row">
          <label>Compact Mode:</label>
          <input
            type="checkbox"
            .checked=${this.config.compact_mode === !0}
            @change=${(e) => this.updateConfig({ compact_mode: e.target.checked })}
          />
        </div>
      </div>
    `;
  }
  renderScheduleManager() {
    return this.loading ? o`<div class="loading">Loading schedules...</div>` : o`
      <div class="config-section">
        <h3>Schedule Management</h3>

        ${this.error ? o`<div class="error">${this.error}</div>` : ""}

        <!-- Schedule selector -->
        <div class="config-row">
          <label>Select Schedule:</label>
          <select @change=${this.onScheduleSelect}>
            <option value="">-- Select Schedule --</option>
            ${Object.keys(this.schedules).map((e) => o`
              <option value="${e}" ?selected=${e === this.selectedScheduleId}>
                ${e}
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
              @input=${(e) => this.newScheduleId = e.target.value}
              placeholder="schedule_id"
            />
            <button @click=${this.createSchedule}>Create</button>
          </div>
        </div>

        ${this.selectedScheduleId ? o`
          <button class="delete-btn" @click=${this.deleteSchedule}>
            Delete Schedule
          </button>
        ` : ""}
      </div>
    `;
  }
  renderScheduleEditor() {
    return this.editingSchedule ? o`
      <div class="config-section">
        <h3>Schedule Settings</h3>

        <div class="config-row">
          <label>Target Entity:</label>
          <select
            .value=${this.editingSchedule.target_entity_id}
            @change=${(e) => {
      this.editingSchedule && (this.editingSchedule.target_entity_id = e.target.value, this.requestUpdate());
    }}
          >
            <option value="">-- Select Entity --</option>
            ${this.getEntityOptions().map((e) => o`
              <option value="${e}">${e}</option>
            `)}
          </select>
        </div>

        <div class="config-row">
          <label>Enabled:</label>
          <input
            type="checkbox"
            .checked=${this.editingSchedule.enabled}
            @change=${(e) => {
      this.editingSchedule && (this.editingSchedule.enabled = e.target.checked, this.requestUpdate());
    }}
          />
        </div>

        <div class="config-row">
          <label>Timezone:</label>
          <input
            type="text"
            .value=${this.editingSchedule.timezone || ""}
            @input=${(e) => {
      this.editingSchedule && (this.editingSchedule.timezone = e.target.value || void 0, this.requestUpdate());
    }}
            placeholder="Leave empty to use HA timezone"
          />
        </div>

        <button class="save-btn" @click=${this.saveSchedule}>
          Save Schedule
        </button>
      </div>
    ` : o``;
  }
  renderTimeSlotEditor() {
    return this.editingSchedule ? o`
      <div class="config-section">
        <h3>Time Slots</h3>
        <p>Click and drag to select time slots</p>

        <div class="slots-grid" @mouseup=${this.onSlotMouseUp} @mouseleave=${this.onSlotMouseUp}>
          ${this.editingSchedule.slots.map((e, t) => o`
            <div
              class="slot ${e ? "active" : ""}"
              title="${this.formatTime(t)}"
              @mousedown=${(i) => this.onSlotMouseDown(t, i)}
              @mouseenter=${() => this.onSlotMouseEnter(t)}
              @click=${() => this.toggleSlot(t)}
            >
              ${this.formatTime(t)}
            </div>
          `)}
        </div>
      </div>
    ` : o``;
  }
  renderConditionsEditor() {
    return this.editingSchedule ? o`
      <div class="config-section">
        <h3>Conditions</h3>

        <button @click=${this.addCondition}>Add Condition</button>

        ${this.editingSchedule.conditions.map((e, t) => o`
          <div class="condition-row">
            <select
              .value=${e.entity_id}
              @change=${(i) => this.updateCondition(t, "entity_id", i.target.value)}
            >
              <option value="">-- Select Entity --</option>
              ${this.getAllEntityOptions().map((i) => o`
                <option value="${i}">${i}</option>
              `)}
            </select>

            <input
              type="text"
              .value=${e.expected || ""}
              @input=${(i) => this.updateCondition(t, "expected", i.target.value)}
              placeholder="Expected state (e.g., on, off)"
            />

            <select
              .value=${e.policy}
              @change=${(i) => this.updateCondition(t, "policy", i.target.value)}
            >
              <option value="skip">Skip</option>
              <option value="force_off">Force Off</option>
              <option value="defer">Defer</option>
            </select>

            <button @click=${() => this.removeCondition(t)}>Remove</button>
          </div>
        `)}
      </div>
    ` : o``;
  }
  render() {
    return o`
      <div class="card-config">
        ${this.renderCardConfig()}
        ${this.renderScheduleManager()}
        ${this.renderScheduleEditor()}
        ${this.renderTimeSlotEditor()}
        ${this.renderConditionsEditor()}
      </div>
    `;
  }
  static get styles() {
    return p`
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
};
l([
  h({ attribute: !1 })
], r.prototype, "hass", 2);
l([
  h()
], r.prototype, "config", 2);
l([
  c()
], r.prototype, "schedules", 2);
l([
  c()
], r.prototype, "selectedScheduleId", 2);
l([
  c()
], r.prototype, "editingSchedule", 2);
l([
  c()
], r.prototype, "newScheduleId", 2);
l([
  c()
], r.prototype, "loading", 2);
l([
  c()
], r.prototype, "error", 2);
l([
  c()
], r.prototype, "dragStart", 2);
l([
  c()
], r.prototype, "isDragging", 2);
r = l([
  g("timer-24h-card-editor")
], r);
export {
  r as Timer24HCardEditor
};
//# sourceMappingURL=timer-24h-card-editor.js.map
