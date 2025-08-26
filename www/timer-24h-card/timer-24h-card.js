import { r as m, i as _, x as l, a as b, n as I, t as k } from "./state-B8hF9UhQ.js";
var M = Object.defineProperty, T = Object.getOwnPropertyDescriptor, g = (s, t, e, o) => {
  for (var r = o > 1 ? void 0 : o ? T(t, e) : t, c = s.length - 1, i; c >= 0; c--)
    (i = s[c]) && (r = (o ? i(t, e, r) : i(r)) || r);
  return o && r && M(t, e, r), r;
};
const f = class f {
  static async loadTranslations(t) {
    if (!this.translations[t])
      try {
        const e = await fetch(`/local/timer-24h-card/i18n/${t}.json`);
        this.translations[t] = await e.json();
      } catch {
        console.warn(`Failed to load translations for ${t}, falling back to English`), t !== "en" && (await this.loadTranslations("en"), this.translations[t] = this.translations.en);
      }
  }
  static t(t, e, ...o) {
    const r = this.translations[t] || this.translations.en || {}, c = e.split(".");
    let i = r;
    for (const a of c)
      if (i = i?.[a], !i) break;
    return typeof i == "string" ? i.replace(/\{(\w+)\}/g, (a, d) => {
      const n = parseInt(d);
      return !isNaN(n) && o[n] !== void 0 ? o[n] : a;
    }) : e;
  }
};
f.translations = {};
let h = f, u = class extends _ {
  constructor() {
    super(...arguments), this.schedules = {}, this.currentSlot = 0, this.loading = !1, this.language = "en";
  }
  // Grid support for dashboard layout
  static getLayoutOptions() {
    return {
      grid_rows: 3,
      grid_columns: 6,
      grid_min_rows: 2,
      grid_min_columns: 3
    };
  }
  getCardSize() {
    return this.config?.compact_mode ? 2 : 3;
  }
  static async getConfigElement() {
    return await import("./timer-24h-card-editor.js"), document.createElement("timer-24h-card-editor");
  }
  static getStubConfig() {
    return {
      type: "custom:timer-24h-card",
      title: "Timer 24H",
      show_preview: !0,
      show_conditions: !0,
      compact_mode: !1
    };
  }
  setConfig(s) {
    if (!s)
      throw new Error("Invalid configuration");
    this.config = {
      title: "Timer 24H",
      show_preview: !0,
      show_conditions: !0,
      compact_mode: !1,
      ...s
    }, this.language = s.language || this.hass?.language || "en", h.loadTranslations(this.language);
  }
  updated(s) {
    super.updated(s), s.has("hass") && this.hass && this.loadSchedules();
  }
  async loadSchedules() {
    if (this.hass)
      try {
        this.loading = !0, this.error = void 0;
        const t = (await this.hass.callWS({
          type: "timer24h/list"
        })).map(async (r) => await this.hass.callWS({
          type: "timer24h/get",
          schedule_id: r.schedule_id
        })), e = await Promise.all(t);
        this.schedules = {};
        for (const r of e)
          r && r.schedule && (this.schedules[r.schedule.schedule_id] = r.schedule);
        const o = await this.hass.callWS({
          type: "timer24h/get_all_states"
        });
        o && (this.currentSlot = o.current_slot, this.nextSlotTime = o.next_slot_time), !this.selectedScheduleId && Object.keys(this.schedules).length > 0 && (this.selectedScheduleId = Object.keys(this.schedules)[0]);
      } catch (s) {
        console.error("Failed to load schedules:", s), this.error = h.t(this.language, "messages.websocket_error");
      } finally {
        this.loading = !1;
      }
  }
  async toggleSlot(s) {
    if (!this.selectedScheduleId || !this.schedules[this.selectedScheduleId]) return;
    const t = this.schedules[this.selectedScheduleId], e = [...t.slots];
    e[s] = !e[s];
    try {
      await this.hass.callService("timer24h", "set_schedule", {
        schedule_id: t.schedule_id,
        target_entity_id: t.target_entity_id,
        slots: e,
        enabled: t.enabled,
        timezone: t.timezone
      }), t.slots = e, this.requestUpdate();
    } catch (o) {
      console.error("Failed to update schedule:", o), this.error = h.t(this.language, "messages.service_call_failed");
    }
  }
  formatTime(s, t) {
    return `${s.toString().padStart(2, "0")}:${t.toString().padStart(2, "0")}`;
  }
  getSlotTime(s) {
    const t = Math.floor(s / 2), e = s % 2 * 30;
    return this.formatTime(t, e);
  }
  renderScheduleSelector() {
    const s = Object.keys(this.schedules);
    return s.length === 0 ? l`
        <div class="no-schedules">
          ${h.t(this.language, "card.no_schedules")}
        </div>
      ` : l`
      <div class="schedule-selector">
        <select @change=${this.onScheduleChange}>
          ${s.map((t) => l`
            <option value="${t}" ?selected=${t === this.selectedScheduleId}>
              ${t} (${this.schedules[t].target_entity_id})
            </option>
          `)}
        </select>
      </div>
    `;
  }
  onScheduleChange(s) {
    const t = s.target;
    this.selectedScheduleId = t.value;
  }
  renderTimeGrid() {
    if (!this.selectedScheduleId || !this.schedules[this.selectedScheduleId])
      return l``;
    const s = this.schedules[this.selectedScheduleId], t = 200, e = 200, o = 180, r = 50;
    return l`
      <div class="timer-container">
        <svg class="timer-svg" viewBox="0 0 400 400">
          <!-- Border circles -->
          <circle cx="${t}" cy="${e}" r="${o}" 
                  fill="none" stroke="var(--divider-color)" stroke-width="2"/>
          <circle cx="${t}" cy="${e}" r="${r}" 
                  fill="none" stroke="var(--divider-color)" stroke-width="2"/>
          
          <!-- Dividing lines -->
          ${Array.from({ length: 24 }, (c, i) => {
      const a = (i * 360 / 24 - 90) * (Math.PI / 180), d = t + r * Math.cos(a), n = e + r * Math.sin(a), v = t + o * Math.cos(a), p = e + o * Math.sin(a);
      return l`
              <line x1="${d}" y1="${n}" x2="${v}" y2="${p}" 
                    stroke="var(--divider-color)" stroke-width="1"/>
            `;
    })}
          
          <!-- Outer ring (full hours) -->
          ${Array.from({ length: 24 }, (c, i) => {
      const a = i * 2, d = s.slots[a], n = this.currentSlot === a, v = this.createSectorPath(i, 24, r, o, t, e), p = this.getTextPosition(i, 24, (r + o) / 2, t, e);
      return l`
              <path d="${v}" 
                    fill="${d ? "var(--primary-color)" : "var(--card-background-color)"}"
                    stroke="${n ? "var(--accent-color)" : "var(--divider-color)"}"
                    stroke-width="${n ? "3" : "1"}"
                    class="sector"
                    @click="${() => this.toggleSlot(a)}"/>
              <text x="${p.x}" y="${p.y + 3}" 
                    text-anchor="middle" font-size="10" font-weight="bold"
                    class="sector-text"
                    fill="${d ? "var(--text-primary-color)" : "var(--primary-text-color)"}">
                ${this.getSlotTime(a)}
              </text>
            `;
    })}
          
          <!-- Inner ring (half hours) -->
          ${Array.from({ length: 24 }, (c, i) => {
      const a = i * 2 + 1, d = s.slots[a], n = this.currentSlot === a, v = this.createSectorPath(i, 24, 50, r, t, e), p = this.getTextPosition(i, 24, (50 + r) / 2, t, e);
      return l`
              <path d="${v}" 
                    fill="${d ? "var(--primary-color)" : "var(--card-background-color)"}"
                    stroke="${n ? "var(--accent-color)" : "var(--divider-color)"}"
                    stroke-width="${n ? "3" : "1"}"
                    class="sector"
                    @click="${() => this.toggleSlot(a)}"/>
              <text x="${p.x}" y="${p.y + 2}" 
                    text-anchor="middle" font-size="8" font-weight="bold"
                    class="sector-text"
                    fill="${d ? "var(--text-primary-color)" : "var(--primary-text-color)"}">
                ${this.getSlotTime(a)}
              </text>
            `;
    })}
        </svg>
      </div>
    `;
  }
  createSectorPath(s, t, e, o, r, c) {
    const i = (s * 360 / t - 90) * (Math.PI / 180), a = ((s + 1) * 360 / t - 90) * (Math.PI / 180), d = r + e * Math.cos(i), n = c + e * Math.sin(i), v = r + o * Math.cos(i), p = c + o * Math.sin(i), y = r + o * Math.cos(a), $ = c + o * Math.sin(a), S = r + e * Math.cos(a), w = c + e * Math.sin(a), x = a - i <= Math.PI ? 0 : 1;
    return `M ${d} ${n} L ${v} ${p} A ${o} ${o} 0 ${x} 1 ${y} ${$} L ${S} ${w} A ${e} ${e} 0 ${x} 0 ${d} ${n}`;
  }
  getTextPosition(s, t, e, o, r) {
    const c = ((s + 0.5) * 360 / t - 90) * (Math.PI / 180), i = o + e * Math.cos(c), a = r + e * Math.sin(c);
    return { x: i, y: a };
  }
  renderScheduleInfo() {
    if (!this.selectedScheduleId || !this.schedules[this.selectedScheduleId])
      return l``;
    const s = this.schedules[this.selectedScheduleId], t = s.slots.filter((e) => e).length;
    return l`
      <div class="schedule-info">
        <div class="info-item">
          <span class="label">${h.t(this.language, "schedule.target_entity")}:</span>
          <span class="value">${s.target_entity_id}</span>
        </div>
        <div class="info-item">
          <span class="label">${h.t(this.language, "schedule.active_slots")}:</span>
          <span class="value">${t} / 48</span>
        </div>
        <div class="info-item">
          <span class="label">${h.t(this.language, "card.current_slot")}:</span>
          <span class="value">${this.getSlotTime(this.currentSlot)}</span>
        </div>
        ${s.conditions.length > 0 ? l`
          <div class="info-item">
            <span class="label">${h.t(this.language, "schedule.conditions")}:</span>
            <span class="value">${s.conditions.length}</span>
          </div>
        ` : ""}
      </div>
    `;
  }
  render() {
    return this.loading ? l`
        <ha-card>
          <div class="card-content loading">
            ${h.t(this.language, "common.loading")}
          </div>
        </ha-card>
      ` : this.error ? l`
        <ha-card>
          <div class="card-content error">
            ${this.error}
          </div>
        </ha-card>
      ` : l`
      <ha-card>
        <div class="card-header">
          <div class="name">${this.config.title}</div>
        </div>
        
        <div class="card-content">
          ${this.renderScheduleSelector()}
          ${this.renderTimeGrid()}
          ${this.config.show_preview ? this.renderScheduleInfo() : ""}
        </div>
      </ha-card>
    `;
  }
  static get styles() {
    return b`
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
};
g([
  I({ attribute: !1 })
], u.prototype, "hass", 2);
g([
  m()
], u.prototype, "config", 2);
g([
  m()
], u.prototype, "schedules", 2);
g([
  m()
], u.prototype, "selectedScheduleId", 2);
g([
  m()
], u.prototype, "currentSlot", 2);
g([
  m()
], u.prototype, "nextSlotTime", 2);
g([
  m()
], u.prototype, "loading", 2);
g([
  m()
], u.prototype, "error", 2);
g([
  m()
], u.prototype, "language", 2);
u = g([
  k("timer-24h-card")
], u);
console.info(
  "%c  TIMER-24H-CARD  %c  Version 1.0.0  ",
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray"
);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "timer-24h-card",
  name: "Timer 24H Card",
  description: "A 24-hour timer card with server-side integration support",
  preview: !0,
  documentationURL: "https://github.com/home-assistant-community/timer-24h"
});
export {
  u as Timer24HCard
};
//# sourceMappingURL=timer-24h-card.js.map
