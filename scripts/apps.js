/**
 * Asset Library — the two windows.
 *
 * AssetLibrary SUBCLASSES 3D Canvas's own AssetBrowser rather than imitating it. The
 * Options and Utility panels, shift-click placement, paint, smart scatter, scale, tint
 * and drag-and-drop are 3D Canvas's code, running unchanged; only the content part —
 * the search, filters and grid — is replaced.
 *
 * TokenLibrary is a fresh window that does what 3D Canvas's token picker does (fill the
 * token's model field, drag a model onto the canvas) with the same filtering UI.
 */
import { MODULE_ID, getItems, loadUserData, pushRecent, invalidate, hasCatalog, rebuildCatalog } from "./library.js";

// ── the shared catalog (sizes, triangle counts, animations) is built once per server by a GM
let _offered = false;
async function runCatalogBuild(app, { full = false } = {}) {
  const say = (m) => {
    let l = app.element?.querySelector(".al-loading");
    if (!l) { const g = app.element?.querySelector(".al-grid"); if (g) { g.innerHTML = `<div class="al-loading"></div>`; l = g.firstChild; } }
    if (l) l.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${m}`;
  };
  try {
    const st = await rebuildCatalog({ full, progress: say });
    ui.notifications.info(`3D Asset Library catalog ready: ${st.assets.toLocaleString()} assets, ${st.tokens.toLocaleString()} tokens${st.failed ? ` (${st.failed} files could not be read)` : ""}.`);
  } catch (e) {
    console.error(e);
    ui.notifications.error(`3D Asset Library: the catalog could not be built — ${e.message}`);
  }
}
async function offerCatalog(app) {
  if (_offered || !game.user.isGM || await hasCatalog()) return false;
  _offered = true;
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Build the 3D Asset Library catalog" },
    content: `<p>The library already lists everything, sorted by what each file is called. Building the catalog also reads each model's size, triangle count and animations, so the Size and Detail filters work.</p>
      <p>It reads a small header from every model once (a few minutes for large collections) and is shared with everyone on this server. You can run it later from the <i class="fa-solid fa-rotate"></i> button.</p>`,
    yes: { label: "Build now" }, no: { label: "Later" },
  });
  if (!ok) return false;
  await runCatalogBuild(app);
  return true;
}
import { LibraryView } from "./browser-ui.js";

export let AssetLibrary = null;
export let TokenLibrary = null;

export function defineApps(UI) {
  const AB = UI.AssetBrowser;
  const Base = Object.getPrototypeOf(AB); // 3D Canvas's HandlebarsApplication

  AssetLibrary = class AssetLibrary extends AB {
    static get DEFAULT_OPTIONS() {
      const o = foundry.utils.deepClone(super.DEFAULT_OPTIONS);
      o.id = "asset-library-3d";
      o.classes = [...(o.classes || []), "al-app"];
      o.window = { ...o.window, title: "3D Asset Library", icon: "fa-solid fa-cubes", resizable: true };
      const saved = game.settings.get(MODULE_ID, "windowSize-asset") || {};
      o.position = {
        width: saved.width || Math.min(1180, window.innerWidth * 0.8),
        height: saved.height || window.innerHeight * 0.85,
        ...(saved.left != null ? { left: saved.left, top: saved.top } : {}),
      };
      return o;
    }

    static get PARTS() {
      const p = foundry.utils.deepClone(super.PARTS);
      p.content = { template: `modules/${MODULE_ID}/templates/library.hbs` };
      return p;
    }

    get title() {
      return this._count != null ? `3D Asset Library — ${this._count.toLocaleString()} of ${this._total.toLocaleString()}` : "3D Asset Library";
    }

    async _prepareContext(options) {
      const data = await Base.prototype._prepareContext.call(this, options);
      data.tabs = this._prepareTabs("primary");
      data.scale = AB.scale || 1;
      data.density = AB.density || 1;
      data.angle = AB.angle || 0;
      data.isAssetBrowser = true;
      return data;
    }

    // 3D Canvas's search is replaced by the library view
    onSearch() {}

    _onRender(context, options) {
      super._onRender(context, options); // 3D Canvas wires tabs, placement toggles, utility buttons
      const host = this.element.querySelector(".al-host");
      if (!this.view) {
        this.view = new LibraryView({
          kind: "asset",
          root: host,
          onListRendered: (lis) => lis.forEach((li) => this.activateListElementListeners(li)),
          onCount: (n, total) => {
            this._count = n; this._total = total;
            const t = this.element?.querySelector(".window-title");
            if (t) t.innerText = this.title;
          },
        });
      } else this.view.root = host;
      this.view.render();
      this.addHeaderButtons();
      this.load();
    }

    addHeaderButtons() {
      const header = this.element.querySelector(".window-header");
      if (!header || header.querySelector(".al-hdr")) return;
      const mk = (icon, tip, fn) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "header-control icon al-hdr " + icon;
        b.dataset.tooltip = tip;
        b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
        return b;
      };
      const close = header.querySelector('[data-action="close"]');
      header.insertBefore(mk("fa-solid fa-person", "Open the Token Library", () => new TokenLibrary().render(true)), close);
      header.insertBefore(mk("fa-solid fa-rotate", game.user.isGM ? "Rescan for new models (Shift-click: re-read every model)" : "Rescan every pack for new files",
        async (e) => {
          if (!game.user.isGM) return this.load(true);
          await runCatalogBuild(this, { full: !!e?.shiftKey });
          this.view.items = null; this.load();
        }), close);
      header.insertBefore(mk("fa-solid fa-cube", "Open 3D Canvas's original browser", () => openOriginalAssetBrowser()), close);
    }

    async load(rescan = false) {
      if (this.view.items && !rescan) return this.view.setItems(this.view.items);
      const grid = this.element.querySelector(".al-grid");
      if (grid) grid.innerHTML = `<div class="al-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading library…</div>`;
      await loadUserData();
      if (rescan) invalidate("asset");
      const items = await getItems("asset", {
        rescan,
        progress: (m) => { const l = this.element?.querySelector(".al-loading"); if (l) l.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${m}`; },
      });
      this.view.setItems(items);
      if (await offerCatalog(this)) { this.view.items = null; return this.load(); }
    }

    // placing an asset counts as using it
    buildTileData(src, collisionPoint) {
      const d = super.buildTileData(src, collisionPoint);
      if (d?.texture?.src) pushRecent(d.texture.src);
      return d;
    }

    setPosition(pos) {
      const r = super.setPosition(pos);
      this._savePos ??= foundry.utils.debounce(() => {
        const { width, height, left, top } = this.position;
        game.settings.set(MODULE_ID, "windowSize-asset", { width, height, left, top });
      }, 400);
      if (this.rendered) this._savePos();
      return r;
    }

    async close(options) {
      this.view?.destroy();
      return super.close(options);
    }
  };

  // ───────────────────────────────────────────── tokens
  const HAM = foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2);
  TokenLibrary = class TokenLibrary extends HAM {
    constructor(input, app) {
      super();
      this.input = input ?? null;
      this._app = app ?? null;
      this.document = app?.document ?? app?.object?.document ?? app?.object ?? null;
    }
    static DEFAULT_OPTIONS = {
      id: "token-library-3d-{id}",
      classes: ["three-canvas-compendium-app", "three-canvas-compendium-app-v2", "al-app"],
      tag: "div",
      window: { title: "3D Token Library", icon: "fa-solid fa-person", resizable: true },
      position: { width: Math.min(1100, window.innerWidth * 0.75), height: window.innerHeight * 0.8 },
    };
    static PARTS = { content: { template: `modules/${MODULE_ID}/templates/library.hbs` } };

    get title() {
      const who = this.document?.name ? ` — for ${this.document.name}` : "";
      return `3D Token Library${who}`;
    }

    _onRender(context, options) {
      super._onRender(context, options);
      const host = this.element.querySelector(".al-host");
      this.element.querySelector("#selected-notification")?.remove();
      this.view = new LibraryView({
        kind: "token",
        root: host,
        onListRendered: (lis) => lis.forEach((li) => li.addEventListener("dragstart", (e) => this._onDragStart(e))),
        onActivate: (item, e, li) => this.choose(item, e, li),
      });
      this.view.render();
      if (this.document?.name && !this.view.state.q) {
        // start from the token's own name, like 3D Canvas's quick-match does
        this.view.state.q = this.document.name.replace(/\s*\(.*?\)\s*/g, " ").trim().split(/\s+/).slice(0, 2).join(" ");
        this.view.el.search.value = this.view.state.q;
        this._seeded = true;
      }
      this.load();
    }

    async load() {
      const grid = this.element.querySelector(".al-grid");
      if (grid) grid.innerHTML = `<div class="al-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading tokens…</div>`;
      await loadUserData();
      const items = await getItems("token", {
        progress: (m) => { const l = this.element?.querySelector(".al-loading"); if (l) l.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${m}`; },
      });
      this.view.setItems(items);
      if (await offerCatalog(this)) return this.load();
      if (this._seeded && !this.view.results.length) { this.view.state.q = ""; this.view.el.search.value = ""; this.view.refresh(); }
      this._seeded = false;
    }

    choose(item, e, li) {
      this.element.querySelectorAll("li.selected").forEach((l) => l.classList.remove("selected"));
      li?.classList.add("selected");
      pushRecent(item.path);
      if (!this.input) return;
      this.input.value = item.path;
      const fp = this.input.closest?.("file-picker");
      if (fp) fp.value = item.path;
      if (this._app?.isPrototype) return;
      if (this.document && game.settings.get("levels-3d-preview", "autoApply")) this.document.setFlag("levels-3d-preview", "model3d", item.path);
      if (game.settings.get("levels-3d-preview", "autoClose")) this.close();
    }

    _onDragStart(event) {
      canvas.tiles?.releaseAll();
      const src = event.currentTarget.dataset.output;
      pushRecent(src);
      event.dataTransfer.setData("text/plain", JSON.stringify({ type: "Tile", texture: { src }, tileSize: canvas.dimensions.size }));
    }

    async close(options) {
      this.view?.destroy();
      return super.close(options);
    }
  };

  return { AssetLibrary, TokenLibrary };
}

let _bypass = false;
export async function openOriginalAssetBrowser() {
  // only one browser can own 3D Canvas's placement tools at a time
  await foundry.applications.instances.get("asset-library-3d")?.close();
  _bypass = true;
  try { new (game.Levels3DPreview.CONFIG.UI.AssetBrowser)().render(true); } finally { _bypass = false; }
}
export const bypassing = () => _bypass;
