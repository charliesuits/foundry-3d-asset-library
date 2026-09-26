# 3D Asset Library

A replacement for 3D Canvas's Props browser and token picker. It covers every installed 3D pack in one library, and nothing on disk is moved.

- **Asset filters:** pack and its own collections, category (11 groups, about 65 types), setting, condition, physical size and detail (triangle count). Quick toggles cover animated models, untextured models, models with thumbnails, and models heavy enough to stall 3D Canvas.
- **Token filters:** pack, creature type, role, size, CR, habitat and detail. You can also show only animated, static or painted miniatures.
- **Search:** every word must match, `-word` excludes a word, and `"quoted phrase"` matches the exact phrase.
- **Your own organising:** favourites, recently used, collections, tags, hiding, and fixing a category by right-clicking. These are saved in `Data/asset-library-3d-data`, so they're shared by every world on the server.
- **3D Canvas still does the work:** placement, painting, scatter, scale and tint all use 3D Canvas's own tools.

## The catalog
The first time a GM opens the library, it offers to build a catalog. The catalog reads a small header from every model to learn its size, triangle count and animations. This takes a few minutes for large collections, happens once, and is shared with everyone on the server. Until the catalog is built, the library still lists everything, sorted by file and folder names.

After installing new 3D packs, click the **Rescan** button in the library's title bar. It reads only the new models. Shift-click it to re-read everything.

## Settings
- **Replace the prop browser / token picker:** turn either replacement off.
- **Keybindings:** open either library (unbound by default).
- **Title bar:** a button opens 3D Canvas's original browser at any time.

## Installing
Requires [3D Canvas](https://foundryvtt.com/packages/levels-3d-preview). In Foundry, go to **Add-on Modules → Install Module**, paste this manifest URL and click Install:

```
https://github.com/charliesuits/foundry-3d-asset-library/releases/latest/download/module.json
```
