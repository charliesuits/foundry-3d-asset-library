/**
 * Catalog builder — runs in the GM's browser.
 *
 * Walks every folder 3D Canvas knows about (the same roots its own browsers read), and for
 * each model reads just the glTF header over HTTP (a ranged request, never the whole mesh)
 * to learn its triangle count, physical size, animations, rig and textures. The result is
 * saved to Data/asset-library-3d-data/catalog.json, so every user on this server shares it.
 *
 * Re-running is incremental: models already in the catalog are kept, only new ones are read.
 */
import { classifyAsset, classifyToken } from "./classify.js";

const DATA_DIR = "asset-library-3d-data";
export const CATALOG_FILE = "catalog.json";
export const CATALOG_PATH = `${DATA_DIR}/${CATALOG_FILE}`;
const CONCURRENCY = 8;
const SKIP_DIRS = /^(\.|_to_delete$|thumbnails$)/;

// ───────────────────────────────────────────── glTF header stats ──
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function matmul(a, b) {
  const o = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { let s = 0; for (let k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c]; o[r * 4 + c] = s; }
  return o;
}
function trs(n) {
  if (n.matrix) { const m = n.matrix; const o = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o.push(m[c * 4 + r]); return o; }
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const R = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  return [R[0] * sx, R[1] * sy, R[2] * sz, tx, R[3] * sx, R[4] * sy, R[5] * sz, ty, R[6] * sx, R[7] * sy, R[8] * sz, tz, 0, 0, 0, 1];
}

/** Triangle count, bounding size, materials, animations and skins from a glTF JSON document. */
export function gltfStats(j) {
  const acc = j.accessors || [], meshes = j.meshes || [], nodes = j.nodes || [];
  const meshTris = meshes.map((me) => (me.primitives || []).reduce((t, p) => {
    if ((p.mode ?? 4) !== 4) return t;
    if (p.indices != null) return t + Math.floor((acc[p.indices]?.count || 0) / 3);
    const pos = p.attributes?.POSITION;
    return pos != null ? t + Math.floor((acc[pos]?.count || 0) / 3) : t;
  }, 0));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const used = new Set();
  let tris = 0;
  const scenes = j.scenes || [];
  const sc = scenes.length ? scenes[j.scene ?? 0] : { nodes: nodes.map((_, i) => i) };
  const stack = (sc?.nodes || []).map((i) => [i, I4]);
  let guard = 0;
  while (stack.length && guard++ < 200000) {
    const [i, parent] = stack.pop();
    const n = nodes[i];
    if (!n) continue;
    const M = matmul(parent, trs(n));
    if (n.mesh != null && n.mesh < meshes.length) {
      tris += meshTris[n.mesh]; used.add(n.mesh);
      for (const p of meshes[n.mesh].primitives || []) {
        const a = acc[p.attributes?.POSITION];
        if (!a?.min || !a?.max) continue;
        for (const cx of [a.min[0], a.max[0]]) for (const cy of [a.min[1], a.max[1]]) for (const cz of [a.min[2], a.max[2]]) {
          for (let r = 0; r < 3; r++) {
            const v = M[r * 4] * cx + M[r * 4 + 1] * cy + M[r * 4 + 2] * cz + M[r * 4 + 3];
            if (v < lo[r]) lo[r] = v; if (v > hi[r]) hi[r] = v;
          }
        }
      }
    }
    for (const c of n.children || []) stack.push([c, M]);
  }
  if (!used.size) tris = meshTris.reduce((a, b) => a + b, 0);
  const mats = j.materials || [];
  const texMats = mats.filter((m) => m.pbrMetallicRoughness?.baseColorTexture || m.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseTexture).length;
  return {
    tris, dims: lo[0] === Infinity ? null : [0, 1, 2].map((k) => Math.round((hi[k] - lo[k]) * 1000) / 1000),
    mats: mats.length, texMats, imgs: (j.images || []).length, anims: (j.animations || []).length, skins: (j.skins || []).length,
  };
}

/** Read the first n bytes of a file. Uses a ranged request; stops early if the server ignores the range. */
async function readPrefix(url, n) {
  const res = await fetch(url, { headers: { Range: `bytes=0-${n - 1}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number((res.headers.get("content-range") || "").split("/")[1]) || Number(res.headers.get("content-length")) || 0;
  const modified = Date.parse(res.headers.get("last-modified") || "") || Date.now();
  const reader = res.body.getReader();
  const parts = []; let got = 0;
  while (got < n) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
  }
  reader.cancel().catch(() => {});
  const buf = new Uint8Array(Math.min(got, n));
  let o = 0;
  for (const p of parts) { const take = Math.min(p.length, buf.length - o); buf.set(p.subarray(0, take), o); o += take; if (o >= buf.length) break; }
  return { buf, total: total || got, modified };
}

const dec = new TextDecoder();
/** The glTF JSON of a .glb/.gltf, plus its byte size and last-modified time. */
async function readGltf(path) {
  const url = foundry.utils.getRoute(path.split("/").map(encodeURIComponent).join("/"));
  let { buf, total, modified } = await readPrefix(url, 65536);
  const text = /\.gltf$/i.test(path) || buf[0] === 0x7b; // "{": a text glTF (some .glb files are)
  if (text) {
    if (buf.length < total) ({ buf } = await readPrefix(url, total));
    return { json: JSON.parse(dec.decode(buf)), total, modified };
  }
  if (dec.decode(buf.subarray(0, 4)) !== "glTF") throw new Error("not a glTF file");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const clen = dv.getUint32(12, true);
  if (20 + clen > buf.length) ({ buf } = await readPrefix(url, 20 + clen));
  return { json: JSON.parse(dec.decode(buf.subarray(20, 20 + clen))), total, modified };
}

// ───────────────────────────────────────────── folder walk ──
async function walk(root, onDir) {
  const FP = foundry.applications.apps.FilePicker.implementation;
  const files = [];
  const queue = [root];
  while (queue.length) {
    const dir = queue.shift();
    let res;
    try { res = await FP.browse("data", dir); } catch { continue; }
    onDir?.(dir);
    for (const f of res.files || []) files.push(decodeURIComponent(f));
    for (const d of res.dirs || []) if (!SKIP_DIRS.test(decodeURIComponent(d).split("/").pop())) queue.push(decodeURIComponent(d));
  }
  return files;
}

// ───────────────────────────────────────────── build ──
async function pmap(list, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
    while (i < list.length) await fn(list[i++]);
  }));
}

/**
 * Build or update the catalog.
 * @param {object} o
 * @param {{asset:string[], token:string[]}} o.roots  folders to walk, per kind
 * @param {object} [o.previous]  the current catalog, whose rows are reused
 * @param {boolean} [o.full]  re-read every model instead of only new ones
 * @param {object} [o.bestiary]  creature facts for classifyToken
 * @param {(msg:string)=>void} [o.progress]
 */
export async function buildCatalog({ roots, previous, full = false, bestiary = {}, progress = () => {} }) {
  // what the previous catalog already knows, by path
  const known = new Map();
  if (previous?.roots && !full) {
    for (const [kind, rows] of [["asset", previous.a], ["token", previous.t]]) {
      for (const row of rows || []) {
        const r = previous.roots[row[0]];
        known.set(`${kind}|${r.root}/${row[1]}`, { kind, row, root: r, dict: previous.dict });
      }
    }
  }

  // list every model under every root
  const entries = [];
  for (const kind of ["asset", "token"]) {
    for (const root of roots[kind] || []) {
      progress(`Listing ${root}…`);
      const files = await walk(root, (d) => progress(`Listing ${d}…`));
      const webp = new Set(files.filter((f) => /\.webp$/i.test(f)).map((f) => f.replace(/\.webp$/i, "").toLowerCase()));
      const billboards = /Vegetation_billboard/i.test(root);
      for (const path of files) {
        const isModel = /\.(glb|gltf)$/i.test(path);
        const isBillboard = billboards && /\.webp$/i.test(path);
        if (!isModel && !isBillboard) continue;
        entries.push({ kind, root, path, isBillboard, preview: isBillboard || webp.has(path.replace(/\.(glb|gltf)$/i, "").toLowerCase()) });
      }
    }
  }

  // read headers of the new ones
  const todo = entries.filter((e) => !e.isBillboard && !known.has(`${e.kind}|${e.path}`));
  let done = 0, failed = 0;
  const t0 = Date.now();
  await pmap(todo, async (e) => {
    try {
      const { json, total, modified } = await readGltf(e.path);
      Object.assign(e, gltfStats(json), { size: total, mtime: Math.round(modified / 1000) });
    } catch (err) { e.err = err.message; failed++; }
    done++;
    if (done % 25 === 0 || done === todo.length) {
      const rate = done / Math.max(1, (Date.now() - t0) / 1000);
      const left = Math.round((todo.length - done) / Math.max(rate, 0.1));
      progress(`Reading models ${done.toLocaleString()} / ${todo.length.toLocaleString()}${left > 5 ? ` — about ${left > 90 ? `${Math.round(left / 60)} min` : `${left} s`} left` : ""}`);
    }
  });

  // encode (same compact format the library reads)
  const dicts = {};
  const idx = (name, v) => {
    if (v == null) return -1;
    const d = (dicts[name] ??= { list: [], map: new Map() });
    if (!d.map.has(v)) { d.map.set(v, d.list.length); d.list.push(v); }
    return d.map.get(v);
  };
  const mask = (name, arr) => (arr || []).slice(0, 30).reduce((m, v) => m | (1 << idx(name, v)), 0);
  const outRoots = [], rootIdx = new Map();
  const ri = (kind, root) => {
    const k = `${kind}|${root}`;
    if (!rootIdx.has(k)) { rootIdx.set(k, outRoots.length); outRoots.push({ root, moduleId: root.split("/")[1], kind }); }
    return rootIdx.get(k);
  };
  const a = [], t = [];
  for (const e of entries) {
    const rel = e.path.slice(e.root.length + 1);
    const prev = known.get(`${e.kind}|${e.path}`);
    if (prev) {
      // re-encode the old row against the new dictionaries
      const row = prev.row, d = prev.dict;
      const at = (name, i) => (i >= 0 ? d[name]?.[i] : null);
      const unmask = (name, m) => (d[name] || []).filter((_, b) => m & (1 << b));
      if (e.kind === "asset") {
        a.push([ri("asset", e.root), rel, idx("types", at("types", row[2])), mask("themes", unmask("themes", row[3])), idx("conds", at("conds", row[4])),
          idx("colls", at("colls", row[5])), row[6], row[7], row[8] & ~1 | (e.preview ? 1 : 0), row[9], row[10], row[11],
          Array.isArray(row[12]) ? row[12].map((x) => idx("types", d.types[x])) : 0]);
      } else {
        t.push([ri("token", e.root), rel, idx("creatures", at("creatures", row[2])), idx("roles", at("roles", row[3])), idx("colls", at("colls", row[4])),
          idx("sizes", at("sizes", row[5])), idx("crs", at("crs", row[6])), mask("envs", unmask("envs", row[7])), row[8], row[9],
          row[10] & ~1 | (e.preview ? 1 : 0), row[11], row[12], row[13]]);
      }
      continue;
    }
    if (e.err) continue;
    const textured = (e.texMats || 0) > 0 || (e.imgs || 0) > 0;
    const flags = (e.preview ? 1 : 0) | (textured ? 2 : 0) | (!textured && (e.mats || 0) > 0 && !e.isBillboard ? 4 : 0)
      | ((e.skins || 0) > 0 ? 8 : 0) | (e.isBillboard ? 16 : 0);
    const dimMax = e.dims ? Math.round(Math.max(...e.dims) * 10) : -1;
    const kb = Math.round((e.size || 0) / 1024);
    const mdays = Math.round((e.mtime || Date.now() / 1000) / 86400);
    if (e.kind === "asset") {
      const c = classifyAsset(e.path, e.root);
      a.push([ri("asset", e.root), rel, idx("types", c.type), mask("themes", c.themes), idx("conds", c.condition), idx("colls", c.collection),
        e.tris ?? -1, dimMax, flags, e.anims || 0, kb, mdays, c.types.length > 1 ? c.types.slice(1).map((x) => idx("types", x)) : 0]);
    } else {
      const c = classifyToken(e.path, e.root, bestiary);
      t.push([ri("token", e.root), rel, idx("creatures", c.creature), idx("roles", c.role), idx("colls", c.collection), idx("sizes", c.size5e),
        idx("crs", c.cr), mask("envs", (c.env || []).slice(0, 20)), c.painted == null ? -1 : c.painted ? 1 : 0,
        e.tris ?? -1, flags, e.anims || 0, kb, mdays]);
    }
  }
  return {
    catalog: {
      v: 1, built: new Date().toISOString().slice(0, 10),
      roots: outRoots, dict: Object.fromEntries(Object.entries(dicts).map(([k, d]) => [k, d.list])), a, t,
    },
    stats: { assets: a.length, tokens: t.length, read: done - failed, failed },
  };
}

/** Save the catalog where every user on this server can read it. */
export async function saveCatalog(catalog) {
  const FP = foundry.applications.apps.FilePicker.implementation;
  try { await FP.createDirectory("data", DATA_DIR); } catch { /* exists */ }
  await FP.upload("data", DATA_DIR, new File([JSON.stringify(catalog)], CATALOG_FILE, { type: "application/json" }), {}, { notify: false });
}
