/**
 * Asset Library — the data layer.
 *
 * Builds one in-memory list of every 3D asset and token the installed modules offer,
 * each carrying its facets (source, collection, type, theme, condition, size, detail …).
 *
 * Where the list comes from, fastest first:
 *   1. Data/asset-library-3d-data/catalog.json — built in the GM's browser by scanner.js from
 *      every model's glTF header, so it knows triangle counts, sizes and animations.
 *   2. index.json at a registered pack root — one fetch, catches files added since the
 *      catalog was built. Their facets come from the classifier at runtime.
 *   3. A folder crawl, only for packs with neither (the same crawl 3D Canvas does).
 */
import {
  classifyAsset, classifyToken, displayName, sourceInfo, sizeBucket, detailBucket,
  SIZE_BUCKETS, DETAIL_BUCKETS, TYPE_GROUPS,
} from "./classify.js";
import { buildCatalog, saveCatalog, CATALOG_PATH } from "./scanner.js";

export const MODULE_ID = "asset-library-3d";
const DATA_DIR = "asset-library-3d-data";
const USER_FILE = "library-user.json";

export const TYPE_GROUP_ORDER = ["Architecture", "Furniture", "Containers", "Lighting", "Decor", "Clutter", "Nature", "Machinery", "Vehicles", "Characters", "Other"];

let _catalog = null;
let _bestiary = null;
const _cache = { asset: null, token: null };
const _loading = { asset: null, token: null };

// ───────────────────────────────────────────── catalog ──
const EMPTY_CATALOG = () => ({ v: 0, roots: [], dict: {}, a: [], t: [] });
async function loadCatalog() {
  if (_catalog) return _catalog;
  try {
    const res = await fetch(`${foundry.utils.getRoute(CATALOG_PATH)}?t=${Date.now()}`, { cache: "no-store" });
    _catalog = res.ok ? await res.json() : EMPTY_CATALOG();
  } catch (e) {
    console.warn(`${MODULE_ID} | no catalog yet, classifying at runtime`, e);
    _catalog = EMPTY_CATALOG();
  }
  return _catalog;
}

/** True once a catalog has been built on this server. */
export async function hasCatalog() { return ((await loadCatalog()).v || 0) > 0; }

/**
 * Build (or update) the shared catalog from every active 3D pack. GM only.
 * @param {object} [o]
 * @param {boolean} [o.full]  re-read every model, not just new ones
 * @param {(msg:string)=>void} [o.progress]
 */
export async function rebuildCatalog({ full = false, progress = () => {} } = {}) {
  if (!game.user.isGM) throw new Error("Only a GM can build the catalog");
  const roots = {};
  for (const kind of ["asset", "token"]) {
    roots[kind] = registeredRoots(kind).filter((r) => !r.startsWith("modules/") || moduleActive(r.split("/")[1]));
  }
  const { catalog, stats } = await buildCatalog({ roots, previous: await loadCatalog(), full, bestiary: await loadBestiary(), progress });
  progress("Saving…");
  await saveCatalog(catalog);
  _catalog = catalog;
  invalidate("asset"); invalidate("token");
  return stats;
}

async function loadBestiary() {
  if (_bestiary) return _bestiary;
  try { _bestiary = await foundry.utils.fetchJsonWithTimeout(`modules/${MODULE_ID}/data/bestiary.json`); }
  catch { _bestiary = {}; }
  return _bestiary;
}

const moduleActive = (id) => id === "levels-3d-preview" || !!game.modules.get(id)?.active;

function fromCatalogAsset(row, cat) {
  const [ri, rel, ti, tm, ci, coi, tris, dim10, flags, anims, kb, mdays, extra] = row;
  const r = cat.roots[ri];
  const d = cat.dict;
  const themes = [];
  for (let b = 0; b < (d.themes?.length || 0); b++) if (tm & (1 << b)) themes.push(d.themes[b]);
  return finishAsset({
    path: `${r.root}/${rel}`, root: r.root, moduleId: r.moduleId,
    type: d.types[ti], types: [d.types[ti], ...(Array.isArray(extra) ? extra.map((e) => d.types[e]) : [])], themes, condition: ci >= 0 ? d.conds[ci] : null, collection: d.colls[coi],
    tris: tris >= 0 ? tris : null, dim: dim10 >= 0 ? dim10 / 10 : null, flags, anims, kb, mdays,
  });
}

function fromCatalogToken(row, cat) {
  const [ri, rel, cri, roi, coi, si, cri2, em, painted, tris, flags, anims, kb, mdays] = row;
  const r = cat.roots[ri];
  const d = cat.dict;
  const env = [];
  for (let b = 0; b < (d.envs?.length || 0); b++) if (em & (1 << b)) env.push(d.envs[b]);
  return finishToken({
    path: `${r.root}/${rel}`, root: r.root, moduleId: r.moduleId,
    creature: d.creatures[cri], role: d.roles[roi], collection: d.colls[coi],
    size5e: si >= 0 ? d.sizes[si] : null, cr: cri2 >= 0 ? d.crs[cri2] : null, env,
    painted: painted < 0 ? null : !!painted, tris: tris >= 0 ? tris : null, flags, anims, kb, mdays,
  });
}

function finishCommon(o) {
  const src = sourceInfo(o.moduleId, game.modules.get(o.moduleId)?.title);
  o.name = displayName(o.path);
  o.source = src.label;
  o.sourceGroup = src.group;
  o.sourceShort = src.short;
  o.preview = o.flags & 16 ? o.path : o.path.replace(/\.(glb|gltf)$/i, ".webp");
  o.hasPreview = o.flags == null ? true : !!(o.flags & 1);
  o.animated = (o.anims || 0) > 0;
  o.textured = o.flags == null ? null : !!(o.flags & 2);
  o.untextured = !!(o.flags & 4);
  o.rigged = !!(o.flags & 8);
  o.detail = detailBucket(o.tris) || "Unknown";
  o.search = (o.name + " " + decodeURIComponent(o.path.slice(o.root.length))).toLowerCase().replace(/[_\-]+/g, " ");
  return o;
}
function finishAsset(o) {
  finishCommon(o);
  o.kind = "asset";
  o.types ??= [o.type];
  o.group = TYPE_GROUP_OF[o.type] || "Other";
  o.size = sizeBucket(o.dim) || "Unknown";
  o.search += " " + o.types.join(" ").toLowerCase() + " " + o.themes.join(" ").toLowerCase() + " " + (o.collection || "").toLowerCase();
  return o;
}
function finishToken(o) {
  finishCommon(o);
  o.kind = "token";
  o.search += " " + (o.creature || "").toLowerCase() + " " + (o.role || "").toLowerCase() + " " + (o.collection || "").toLowerCase();
  return o;
}

const TYPE_GROUP_OF = TYPE_GROUPS;

// ───────────────────────────────────────────── discovery ──
async function tryIndex(root) {
  try {
    const res = await fetch(`${root}/index.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    const list = await res.json();
    return Array.isArray(list) ? list.map((f) => `${root}/${f}`) : null;
  } catch { return null; }
}

function registeredRoots(kind) {
  const UI = game.Levels3DPreview?.CONFIG?.UI;
  const roots = new Set();
  if (kind === "asset") {
    for (const s of UI?.AssetBrowser?.defaultSources ?? []) roots.add(s.replace(/\/$/, ""));
    const custom = game.settings.get("levels-3d-preview", "assetBrowserCustomPath");
    if (custom) roots.add(custom.replace(/\/$/, ""));
  } else {
    for (const s of UI?.TokenBrowser?.defaultSources ?? []) roots.add(s.replace(/\/$/, ""));
    if (game.modules.get("canvas3dtokencompendium")?.active) roots.add("modules/canvas3dtokencompendium/miniatures");
  }
  return [...roots];
}

/**
 * Get every item of a kind ("asset" | "token"). Cached for the session.
 * @param {object} opts
 * @param {boolean} opts.rescan  crawl every registered root again, ignoring caches
 * @param {Function} opts.progress  (message) => void
 */
export async function getItems(kind, { rescan = false, progress = () => {} } = {}) {
  if (_cache[kind] && !rescan) return _cache[kind];
  if (_loading[kind] && !rescan) return _loading[kind];
  _loading[kind] = (async () => {
    const t0 = performance.now();
    progress("Reading catalog…");
    const cat = await loadCatalog();
    const best = kind === "token" ? await loadBestiary() : null;
    const byPath = new Map();
    const catRoots = new Set();
    // 1) catalog
    const rows = kind === "asset" ? cat.a : cat.t;
    for (const row of rows) {
      const r = cat.roots[row[0]];
      if (!moduleActive(r.moduleId)) continue;
      catRoots.add(r.root);
      const it = kind === "asset" ? fromCatalogAsset(row, cat) : fromCatalogToken(row, cat);
      byPath.set(it.path, it);
    }
    // 2) + 3) registered roots
    const roots = registeredRoots(kind);
    const AB = game.Levels3DPreview.CONFIG.UI.AssetBrowser;
    for (const root of roots) {
      const moduleId = root.split("/")[1];
      if (root.startsWith("modules/") && !moduleActive(moduleId)) continue;
      let files = await tryIndex(root);
      const known = catRoots.has(root);
      if (!files && (!known || rescan)) {
        progress(`Scanning ${root}…`);
        try { files = await AB.getFiles(root, "data"); } catch { try { files = await AB.getFiles(root, "user"); } catch { files = []; } }
      }
      for (const f of files || []) {
        const path = decodeURIComponent(f);
        if (byPath.has(path) || byPath.has(f)) continue;
        if (!/\.(glb|gltf)$/i.test(path)) continue;
        byPath.set(path, runtimeItem(kind, path, root, best));
      }
    }
    // billboards and API-registered assets that 3D Canvas knows about
    if (kind === "asset") {
      for (const a of AB.assetCache ?? []) {
        if (byPath.has(a.output)) continue;
        const it = runtimeItem("asset", a.output, a.output.split("/").slice(0, 2).join("/"), null);
        if (a.displayName) it.name = a.displayName;
        if (a.preview) it.preview = a.preview;
        byPath.set(a.output, it);
      }
    }
    // user overrides
    const user = await loadUserData();
    for (const [p, o] of Object.entries(user.overrides || {})) {
      const it = byPath.get(p);
      if (!it) continue;
      if (o.type) { it.type = o.type; it.types = [o.type]; it.group = TYPE_GROUP_OF[o.type] || it.group; }
      if (o.creature) it.creature = o.creature;
      if (o.collection) it.collection = o.collection;
    }
    const list = [...byPath.values()];
    list.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`${MODULE_ID} | ${kind}s: ${list.length} in ${Math.round(performance.now() - t0)} ms`);
    _cache[kind] = list;
    _loading[kind] = null;
    return list;
  })();
  return _loading[kind];
}

function runtimeItem(kind, path, root, best) {
  const moduleId = path.split("/")[1];
  if (kind === "asset") {
    const c = classifyAsset(path, root);
    return finishAsset({ path, root, moduleId, type: c.type, types: c.types, themes: c.themes, condition: c.condition, collection: c.collection,
      tris: null, dim: null, flags: c.billboard ? 1 | 16 : null, anims: 0, kb: null, mdays: Math.round(Date.now() / 864e5), runtime: true });
  }
  const c = classifyToken(path, root, best);
  return finishToken({ path, root, moduleId, creature: c.creature, role: c.role, collection: c.collection, size5e: c.size5e, cr: c.cr,
    env: c.env, painted: c.painted, tris: null, flags: null, anims: /anim/i.test(root + path) ? 1 : 0, kb: null,
    mdays: Math.round(Date.now() / 864e5), runtime: true });
}

export function invalidate(kind) { _cache[kind] = null; }

// ───────────────────────────────────────────── user data ──
// Favourites, recents, collections, tags, hidden and overrides. Stored as a JSON file in
// the Data folder (outside modules/, so no module update can wipe it) so it is the same
// in every world. Players, who cannot upload, fall back to a client setting.
let _user = null;
const EMPTY_USER = () => ({ v: 1, favorites: [], recent: [], collections: {}, tags: {}, hidden: [], overrides: {} });

export async function loadUserData() {
  if (_user) return _user;
  _user = EMPTY_USER();
  try {
    const res = await fetch(`${DATA_DIR}/${USER_FILE}?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) _user = Object.assign(EMPTY_USER(), await res.json());
    else {
      const local = game.settings.get(MODULE_ID, "userDataFallback");
      if (local && typeof local === "object" && local.v) _user = Object.assign(EMPTY_USER(), local);
    }
  } catch (e) { console.warn(`${MODULE_ID} | user data`, e); }
  return _user;
}

const _save = foundry.utils.debounce(async () => {
  const data = JSON.stringify(_user);
  if (game.user.isGM) {
    try {
      const FP = foundry.applications.apps.FilePicker.implementation;
      try { await FP.createDirectory("data", DATA_DIR); } catch { /* exists */ }
      const file = new File([data], USER_FILE, { type: "application/json" });
      await FP.upload("data", DATA_DIR, file, {}, { notify: false });
      return;
    } catch (e) { console.warn(`${MODULE_ID} | could not write ${DATA_DIR}/${USER_FILE}, using client storage`, e); }
  }
  await game.settings.set(MODULE_ID, "userDataFallback", JSON.parse(data));
}, 800);

export function userData() { return _user ?? EMPTY_USER(); }
export function saveUserData() { _save(); }

export function toggleFavorite(path) {
  const u = userData();
  const i = u.favorites.indexOf(path);
  if (i >= 0) u.favorites.splice(i, 1); else u.favorites.unshift(path);
  saveUserData();
  return i < 0;
}
export function pushRecent(path) {
  const u = userData();
  u.recent = [path, ...u.recent.filter((p) => p !== path)].slice(0, 80);
  saveUserData();
}
export function toggleHidden(path) {
  const u = userData();
  const i = u.hidden.indexOf(path);
  if (i >= 0) u.hidden.splice(i, 1); else u.hidden.push(path);
  saveUserData();
  return i < 0;
}
export function addToCollection(name, paths) {
  const u = userData();
  const set = new Set(u.collections[name] ?? []);
  for (const p of paths) set.add(p);
  u.collections[name] = [...set];
  saveUserData();
}
export function removeFromCollection(name, paths) {
  const u = userData();
  if (!u.collections[name]) return;
  const rm = new Set(paths);
  u.collections[name] = u.collections[name].filter((p) => !rm.has(p));
  saveUserData();
}
export function deleteCollection(name) {
  delete userData().collections[name];
  saveUserData();
}
export function setTags(path, tags) {
  const u = userData();
  const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (clean.length) u.tags[path] = clean; else delete u.tags[path];
  saveUserData();
}
export function setOverride(path, patch) {
  const u = userData();
  const o = { ...(u.overrides[path] || {}), ...patch };
  for (const k of Object.keys(o)) if (!o[k]) delete o[k];
  if (Object.keys(o).length) u.overrides[path] = o; else delete u.overrides[path];
  saveUserData();
}

export { SIZE_BUCKETS, DETAIL_BUCKETS, TYPE_GROUP_OF };
