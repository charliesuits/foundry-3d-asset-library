/**
 * 3D Asset Library — entry point.
 *
 * Replaces 3D Canvas's prop browser and token picker with a faceted library that spans
 * every installed pack: filter by game or pack, by the pack's own collections, by what a
 * thing is, by setting, condition, physical size and triangle count; keep favourites,
 * recents and your own collections; fix a category by right-clicking.
 *
 * Nothing on disk is moved. Every asset stays where its module put it, so scenes and
 * prefabs that already use them keep working, and module updates cannot undo anything.
 */
import { MODULE_ID, getItems } from "./library.js";
import { defineApps, AssetLibrary, TokenLibrary, bypassing } from "./apps.js";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "replaceAssetBrowser", {
    name: "Replace the 3D Canvas prop browser",
    hint: "The build panel's Props button opens the 3D Asset Library. The original browser stays one click away in the library's title bar.",
    scope: "client", config: true, type: Boolean, default: true,
  });
  game.settings.register(MODULE_ID, "replaceTokenBrowser", {
    name: "Replace the 3D Canvas token picker",
    hint: "The person button beside a token's 3D model field opens the 3D Token Library.",
    scope: "client", config: true, type: Boolean, default: true,
  });
  for (const k of ["state-asset", "state-token", "windowSize-asset", "userDataFallback"]) {
    game.settings.register(MODULE_ID, k, { scope: "client", config: false, type: Object, default: {} });
  }
  game.keybindings.register(MODULE_ID, "openAssets", {
    name: "Open the 3D Asset Library", editable: [], restricted: true,
    onDown: () => { api.openAssets(); return true; },
  });
  game.keybindings.register(MODULE_ID, "openTokens", {
    name: "Open the 3D Token Library", editable: [], restricted: true,
    onDown: () => { api.openTokens(); return true; },
  });
});

// 3D Canvas announces its config (including the browser classes) once it is built.
Hooks.on("3DCanvasConfig", (CONFIG) => {
  const UI = CONFIG.UI;
  if (!UI?.AssetBrowser || UI.AssetBrowser.__assetLibraryPatched) return;
  defineApps(UI);

  const AB = UI.AssetBrowser;
  const abRender = AB.prototype.render;
  AB.prototype.render = function (...args) {
    if (this instanceof AssetLibrary || bypassing() || !game.settings.get(MODULE_ID, "replaceAssetBrowser")) return abRender.apply(this, args);
    // A stock browser was just constructed: undo the hook it registered and open ours instead.
    if (this.tilePreCrateHookId != null) Hooks.off("preCreateTile", this.tilePreCrateHookId);
    // Its constructor also pointed 3D Canvas's placement code at itself, so an already-open
    // library is reopened (state and loaded items are kept) to take that pointer back.
    const open = foundry.applications.instances.get("asset-library-3d");
    if (open) return open.close().then(() => new AssetLibrary().render(true));
    return new AssetLibrary().render(true);
  };
  AB.__assetLibraryPatched = true;

  const TB = UI.TokenBrowser;
  const tbRender = TB.prototype.render;
  TB.prototype.render = function (...args) {
    if (!game.settings.get(MODULE_ID, "replaceTokenBrowser")) return tbRender.apply(this, args);
    return new TokenLibrary(this.input, this._app).render(true);
  };
});

const api = {
  openAssets() {
    const open = foundry.applications.instances.get("asset-library-3d");
    if (open) { open.bringToFront(); if (open.minimized) open.maximize(); return open; }
    if (!AssetLibrary) return ui.notifications.warn("3D Asset Library: 3D Canvas has not finished loading yet.");
    if (!game.Levels3DPreview?._active) ui.notifications.info("3D Asset Library: turn on 3D Canvas for this scene to place assets.");
    return new AssetLibrary().render(true);
  },
  openTokens(input, app) {
    if (!TokenLibrary) return ui.notifications.warn("3D Asset Library: 3D Canvas has not finished loading yet.");
    return new TokenLibrary(input, app).render(true);
  },
  getItems,
};

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = api;
});
