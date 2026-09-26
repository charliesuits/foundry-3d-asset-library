/**
 * Asset Library — the browser UI shared by the prop and token windows.
 *
 * Faceted search: every facet narrows the result, facets combine with AND, the values
 * inside one facet combine with OR, and each value shows how many results it would give
 * with everything else you have picked — so a zero never surprises you.
 *
 * The grid uses <li data-output> exactly like 3D Canvas's own browser, so its selection,
 * drag-and-drop, shift-click placement, paint and scatter tools all keep working.
 * Nothing else in this window may use <li>: 3D Canvas's shift-select walks every <li>.
 */
import {
  MODULE_ID, userData, toggleFavorite, toggleHidden, addToCollection, removeFromCollection,
  deleteCollection, setTags, setOverride, TYPE_GROUP_ORDER, SIZE_BUCKETS, DETAIL_BUCKETS, TYPE_GROUP_OF,
} from "./library.js";

const PAGE = 160;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtInt = (n) => (n == null ? "?" : n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

// ───────────────────────────────────────────── facet definitions ──
export const ASSET_FACETS = [
  { id: "source", label: "Source", kind: "source" },
  { id: "type", label: "Category", kind: "tree", keys: (i) => i.types, groups: (i) => [...new Set(i.types.map((t) => TYPE_GROUP_OF[t] || "Other"))], groupOrder: TYPE_GROUP_ORDER },
  { id: "theme", label: "Setting", kind: "list", keys: (i) => (i.themes.length ? i.themes : ["No setting"]) },
  { id: "condition", label: "Condition", kind: "list", keys: (i) => [i.condition || "Unmarked"], order: ["Pristine", "Broken & Ruined", "Mossy & Overgrown", "Snowy", "Unmarked"] },
  { id: "size", label: "Physical size", kind: "list", keys: (i) => [i.size], order: [...SIZE_BUCKETS.map((b) => b[0]), "Unknown"], keepOrder: true },
  { id: "detail", label: "Detail (triangles)", kind: "list", keys: (i) => [i.detail], order: [...DETAIL_BUCKETS.map((b) => b[0]), "Unknown"], keepOrder: true },
];
export const ASSET_FLAGS = [
  { id: "animated", label: "Animated only", icon: "fa-solid fa-play", test: (i) => i.animated },
  { id: "textured", label: "Hide untextured (flat grey)", icon: "fa-solid fa-fill-drip", test: (i) => !i.untextured },
  { id: "thumb", label: "Only with thumbnails", icon: "fa-regular fa-image", test: (i) => i.hasPreview },
  { id: "safe", label: "Hide models that may freeze (250k+)", icon: "fa-solid fa-triangle-exclamation", test: (i) => !(i.tris >= 250000) },
];
export const TOKEN_FACETS = [
  { id: "source", label: "Source", kind: "source" },
  { id: "creature", label: "Creature type", kind: "list", keys: (i) => [i.creature || "Unsorted"], order: ["Aberration", "Beast", "Celestial", "Construct", "Dragon", "Elemental", "Fey", "Fiend", "Giant", "Humanoid", "Monstrosity", "Ooze", "Plant", "Undead", "Object / Effect", "Unsorted"], keepOrder: true },
  { id: "role", label: "Role", kind: "list", keys: (i) => [i.role || "Enemy"], order: ["Boss", "Enemy", "NPC", "Adventurer / PC", "Summon / Esper"], keepOrder: true },
  { id: "size5e", label: "Size (5e)", kind: "list", keys: (i) => [i.size5e || "Unknown"], order: ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan", "Unknown"], keepOrder: true },
  { id: "cr", label: "Challenge", kind: "list", keys: (i) => [i.cr || "Unknown"], order: ["CR 0–½", "CR 1–4", "CR 5–10", "CR 11–16", "CR 17 +", "Unknown"], keepOrder: true },
  { id: "env", label: "Habitat (5e)", kind: "list", keys: (i) => (i.env?.length ? i.env.map(prettyEnv) : ["Unknown"]) },
  { id: "detail", label: "Detail (triangles)", kind: "list", keys: (i) => [i.detail], order: [...DETAIL_BUCKETS.map((b) => b[0]), "Unknown"], keepOrder: true },
];
export const TOKEN_FLAGS = [
  { id: "animated", label: "Animated only", icon: "fa-solid fa-play", test: (i) => i.animated },
  { id: "static", label: "Static only", icon: "fa-solid fa-pause", test: (i) => !i.animated },
  { id: "painted", label: "Painted only (hide grey sculpts)", icon: "fa-solid fa-palette", test: (i) => i.painted !== false && !i.untextured },
  { id: "thumb", label: "Only with thumbnails", icon: "fa-regular fa-image", test: (i) => i.hasPreview },
];
function prettyEnv(e) {
  return e.replace(/^planar, /, "Plane: ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ASSET_SORTS = {
  name: ["Name A–Z", (a, b) => a.name.localeCompare(b.name)],
  newest: ["Newest first", (a, b) => (b.mdays ?? 0) - (a.mdays ?? 0) || a.name.localeCompare(b.name)],
  source: ["Source, then collection", (a, b) => a.source.localeCompare(b.source) || (a.collection || "").localeCompare(b.collection || "") || a.name.localeCompare(b.name)],
  type: ["Category", (a, b) => (a.type || a.creature || "").localeCompare(b.type || b.creature || "") || a.name.localeCompare(b.name)],
  small: ["Size: small → large", (a, b) => (a.dim ?? 1e9) - (b.dim ?? 1e9)],
  large: ["Size: large → small", (a, b) => (b.dim ?? -1) - (a.dim ?? -1)],
  light: ["Detail: light → heavy", (a, b) => (a.tris ?? 1e12) - (b.tris ?? 1e12)],
  heavy: ["Detail: heavy → light", (a, b) => (b.tris ?? -1) - (a.tris ?? -1)],
};
export const TOKEN_SORTS = {
  name: ASSET_SORTS.name, newest: ASSET_SORTS.newest, source: ASSET_SORTS.source,
  type: ["Creature type", (a, b) => (a.creature || "").localeCompare(b.creature || "") || a.name.localeCompare(b.name)],
  light: ASSET_SORTS.light, heavy: ASSET_SORTS.heavy,
};

const DEFAULT_STATE = () => ({
  view: "all", q: "", sort: "name", thumb: 110, layout: "grid", sidebar: true, hover: true,
  sel: {}, flags: {}, open: { source: true, type: true, theme: false, creature: true, role: true },
  expanded: {},
});

// ───────────────────────────────────────────── the view ──
export class LibraryView {
  /**
   * @param {object} o
   * @param {"asset"|"token"} o.kind
   * @param {HTMLElement} o.root     element to render into
   * @param {object[]} o.items
   * @param {Function} o.onActivate  (item, event) => void   single click (tokens)
   * @param {Function} o.onListRendered (liElements) => void  wire 3D Canvas listeners
   * @param {Function} o.onCount (visible, total) => void
   */
  constructor(o) {
    Object.assign(this, o);
    this.facets = o.kind === "asset" ? ASSET_FACETS : TOKEN_FACETS;
    this.flagDefs = o.kind === "asset" ? ASSET_FLAGS : TOKEN_FLAGS;
    this.sorts = o.kind === "asset" ? ASSET_SORTS : TOKEN_SORTS;
    this.state = foundry.utils.mergeObject(DEFAULT_STATE(), this.loadState(), { inplace: false });
    for (const f of this.facets) this.state.sel[f.id] = new Set(this.state.sel[f.id] || []);
    this.state.sel.coll = new Set(this.state.sel.coll || []);
    this.state.sel.group = new Set(this.state.sel.group || []);
    this.results = [];
    this.shown = 0;
    this._refresh = foundry.utils.debounce(() => this.refresh(), 140);
  }

  // ── persistence of the UI state (client-side, per kind)
  loadState() {
    try { return game.settings.get(MODULE_ID, `state-${this.kind}`) || {}; } catch { return {}; }
  }
  saveState() {
    const s = { ...this.state, sel: {} };
    for (const [k, v] of Object.entries(this.state.sel)) s.sel[k] = [...v];
    game.settings.set(MODULE_ID, `state-${this.kind}`, s).catch(() => {});
  }

  // ── skeleton
  render() {
    this.destroy();
    const r = this.root;
    r.classList.add("al-root", `al-${this.kind}`);
    r.innerHTML = `
      <aside class="al-sidebar ${this.state.sidebar ? "" : "collapsed"}">
        <div class="al-views"></div>
        <div class="al-flags"></div>
        <div class="al-facets"></div>
      </aside>
      <section class="al-main">
        <div class="al-toolbar">
          <button type="button" class="al-icon-btn al-toggle-sidebar" data-tooltip="Show / hide filters"><i class="fa-solid fa-filter"></i></button>
          <div class="al-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="search" autocomplete="off" spellcheck="false" placeholder="Search names, folders, tags…  use -word to exclude, &quot;quotes&quot; for phrases" value="${esc(this.state.q)}">
            <button type="button" class="al-clear-search" data-tooltip="Clear search"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <select class="al-sort" data-tooltip="Sort">${Object.entries(this.sorts).map(([k, [l]]) => `<option value="${k}" ${k === this.state.sort ? "selected" : ""}>${l}</option>`).join("")}</select>
          <button type="button" class="al-icon-btn al-layout" data-tooltip="Grid / list"><i class="fa-solid ${this.state.layout === "grid" ? "fa-list" : "fa-grip"}"></i></button>
          <input type="range" class="al-thumb" min="64" max="240" step="8" value="${this.state.thumb}" data-tooltip="Thumbnail size">
          <button type="button" class="al-icon-btn al-hover-toggle ${this.state.hover ? "active" : ""}" data-tooltip="Details on hover"><i class="fa-regular fa-id-card"></i></button>
        </div>
        <div class="al-chips"></div>
        <div class="al-status"><span class="al-count"></span></div>
        <ol class="al-grid layout-${this.state.layout}" style="--al-thumb:${this.state.thumb}px"></ol>
        <div class="al-sentinel"></div>
      </section>
      <div class="al-hovercard hidden"></div>
      <div class="al-menu hidden"></div>`;
    this.el = {
      sidebar: r.querySelector(".al-sidebar"), views: r.querySelector(".al-views"), flags: r.querySelector(".al-flags"),
      facets: r.querySelector(".al-facets"), search: r.querySelector("#search"), grid: r.querySelector(".al-grid"),
      chips: r.querySelector(".al-chips"), count: r.querySelector(".al-count"), sentinel: r.querySelector(".al-sentinel"),
      hover: r.querySelector(".al-hovercard"), menu: r.querySelector(".al-menu"), main: r.querySelector(".al-main"),
    };
    this.bind();
    this.refresh();
  }

  bind() {
    const r = this.root;
    this.el.search.addEventListener("input", () => { this.state.q = this.el.search.value; this._refresh(); });
    this.el.search.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.el.search.value) { e.stopPropagation(); e.preventDefault(); this.el.search.value = ""; this.state.q = ""; this.refresh(); }
    });
    r.querySelector(".al-clear-search").addEventListener("click", () => { this.el.search.value = ""; this.state.q = ""; this.refresh(); });
    r.querySelector(".al-sort").addEventListener("change", (e) => { this.state.sort = e.target.value; this.refresh(); });
    r.querySelector(".al-layout").addEventListener("click", (e) => {
      this.state.layout = this.state.layout === "grid" ? "list" : "grid";
      this.el.grid.className = `al-grid layout-${this.state.layout}`;
      e.currentTarget.querySelector("i").className = `fa-solid ${this.state.layout === "grid" ? "fa-list" : "fa-grip"}`;
      this.saveState();
    });
    r.querySelector(".al-thumb").addEventListener("input", (e) => {
      this.state.thumb = Number(e.target.value);
      this.el.grid.style.setProperty("--al-thumb", `${this.state.thumb}px`);
    });
    r.querySelector(".al-thumb").addEventListener("change", () => this.saveState());
    r.querySelector(".al-toggle-sidebar").addEventListener("click", () => {
      this.state.sidebar = !this.state.sidebar;
      this.el.sidebar.classList.toggle("collapsed", !this.state.sidebar);
      this.saveState();
    });
    r.querySelector(".al-hover-toggle").addEventListener("click", (e) => {
      this.state.hover = !this.state.hover;
      e.currentTarget.classList.toggle("active", this.state.hover);
      this.hideHover();
      this.saveState();
    });
    // sidebar: one delegated handler
    this.el.sidebar.addEventListener("click", (e) => this.onSidebarClick(e));
    this.el.sidebar.addEventListener("contextmenu", (e) => this.onSidebarContext(e));
    this.el.chips.addEventListener("click", (e) => this.onChipClick(e));
    // infinite scroll
    this._io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) this.renderMore();
    }, { root: this.el.main, rootMargin: "600px" });
    this._io.observe(this.el.sentinel);
    // grid: hover + context menu
    this.el.grid.addEventListener("mouseover", (e) => this.onGridHover(e));
    this.el.grid.addEventListener("mouseleave", () => this.hideHover());
    this.el.grid.addEventListener("contextmenu", (e) => this.onGridContext(e));
    this.el.grid.addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (!li) return;
      if (e.target.closest(".al-fav")) { e.stopPropagation(); this.toggleFav(li.dataset.output, li); return; }
      const item = this.byPath.get(li.dataset.output);
      if (item && this.onActivate) this.onActivate(item, e, li);
    });
    document.addEventListener("pointerdown", this._closeMenu = (e) => { if (!e.target.closest(".al-menu")) this.hideMenu(); }, true);
  }

  destroy() {
    this._io?.disconnect();
    if (this._closeMenu) document.removeEventListener("pointerdown", this._closeMenu, true);
  }

  setItems(items) {
    this.items = items;
    this.byPath = new Map(items.map((i) => [i.path, i]));
    this.refresh();
  }

  // ───────────────────────────────────────── filtering
  parseQuery(q) {
    const inc = [], exc = [];
    const re = /(-?)"([^"]+)"|(-?)(\S+)/g;
    let m;
    while ((m = re.exec(q.toLowerCase()))) {
      const neg = m[1] || m[3];
      const term = (m[2] || m[4] || "").replace(/[_\-]+/g, " ").trim();
      if (!term || term === "-") continue;
      (neg ? exc : inc).push(term);
    }
    return { inc, exc };
  }

  viewSet() {
    const u = userData();
    const v = this.state.view;
    if (v === "fav") return new Set(u.favorites);
    if (v === "recent") return new Set(u.recent);
    if (v === "hidden") return new Set(u.hidden);
    if (v.startsWith("coll:")) return new Set(u.collections[v.slice(5)] || []);
    return null;
  }

  /** facet test for one item. */
  facetPass(f, it) {
    const sel = this.state.sel;
    if (f.kind === "source") {
      if (!sel.source.size && !sel.coll.size) return true;
      return sel.source.has(it.source) || sel.coll.has(`${it.source}::${it.collection}`);
    }
    if (f.kind === "tree") {
      if (!sel[f.id].size && !sel.group.size) return true;
      return f.keys(it).some((k) => sel[f.id].has(k)) || f.groups(it).some((g) => sel.group.has(g));
    }
    const s = sel[f.id];
    if (!s.size) return true;
    for (const k of f.keys(it)) if (s.has(k)) return true;
    return false;
  }

  refresh() {
    if (!this.items) return;
    const t0 = performance.now();
    const { inc, exc } = this.parseQuery(this.state.q || "");
    const u = userData();
    const hidden = new Set(u.hidden);
    const tags = u.tags;
    const vset = this.viewSet();
    const showHidden = this.state.view === "hidden";
    const flags = this.flagDefs.filter((f) => this.state.flags[f.id]);
    const facets = this.facets;
    const nF = facets.length;
    const ALL = (1 << nF) - 1;

    // counters: facet id → Map(value → n), plus source/collection and tree groups
    const counts = {};
    for (const f of facets) counts[f.id] = new Map();
    const collCounts = new Map();
    const groupCounts = new Map();
    const viewCounts = { all: 0 };

    const results = [];
    for (const it of this.items) {
      const isHidden = hidden.has(it.path);
      if (isHidden !== showHidden) continue;
      // search
      let ok = true;
      if (inc.length || exc.length) {
        const hay = tags[it.path] ? it.search + " " + tags[it.path].join(" ") : it.search;
        for (const t of inc) if (!hay.includes(t)) { ok = false; break; }
        if (ok) for (const t of exc) if (hay.includes(t)) { ok = false; break; }
      }
      if (!ok) continue;
      if (flags.length && !flags.every((f) => f.test(it))) continue;
      if (vset && !vset.has(it.path)) continue;
      let mask = 0;
      for (let i = 0; i < nF; i++) if (this.facetPass(facets[i], it)) mask |= 1 << i;
      if (mask === ALL) results.push(it);
      // facet counts: counts toward facet i if it passes every OTHER facet
      for (let i = 0; i < nF; i++) {
        if ((mask | (1 << i)) !== ALL) continue;
        const f = facets[i];
        if (f.kind === "source") {
          counts.source.set(it.source, (counts.source.get(it.source) || 0) + 1);
          const ck = `${it.source}::${it.collection}`;
          collCounts.set(ck, (collCounts.get(ck) || 0) + 1);
        } else if (f.kind === "tree") {
          for (const k of f.keys(it)) counts[f.id].set(k, (counts[f.id].get(k) || 0) + 1);
          for (const g of f.groups(it)) groupCounts.set(g, (groupCounts.get(g) || 0) + 1);
        } else {
          for (const k of f.keys(it)) counts[f.id].set(k, (counts[f.id].get(k) || 0) + 1);
        }
      }
    }
    const sorter = (this.sorts[this.state.sort] || this.sorts.name)[1];
    if (this.state.view === "recent") {
      const order = new Map(u.recent.map((p, i) => [p, i]));
      results.sort((a, b) => order.get(a.path) - order.get(b.path));
    } else results.sort(sorter);

    this.results = results;
    this.counts = { counts, collCounts, groupCounts };
    this.renderSidebar();
    this.renderChips();
    this.el.grid.innerHTML = "";
    this.shown = 0;
    this.el.main.scrollTop = 0;
    this.renderMore();
    const hiddenNote = this.state.view !== "hidden" && hidden.size ? ` · ${hidden.size} hidden` : "";
    this.el.count.textContent = `${results.length.toLocaleString()} of ${this.items.length.toLocaleString()}${hiddenNote}`;
    this.onCount?.(results.length, this.items.length);
    this.saveState();
    this._lastMs = Math.round(performance.now() - t0);
  }

  // ───────────────────────────────────────── grid
  renderMore() {
    if (!this.results || this.shown >= this.results.length) return;
    const u = userData();
    const fav = new Set(u.favorites);
    const slice = this.results.slice(this.shown, this.shown + PAGE);
    const html = slice.map((it) => this.itemHTML(it, fav.has(it.path))).join("");
    this.el.grid.insertAdjacentHTML("beforeend", html);
    const lis = [...this.el.grid.querySelectorAll("li:not([data-wired])")];
    for (const li of lis) {
      li.dataset.wired = "1";
      const img = li.querySelector("img");
      if (img) img.addEventListener("error", () => li.classList.add("no-thumb"), { once: true });
    }
    this.onListRendered?.(lis);
    this.shown += slice.length;
  }

  itemHTML(it, isFav) {
    const badges = [];
    if (it.animated) badges.push(`<i class="fa-solid fa-play" data-tooltip="Animated (${it.anims} clip${it.anims === 1 ? "" : "s"})"></i>`);
    if (it.tris >= 250000) badges.push(`<i class="fa-solid fa-triangle-exclamation al-warn" data-tooltip="${fmtInt(it.tris)} triangles — may freeze 3D Canvas"></i>`);
    else if (it.tris >= 150000) badges.push(`<i class="fa-solid fa-weight-hanging" data-tooltip="${fmtInt(it.tris)} triangles"></i>`);
    if (it.untextured) badges.push(`<i class="fa-solid fa-fill-drip al-grey" data-tooltip="No textures (flat grey)"></i>`);
    const meta = this.kind === "asset"
      ? `${esc(it.type)} · ${esc(it.collection)}${it.themes?.length ? " · " + esc(it.themes.slice(0, 2).join(", ")) : ""}`
      : `${esc(it.creature)}${it.size5e ? " · " + esc(it.size5e) : ""}${it.cr ? " · " + esc(it.cr) : ""}`;
    const img = it.hasPreview ? `<img src="${esc(it.preview)}" alt="" loading="lazy" decoding="async">` : "";
    return `<li draggable="true" class="${it.hasPreview ? "" : "no-thumb"}" data-output="${esc(it.path)}" data-src="${esc(it.preview)}" data-displayname="${esc(it.name)}" data-search="${esc(it.search)}">
      ${img}<span class="al-ph"><i class="fa-solid fa-cube"></i></span>
      <span class="al-src" data-tooltip="${esc(it.source)} › ${esc(it.collection)}">${esc(it.sourceShort)}</span>
      <a class="al-fav ${isFav ? "on" : ""}" data-tooltip="Favourite"><i class="fa-${isFav ? "solid" : "regular"} fa-star"></i></a>
      <span class="al-badges">${badges.join("")}</span>
      <i class="material-name">${esc(it.name)}</i>
      <span class="al-meta">${meta}</span>
    </li>`;
  }

  toggleFav(path, li) {
    const on = toggleFavorite(path);
    const a = li?.querySelector(".al-fav");
    if (a) { a.classList.toggle("on", on); a.innerHTML = `<i class="fa-${on ? "solid" : "regular"} fa-star"></i>`; }
    if (this.state.view === "fav") this.refresh(); else this.renderViews();
  }

  // ───────────────────────────────────────── hover card
  onGridHover(e) {
    if (!this.state.hover) return;
    const li = e.target.closest("li");
    if (!li || li === this._hoverLi) return;
    this._hoverLi = li;
    clearTimeout(this._hoverT);
    this.hideHover(true);
    this._hoverT = setTimeout(() => this.showHover(li), 450);
  }
  hideHover(keepLi) {
    clearTimeout(this._hoverT);
    if (!keepLi) this._hoverLi = null;
    this.el.hover.classList.add("hidden");
  }
  showHover(li) {
    if (!li.isConnected || this._hoverLi !== li) return;
    const it = this.byPath.get(li.dataset.output);
    if (!it) return;
    const u = userData();
    const rows = [];
    rows.push(["Source", `${esc(it.source)} › ${esc(it.collection)}`]);
    if (this.kind === "asset") {
      rows.push(["Category", `${esc(it.group)} › ${esc(it.type)}`]);
      if (it.types?.length > 1) rows.push(["Also in", esc(it.types.slice(1).map((t) => `${TYPE_GROUP_OF[t] || "Other"} › ${t}`).join(", "))]);
      if (it.themes.length) rows.push(["Setting", esc(it.themes.join(", "))]);
      if (it.condition) rows.push(["Condition", esc(it.condition)]);
      if (it.dim != null) rows.push(["Size", `${it.dim} m longest side`]);
    } else {
      rows.push(["Creature", `${esc(it.creature)}${it.size5e ? " · " + esc(it.size5e) : ""}${it.cr ? " · " + esc(it.cr) : ""}`]);
      rows.push(["Role", esc(it.role)]);
    }
    rows.push(["Detail", `${fmtInt(it.tris)} triangles${it.kb ? ` · ${it.kb >= 1024 ? (it.kb / 1024).toFixed(1) + " MB" : it.kb + " KB"}` : ""}`]);
    if (it.animated) rows.push(["Animation", `${it.anims} clip${it.anims === 1 ? "" : "s"}${it.rigged ? " · rigged" : ""}`]);
    if (u.tags[it.path]?.length) rows.push(["Tags", esc(u.tags[it.path].join(", "))]);
    const inColl = Object.entries(u.collections).filter(([, ps]) => ps.includes(it.path)).map(([n]) => n);
    if (inColl.length) rows.push(["In", esc(inColl.join(", "))]);
    this.el.hover.innerHTML = `
      ${it.hasPreview ? `<img src="${esc(it.preview)}" alt="">` : `<div class="al-ph big"><i class="fa-solid fa-cube"></i></div>`}
      <h3>${esc(it.name)}</h3>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
      <code>${esc(decodeURIComponent(it.path))}</code>`;
    const host = this.root.getBoundingClientRect();
    const b = li.getBoundingClientRect();
    const W = 300;
    let left = b.right - host.left + 8;
    if (left + W > host.width) left = b.left - host.left - W - 8;
    if (left < 0) left = Math.max(4, host.width - W - 4);
    const top = Math.max(4, Math.min(b.top - host.top, host.height - 420));
    Object.assign(this.el.hover.style, { left: `${left}px`, top: `${top}px`, width: `${W}px` });
    this.el.hover.querySelector("img")?.addEventListener("error", (ev) => ev.target.replaceWith(Object.assign(document.createElement("div"), { className: "al-ph big", innerHTML: '<i class="fa-solid fa-cube"></i>' })), { once: true });
    this.el.hover.classList.remove("hidden");
  }

  // ───────────────────────────────────────── context menu
  selectedPaths(fallback) {
    const sel = [...this.el.grid.querySelectorAll("li.selected")].map((l) => l.dataset.output);
    if (fallback && !sel.includes(fallback)) return [fallback];
    return sel.length ? sel : fallback ? [fallback] : [];
  }

  onGridContext(e) {
    const li = e.target.closest("li");
    if (!li) return;
    e.preventDefault();
    e.stopPropagation();
    this.hideHover();
    const path = li.dataset.output;
    const paths = this.selectedPaths(path);
    const n = paths.length;
    const u = userData();
    const it = this.byPath.get(path);
    const isFav = u.favorites.includes(path);
    const isHidden = u.hidden.includes(path);
    const colls = Object.keys(u.collections).sort();
    const viewColl = this.state.view.startsWith("coll:") ? this.state.view.slice(5) : null;
    const items = [
      { icon: `fa-${isFav ? "solid" : "regular"} fa-star`, label: isFav ? "Remove from favourites" : `Add ${n > 1 ? n + " to" : "to"} favourites`, act: () => {
        for (const p of paths) { const on = u.favorites.includes(p); if (on === isFav) toggleFavorite(p); }
        this.refresh();
      } },
      { icon: "fa-solid fa-folder-plus", label: `Add ${n > 1 ? n + " " : ""}to collection`, sub: [
        ...colls.map((c) => ({ label: c, act: () => { addToCollection(c, paths); ui.notifications.info(`Added ${n} to “${c}”.`); this.renderViews(); } })),
        { icon: "fa-solid fa-plus", label: "New collection…", act: async () => {
          const name = await promptText("New collection", "Name", "");
          if (!name) return;
          addToCollection(name, paths);
          this.renderViews();
        } },
      ] },
      viewColl && { icon: "fa-solid fa-folder-minus", label: `Remove from “${viewColl}”`, act: () => { removeFromCollection(viewColl, paths); this.refresh(); } },
      { icon: "fa-solid fa-tags", label: "Tags…", act: async () => {
        const cur = (u.tags[path] || []).join(", ");
        const val = await promptText("Tags", "Comma-separated — searchable", cur);
        if (val == null) return;
        for (const p of paths) setTags(p, val.split(","));
        this.refresh();
      } },
      this.kind === "asset" && { icon: "fa-solid fa-shapes", label: "Change category…", act: async () => {
        const type = await pickCategory(it?.type);
        if (type === undefined) return;
        for (const p of paths) {
          setOverride(p, { type });
          const x = this.byPath.get(p);
          if (x && type) { x.type = type; x.types = [type]; x.group = TYPE_GROUP_OF[type] || x.group; }
        }
        ui.notifications.info(type ? `Moved ${n} to ${type}.` : "Category reset — reopen the library to see the original.");
        this.refresh();
      } },
      { icon: `fa-solid ${isHidden ? "fa-eye" : "fa-eye-slash"}`, label: isHidden ? `Unhide ${n > 1 ? n : ""}` : `Hide ${n > 1 ? n + " " : ""}from library`, act: () => {
        for (const p of paths) { const h = u.hidden.includes(p); if (h === isHidden) toggleHidden(p); }
        this.refresh();
      } },
      { sep: true },
      it && { icon: "fa-solid fa-layer-group", label: `Show all of “${it.collection}”`, act: () => {
        this.clearFilters(false);
        this.state.sel.coll.add(`${it.source}::${it.collection}`);
        this.state.expanded[`src:${it.source}`] = true;
        this.refresh();
      } },
      it && this.kind === "asset" && { icon: "fa-solid fa-clone", label: `More ${it.type} from ${it.sourceShort}`, act: () => {
        this.clearFilters(false);
        this.state.sel.source.add(it.source);
        this.state.sel.type.add(it.type);
        this.refresh();
      } },
      { icon: "fa-regular fa-copy", label: "Copy file path", act: () => { game.clipboard.copyPlainText(decodeURIComponent(path)); ui.notifications.info("Path copied."); } },
    ].filter(Boolean);
    this.showMenu(items, e.clientX, e.clientY);
  }

  showMenu(items, x, y) {
    const m = this.el.menu;
    const html = (list) => list.map((i, idx) => i.sep ? `<hr>` : `<div class="al-mi ${i.sub ? "has-sub" : ""}" data-i="${idx}"><i class="${i.icon || ""}"></i><span>${esc(i.label)}</span>${i.sub ? `<i class="fa-solid fa-caret-right"></i><div class="al-sub">${html(i.sub).replaceAll('data-i="', 'data-s="')}</div>` : ""}</div>`).join("");
    m.innerHTML = html(items);
    m.onclick = (e) => {
      const s = e.target.closest("[data-s]");
      const t = e.target.closest("[data-i]");
      if (s) {
        const parent = items[Number(s.parentElement.closest("[data-i]").dataset.i)];
        parent.sub[Number(s.dataset.s)].act();
        this.hideMenu();
      } else if (t && !items[Number(t.dataset.i)].sub) {
        items[Number(t.dataset.i)].act();
        this.hideMenu();
      }
    };
    const host = this.root.getBoundingClientRect();
    m.classList.remove("hidden");
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = `${Math.min(x - host.left, host.width - w - 4)}px`;
    m.style.top = `${Math.min(y - host.top, host.height - h - 4)}px`;
    m.classList.toggle("flip-sub", x - host.left + w * 2 > host.width);
  }
  hideMenu() { this.el?.menu?.classList.add("hidden"); }

  // ───────────────────────────────────────── sidebar
  renderSidebar() {
    this.renderViews();
    this.renderFlags();
    const openScroll = this.el.facets.scrollTop;
    this.el.facets.innerHTML = this.facets.map((f) => this.facetHTML(f)).join("");
    this.el.facets.scrollTop = openScroll;
  }

  renderViews() {
    const u = userData();
    const v = this.state.view;
    const inKind = (ps) => ps.filter((p) => this.byPath?.has(p)).length;
    const row = (id, icon, label, n, extra = "") => `<div class="al-view ${v === id ? "active" : ""}" data-view="${esc(id)}" ${extra}><i class="${icon}"></i><span>${esc(label)}</span><em>${n}</em></div>`;
    const colls = Object.entries(u.collections).filter(([, ps]) => inKind(ps) > 0 || true).sort(([a], [b]) => a.localeCompare(b));
    this.el.views.innerHTML = `
      ${row("all", "fa-solid fa-cubes", this.kind === "asset" ? "All assets" : "All tokens", (this.items?.length || 0).toLocaleString())}
      ${row("fav", "fa-solid fa-star", "Favourites", inKind(u.favorites))}
      ${row("recent", "fa-solid fa-clock-rotate-left", "Recently used", inKind(u.recent))}
      <div class="al-subhead">My collections <a class="al-new-coll" data-tooltip="New empty collection"><i class="fa-solid fa-plus"></i></a></div>
      ${colls.length ? colls.map(([n, ps]) => row(`coll:${n}`, "fa-solid fa-folder", n, inKind(ps), `data-coll="${esc(n)}"`)).join("") : `<div class="al-empty">Right-click any asset → Add to collection</div>`}
      ${u.hidden.length ? row("hidden", "fa-solid fa-eye-slash", "Hidden", inKind(u.hidden)) : ""}`;
  }

  renderFlags() {
    this.el.flags.innerHTML = `<div class="al-subhead">Quick filters</div>` + this.flagDefs.map((f) =>
      `<label class="al-flag"><input type="checkbox" data-flag="${f.id}" ${this.state.flags[f.id] ? "checked" : ""}><i class="${f.icon}"></i><span>${esc(f.label)}</span></label>`).join("");
  }

  facetHTML(f) {
    const open = this.state.open[f.id] ?? false;
    const sel = this.state.sel;
    const nSel = f.kind === "source" ? sel.source.size + sel.coll.size : f.kind === "tree" ? sel[f.id].size + sel.group.size : sel[f.id].size;
    let body = "";
    const { counts, collCounts, groupCounts } = this.counts;
    if (open) {
      if (f.kind === "source") body = this.sourceTreeHTML(counts.source, collCounts);
      else if (f.kind === "tree") body = this.typeTreeHTML(f, counts[f.id], groupCounts);
      else {
        const m = counts[f.id];
        let keys = [...m.keys()];
        for (const k of sel[f.id]) if (!m.has(k)) keys.push(k);
        if (f.keepOrder && f.order) keys = f.order.filter((k) => keys.includes(k)).concat(keys.filter((k) => !f.order.includes(k)));
        else keys.sort((a, b) => (m.get(b) || 0) - (m.get(a) || 0) || a.localeCompare(b));
        body = keys.map((k) => this.optHTML(f.id, k, k, m.get(k) || 0, sel[f.id].has(k))).join("") || `<div class="al-empty">Nothing here</div>`;
      }
    }
    return `<div class="al-facet ${open ? "open" : ""}" data-facet="${f.id}">
      <div class="al-facet-head" data-toggle="${f.id}"><i class="fa-solid fa-caret-${open ? "down" : "right"}"></i><span>${esc(f.label)}</span>
        ${nSel ? `<a class="al-facet-clear" data-clear="${f.id}" data-tooltip="Clear">${nSel} <i class="fa-solid fa-xmark"></i></a>` : ""}</div>
      <div class="al-facet-body">${body}</div></div>`;
  }

  optHTML(facet, key, label, n, checked, extraCls = "", expander = "") {
    return `<div class="al-opt ${checked ? "checked" : ""} ${n ? "" : "zero"} ${extraCls}" data-facet="${facet}" data-key="${esc(key)}">
      ${expander}<i class="fa-${checked ? "solid fa-square-check" : "regular fa-square"}"></i><span>${esc(label)}</span><em>${n.toLocaleString()}</em></div>`;
  }

  sourceTreeHTML(srcCounts, collCounts) {
    const sel = this.state.sel;
    // group → source → collections, using all items so zero rows still show when selected
    const tree = new Map();
    for (const it of this.items) {
      if (!tree.has(it.sourceGroup)) tree.set(it.sourceGroup, new Map());
      const g = tree.get(it.sourceGroup);
      if (!g.has(it.source)) g.set(it.source, new Set());
      g.get(it.source).add(it.collection);
    }
    const groupOrder = ["Games", "Content packs", "Other modules"];
    return [...tree.entries()].sort(([a], [b]) => groupOrder.indexOf(a) - groupOrder.indexOf(b)).map(([g, sources]) => {
      const rows = [...sources.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([s, colls]) => {
        const n = srcCounts.get(s) || 0;
        const exp = this.state.expanded[`src:${s}`];
        const anyCollSel = [...colls].some((c) => sel.coll.has(`${s}::${c}`));
        const expander = colls.size > 1 ? `<a class="al-exp" data-exp="src:${esc(s)}"><i class="fa-solid fa-caret-${exp ? "down" : "right"}"></i></a>` : `<span class="al-exp-pad"></span>`;
        let out = this.optHTML("source", s, s, n, sel.source.has(s), anyCollSel ? "partial" : "", expander);
        if (exp) {
          const list = [...colls].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
          out += `<div class="al-children">` + list.map((c) => {
            const key = `${s}::${c}`;
            return this.optHTML("coll", key, c, collCounts.get(key) || 0, sel.coll.has(key));
          }).join("") + `</div>`;
        }
        return out;
      }).join("");
      return `<div class="al-group-label">${esc(g)}</div>${rows}`;
    }).join("");
  }

  typeTreeHTML(f, typeCounts, groupCounts) {
    const sel = this.state.sel;
    const groups = new Map();
    for (const it of this.items) {
      for (const k of f.keys(it)) {
        const g = TYPE_GROUP_OF[k] || "Other";
        if (!groups.has(g)) groups.set(g, new Set());
        groups.get(g).add(k);
      }
    }
    const order = f.groupOrder;
    return [...groups.entries()].sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)).map(([g, types]) => {
      const exp = this.state.expanded[`grp:${g}`];
      const n = groupCounts.get(g) || 0;
      const anyTypeSel = [...types].some((t) => sel[f.id].has(t));
      const expander = `<a class="al-exp" data-exp="grp:${esc(g)}"><i class="fa-solid fa-caret-${exp ? "down" : "right"}"></i></a>`;
      let out = this.optHTML("group", g, g, n, sel.group.has(g), anyTypeSel ? "partial" : "", expander);
      if (exp || anyTypeSel) {
        const list = [...types].sort((a, b) => (typeCounts.get(b) || 0) - (typeCounts.get(a) || 0));
        out += `<div class="al-children">` + list.map((t) => this.optHTML(f.id, t, t, typeCounts.get(t) || 0, sel[f.id].has(t))).join("") + `</div>`;
      }
      return out;
    }).join("");
  }

  onSidebarClick(e) {
    const t = e.target;
    const exp = t.closest("[data-exp]");
    if (exp) { e.stopPropagation(); const k = exp.dataset.exp; this.state.expanded[k] = !this.state.expanded[k]; this.renderSidebar(); this.saveState(); return; }
    const clr = t.closest("[data-clear]");
    if (clr) { e.stopPropagation(); this.clearFacet(clr.dataset.clear); this.refresh(); return; }
    const tog = t.closest("[data-toggle]");
    if (tog) { const id = tog.dataset.toggle; this.state.open[id] = !this.state.open[id]; this.renderSidebar(); this.saveState(); return; }
    const opt = t.closest(".al-opt");
    if (opt) {
      const facet = opt.dataset.facet, key = opt.dataset.key;
      const set = this.state.sel[facet];
      // plain click = only this; ctrl/shift/checkbox = add
      const additive = e.ctrlKey || e.metaKey || e.shiftKey || t.closest(".fa-square, .fa-square-check");
      if (set.has(key)) set.delete(key);
      else {
        if (!additive) {
          if (facet === "source" || facet === "coll") { this.state.sel.source.clear(); this.state.sel.coll.clear(); }
          else if (facet === "group" || this.facets.find((f) => f.id === facet)?.kind === "tree") { this.state.sel.group.clear(); for (const f of this.facets) if (f.kind === "tree") this.state.sel[f.id].clear(); }
          else set.clear();
        }
        set.add(key);
      }
      this.refresh();
      return;
    }
    const flag = t.closest("[data-flag]");
    if (flag && t.tagName === "INPUT") { this.state.flags[flag.dataset.flag] = t.checked; this.refresh(); return; }
    if (t.closest(".al-new-coll")) {
      promptText("New collection", "Name", "").then((name) => {
        if (!name) return;
        userData().collections[name] ??= [];
        addToCollection(name, []);
        this.state.view = `coll:${name}`;
        this.refresh();
      });
      return;
    }
    const view = t.closest("[data-view]");
    if (view) { this.state.view = view.dataset.view; this.refresh(); }
  }

  onSidebarContext(e) {
    const c = e.target.closest("[data-coll]");
    if (!c) return;
    e.preventDefault();
    const name = c.dataset.coll;
    this.showMenu([
      { icon: "fa-solid fa-pen", label: "Rename…", act: async () => {
        const n = await promptText("Rename collection", "Name", name);
        if (!n || n === name) return;
        const u = userData();
        u.collections[n] = u.collections[name];
        deleteCollection(name);
        if (this.state.view === `coll:${name}`) this.state.view = `coll:${n}`;
        this.refresh();
      } },
      { icon: "fa-solid fa-trash", label: "Delete collection", act: async () => {
        const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Delete collection" }, content: `<p>Delete “${esc(name)}”? The assets themselves are not touched.</p>` });
        if (!ok) return;
        deleteCollection(name);
        if (this.state.view === `coll:${name}`) this.state.view = "all";
        this.refresh();
      } },
    ], e.clientX, e.clientY);
  }

  clearFacet(id) {
    const sel = this.state.sel;
    if (id === "source") { sel.source.clear(); sel.coll.clear(); return; }
    const f = this.facets.find((x) => x.id === id);
    if (f?.kind === "tree") sel.group.clear();
    sel[id]?.clear();
  }
  clearFilters(refresh = true) {
    for (const k of Object.keys(this.state.sel)) this.state.sel[k].clear();
    this.state.flags = {};
    this.state.view = "all";
    this.state.q = "";
    if (this.el?.search) this.el.search.value = "";
    if (refresh) this.refresh();
  }

  // ── chips: what is active, one click to remove
  renderChips() {
    const chips = [];
    const sel = this.state.sel;
    const label = (id) => this.facets.find((f) => f.id === id)?.label || id;
    if (this.state.view !== "all") {
      const v = this.state.view;
      chips.push({ k: "view", v, t: v === "fav" ? "Favourites" : v === "recent" ? "Recently used" : v === "hidden" ? "Hidden" : `Collection: ${v.slice(5)}` });
    }
    for (const s of sel.source) chips.push({ k: "source", v: s, t: s });
    for (const c of sel.coll) chips.push({ k: "coll", v: c, t: c.replace("::", " › ") });
    for (const g of sel.group) chips.push({ k: "group", v: g, t: g });
    for (const f of this.facets) if (f.kind !== "source") for (const v of sel[f.id]) chips.push({ k: f.id, v, t: `${label(f.id)}: ${v}` });
    for (const f of this.flagDefs) if (this.state.flags[f.id]) chips.push({ k: "flag", v: f.id, t: f.label });
    this.el.chips.innerHTML = chips.map((c) => `<span class="al-chip" data-k="${esc(c.k)}" data-v="${esc(c.v)}">${esc(c.t)} <i class="fa-solid fa-xmark"></i></span>`).join("")
      + (chips.length > 1 ? `<a class="al-chip al-clear-all" data-k="all">Clear all</a>` : "");
    this.el.chips.classList.toggle("empty", !chips.length);
  }
  onChipClick(e) {
    const c = e.target.closest(".al-chip");
    if (!c) return;
    const { k, v } = c.dataset;
    if (k === "all") return this.clearFilters();
    if (k === "view") this.state.view = "all";
    else if (k === "flag") this.state.flags[v] = false;
    else this.state.sel[k]?.delete(v);
    this.refresh();
  }
}

// ───────────────────────────────────────────── small dialogs ──
export async function promptText(title, label, value) {
  let out = null;
  try {
    await foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: `<div class="form-group"><label>${esc(label)}</label><div class="form-fields"><input type="text" name="v" value="${esc(value)}" autofocus></div></div>`,
      ok: { callback: (event, button) => { out = button.form.elements.v.value.trim(); } },
      rejectClose: false,
    });
  } catch { return null; }
  return out;
}

async function pickCategory(current) {
  const byGroup = new Map();
  for (const [t, g] of Object.entries(TYPE_GROUP_OF)) {
    if (!byGroup.has(g)) byGroup.set(g, []);
    if (!byGroup.get(g).includes(t)) byGroup.get(g).push(t);
  }
  const opts = TYPE_GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) =>
    `<optgroup label="${esc(g)}">${byGroup.get(g).sort().map((t) => `<option value="${esc(t)}" ${t === current ? "selected" : ""}>${esc(t)}</option>`).join("")}</optgroup>`).join("");
  let out;
  try {
    await foundry.applications.api.DialogV2.prompt({
      window: { title: "Change category" },
      content: `<div class="form-group"><label>Category</label><div class="form-fields"><select name="t"><option value="">— reset to automatic —</option>${opts}</select></div></div>`,
      ok: { callback: (event, button) => { out = button.form.elements.t.value; } },
      rejectClose: false,
    });
  } catch { return undefined; }
  return out;
}
