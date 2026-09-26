/**
 * Asset Library — the classifier.
 *
 * Every asset gets its facets from its path alone, so the same code runs in the browser
 * (for files the offline scan has not seen yet) and in node (to test the rules against
 * the whole library). Nothing here touches Foundry.
 *
 * The idea is simple: a path is a pile of words. Folder names and file names are split
 * into lowercase tokens, and ordered rules look for words that say what a thing IS
 * (type), WHERE it belongs (theme) and what STATE it is in (condition). The file name is
 * tried before the folders, so "oct24-set/oct24-cupboard1" is a cupboard, not a set.
 */

// ───────────────────────────────────────────── sources ──
// Friendly names for the modules we know. Anything else is named from its module id.
export const SOURCES = {
  "canvas3dcompendium":      { label: "3D Canvas Mapmaking Pack", group: "Content packs", short: "Mapmaking Pack" },
  "canvas3dtokencompendium": { label: "3D Canvas Token Collection", group: "Content packs", short: "Token Collection" },
  "baileywiki-3d":           { label: "Baileywiki 3D", group: "Content packs", short: "Baileywiki" },
  "3d-animations":           { label: "3D Animations (Digi_DM)", group: "Content packs", short: "3D Animations" },
  "levels-3d-preview":       { label: "3D Canvas (built-in)", group: "Content packs", short: "3D Canvas" },
  "bg3-faerun":              { label: "Baldur's Gate 3", group: "Games", short: "BG3" },
  "dos2-rivellon":           { label: "Divinity: Original Sin 2", group: "Games", short: "DOS2" },
  "ds1-lordran":             { label: "Dark Souls", group: "Games", short: "DS1" },
  "ds2-drangleic":           { label: "Dark Souls II", group: "Games", short: "DS2" },
  "er-lands-between":        { label: "Elden Ring", group: "Games", short: "Elden Ring" },
  "ff7-rebirth-3d":          { label: "Final Fantasy VII Rebirth", group: "Games", short: "FF7R" },
  "ffx-spira-3d":            { label: "Final Fantasy X", group: "Games", short: "FFX" },
  "ff12-zodiac-3d":          { label: "Final Fantasy XII", group: "Games", short: "FF12" },
  "oblivion-cyrodiil":       { label: "Oblivion Remastered", group: "Games", short: "Oblivion" },
  "skyrim-holds":            { label: "Skyrim", group: "Games", short: "Skyrim" },
};

export function sourceInfo(moduleId, title) {
  if (SOURCES[moduleId]) return { id: moduleId, ...SOURCES[moduleId] };
  const label = title || moduleId.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { id: moduleId, label, group: "Other modules", short: label };
}

// ───────────────────────────────────────────── helpers ──
const MONTHS = { jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun", jul: "Jul", aug: "Aug", sep: "Sep", sept: "Sep", oct: "Oct", nov: "Nov", dec: "Dec",
  january: "Jan", february: "Feb", march: "Mar", april: "Apr", june: "Jun", july: "Jul", august: "Aug", september: "Sep", october: "Oct", november: "Nov", december: "Dec" };

export function words(s) {
  return decodeURIComponent(String(s))
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .replace(/’|'/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
}

function titleCase(s) {
  return s.replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

/** A readable name from a file name. Strips extensions, sculptor tags and game codes. */
export function displayName(path) {
  let n = decodeURIComponent(path.split("/").pop()).replace(/\.(glb|gltf|webp)$/i, "");
  n = n.replace(/^MZ4250\s*-\s*/i, "")
    .replace(/^(?:[A-Z]{2,5}_){1,2}(?=[A-Za-z0-9])/, "")   // BG3/DOS2 codes: CONT_HUM_Vase → Vase
    .replace(/\s*Animated$/i, "")
    .replace(/^aeg\d+_\d+_?/i, "")          // Elden Ring aeg210_626_corpse… → corpse…
    .replace(/_c\d{4}$/i, "")               // Souls creature ids
    .replace(/_a\d{4}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/(\w)-(?=\w)/g, "$1 ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  n = n.replace(/[\s\-_.]+$/, "").replace(/^[\s\-_.]+/, "");
  // "01 bush" → "Bush 01", "05m City House…" → "City House… 05m": lead with the words
  const lead = n.match(/^(\d+[a-z]?)\s+(.*[a-z].*)$/i);
  if (lead) n = `${lead[2]} ${lead[1]}`;
  if (!n) n = decodeURIComponent(path.split("/").pop()).replace(/\.(glb|gltf|webp)$/i, "");
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// ───────────────────────────────────────────── asset types ──
// [group, type, regex over " word word word "]. Order is priority. Regexes see a string
// of space-separated lowercase words with a leading and trailing space, and are also
// tried against the words glued together, which catches "bookcase", "castlewall",
// "anvilupperclass" style compounds.
const W = (s) => new RegExp(`(^| )(${s})( |$)`);
const TYPE_RULES = [
  ["Nature", "Crystals", W("crystals?|geodes?|gemstones?|crystal ?clusters?")],
  // things that would otherwise be caught by a broader word
  ["Lighting", "Lights & Fires", W("torch(es)?|wall ?torch|sconces?|candles?|candlesticks?|candelabras?|chandeliers?|lanterns?|lamps?|lamp ?posts?|braziers?|campfires?|fire ?pits?|fireplaces?|hearths?|lights?|lts|light ?source|lit|unlit|brazier|glowstones?|firepit")],
  ["Nature", "Trees", W("silverfirs?|firs?|trees?|tree ?stumps?|stumps?|trunks?|saplings?|pines?|oaks?|birch(es)?|willows?|maples?|sugarmaple|beech(es)?|europeanbeech|conifers?|deciduous|palms?|palm ?trees?|dead ?trees?|logs?|fallen ?trees?|branch(es)?|roots|greenoak|bloodforest")],
  ["Furniture", "Shelves & Cabinets", W("bookcases?|bookshelf|bookshelves|shelf|shelves|cupboards?|cup ?boards?|cabinets?|wardrobes?|dressers?|closets?|drawers?|racks?|weapon ?racks?|armoires?|sideboards?|hutch")],
  ["Clutter", "Books & Scrolls", W("books?|scrolls?|parchments?|papers?|tomes?|letters?|maps?|notes?|stationery|quills?|ink|tablets?|documents?")],
  ["Architecture", "Doors & Gates", W("doors?|doorways?|doorframes?|door ?frames?|gates?|gateways?|portcullis|hatch(es)?|trapdoors?|benirusdoor")],
  ["Architecture", "Windows", W("windows?|shutters?|stained ?glass|panes?")],
  ["Architecture", "Stairs & Ladders", W("stairpieces?|stairs?|staircases?|stairways?|steps|ladders?|ramps?|spiral ?stairs?")],
  ["Architecture", "Railings & Trim", W("railings?|rails?|balustrades?|banisters?|trims?|mouldings?|moldings?|cornices?|battlements?|crenell?ations?|merlons?|parapets?|wainscot|skirting|gutters?|borders?|edges?")],
  ["Architecture", "Pillars & Columns", W("pillars?|pilllar|columns?|posts?|supports?|buttress(es)?|butress|obelisks?|beams?|pilasters?")],
  ["Architecture", "Arches", W("arch|arches|archways?|arcs?|arcade|vault")],
  ["Architecture", "Roofs & Ceilings", W("roofs?|rooftops?|ceilings?|domes?|chimneys?|eaves|gables?|spires?|canopy|thatch")],
  ["Architecture", "Floors & Tiles", W("floors?|flooring|tiles?|paving|pavement|flagstones?|planks?|decking|deck|platforms?|grating|grates?|foundation|slabs?|hex|street ?pieces?|road ?pieces?|cobble(stones?)?")],
  ["Architecture", "Walls", W("walls?|wall ?pieces?|stonewall|castlewall|brickwall|partitions?|palisades?|fortress ?walls?|wall ?tiles?|bricks?|masonry|block")],
  ["Architecture", "Bridges", W("bridges?|walkways?|catwalks?|gangways?|piers?|jetty|jetties|docks?")],
  ["Architecture", "Fences & Barriers", W("fences?|fencing|barricades?|barriers?|hedges?|posts? and rails|stakes?|spikes?|picket|cheval")],
  ["Architecture", "Towers & Buildings", W("towers?|turrets?|houses?|buildings?|bld|huts?|shacks?|cottages?|barns?|mills?|windmills?|sawmill|silos?|lighthouses?|castles?|keeps?|forts?|fortress|stalls?|shops?|homes?|cabins?|shelters?|temples?|chapels?|churches|cathedrals?|pagodas?|tents?|pavilions?|yurts?|garages?|hangars?|refinery|factory|stations?")],
  ["Architecture", "Rooms & Corridors", W("sewers?|rooms?|corridors?|hallways?|halls?|chambers?|interior ?rooms?|prefab|segments?|junctions?|crossroads|t ?junctions?|dead ?ends?|corners?|alcoves?|loculi|cells?|prison ?cells?|channels?")],
  ["Architecture", "Ruins & Rubble", W("rubble|debris|ruins?|ruined|remnants?|broken ?pieces?|wreckage|collapsed")],

  ["Machinery", "Traps & Puzzles", W("pressure ?plates?|spike ?traps?|bear ?traps?|traps?|spinning ?blades?|pendulum ?blades?")],
  ["Furniture", "Seating", W("chairs?|stools?|benches?|thrones?|sofas?|couch(es)?|seats?|seating|pews?|armchairs?|ottomans?")],
  ["Furniture", "Tables & Desks", W("tables?|desks?|counters?|workbench(es)?|work ?benches?|bar|lecterns?|podiums?|altars?|anvils?|pedestals?|plinths?|stands?")],
  ["Furniture", "Beds", W("beds?|bunks?|cots?|hammocks?|mattress(es)?|bedrolls?|pillows?")],
  ["Furniture", "Market Stalls", W("market|vendor|stall|stalls|kiosks?")],

  ["Containers", "Barrels & Kegs", W("barrels?|kegs?|casks?|tuns?|vats?")],
  ["Containers", "Crates & Boxes", W("crates?|boxes|box|cases?|packages?|parcels?|coffers?|footlockers?")],
  ["Containers", "Chests", W("chests?|strongbox(es)?|trunks?|lockbox(es)?|treasure ?chests?|mimics?")],
  ["Containers", "Sacks & Baskets", W("sacks?|bags?|baskets?|burlap|satchels?|pouch(es)?|bundles?|hampers?|buckets?|pails?|wicker")],
  ["Containers", "Pots, Jars & Vases", W("pots?|jars?|vases?|urns?|amphora[es]?|pottery|jugs?|pitchers?|vessels?|cauldrons?|planters?|potplant|potandvase|ceramic|porcelain|clay")],

  ["Clutter", "Bottles & Potions", W("bottles?|potions?|flasks?|vials?|decanters?|wine|beakers?|alcohol|brew|drinks?|elixirs?")],
  ["Clutter", "Food & Tableware", W("food|bread|cheese|meat|fish|fruit|apples?|cakes?|pies?|feast|provisions?|plates?|bowls?|cups?|mugs?|goblets?|tankards?|cutlery|forks?|knives|spoons?|tableware|cupandplate|dishes|dinner|dining|egg|eggs|skewer|carrots?|pumpkins?|cabbages?|vegetables?|lettuce")],
  ["Clutter", "Cookware", W("cookware|cooking|pans?|kettles?|potandkettle|stove|oven|grill|spit|kitchen")],
  ["Clutter", "Tools & Equipment", W("tools?|hammers?|saws?|shovels?|spades?|pick ?axes?|pickaxes?|hoes?|rakes?|pitchforks?|brooms?|tongs|chisels?|ropes?|chains?|nets?|buckets?|wheelbarrows?|scaffold(s|ing)?|equipment|instruments?|smithandfarm|workshop|forge|bellows|grindstone|looms?|spinning")],
  ["Clutter", "Weapons & Armour", W("weapons?|wpn|swords?|axes?|maces?|daggers?|spears?|polearms?|halberds?|bows?|crossbows?|arrows?|quivers?|shields?|armou?r|helmets?|helms?|gauntlets?|staffs?|staves|wands?|hammers? of war|flails?|clubs?|katanas?|rapiers?|ranged|ballistas?|catapults?|siege|trebuchets?|cannons?|guns?|rifles?|mz ?weapon")],
  ["Clutter", "Treasure & Valuables", W("gold|ingots?|coins?|treasure|loot|gems?|jewels?|jewell?ery|rings?|necklaces?|amulets?|crowns?|goblets? of gold|valuables|silver|trinkets?|idols?|relics?|chalice|hoard")],
  ["Clutter", "Bones & Remains", W("draugr|bones?|skulls?|skeletons?|skel|corpses?|remains|ribs|carcass(es)?|flesh|gore|blood|entrails|mummy|mummies|hanging ?bodies")],
  ["Clutter", "Misc Clutter", W("cobwebs?|spider ?webs?|spiderwebs?|webs?|junk|splinters|trash|garbage|litter")],
  ["Clutter", "Games & Toys", W("chess|pawns?|rooks?|bishops?|knights? piece|go ?stones?|dice|toys?|puppets?|dolls?|cards|lewis|ur")],
  ["Clutter", "Arcane & Alchemy", W("alchemy|alchemical|alchemist|magic|arcane|runes?|crystal ?balls?|orbs?|scrying|grimoires?|spell|magical|ritual|pentagram|summoning|lab|laboratory|mortar|pestle|retort|incense|herbs?|anatomical|specimens?")],

  ["Decor", "Rugs, Banners & Cloth", W("rugs?|carpets?|mats?|curtains?|drapes?|drapery|banners?|tapestr(y|ies)|flags?|pennants?|cloths?|clothing|clothes|linen|fabric|soft ?goods|awnings?|sails?|blankets?|towels?|hides?|pelts?|furs?")],
  ["Decor", "Statues & Art", W("statues?|busts?|sculptures?|gargoyles?|paintings?|portraits?|frames?|art|artwork|murals?|reliefs?|mosaics?|figurines?|totems?|carvings?|mirrors?|clocks?|trophies|trophy|mounted|antlers?|stuffed|ornaments?|decorations?|decorative|deco")],
  ["Decor", "Signs & Notices", W("signs?|signposts?|posters?|notices?|boards?|noticeboards?|plaques?|milestones?|waymarkers?")],
  ["Decor", "Graves & Tombs", W("graves?|gravestones?|headstones?|tombstones?|tombs?|coffins?|sarcophag(us|i)|crypts?|mausoleums?|ossuary|cem|cemetery|graveyard|burial|cairns?")],
  ["Decor", "Religious & Shrines", W("altars?|shrines?|idols?|holy|sacred|reliquary|offering|prayer|icons?|divine|selune|shar|fountain|fountains")],

  ["Machinery", "Traps & Puzzles", W("traps?|puzzles?|puz|pressure ?plates?|levers?|switch(es)?|mechanisms?|spinning ?blades?|blades?|spike ?traps?|bear ?traps?|pendulums?|pit|pits|plates?")],
  ["Machinery", "Machines & Pipes", W("wirebox(es)?|wires?|cables?|machines?|machinery|machina|pipes?|pipework|conveyors?|gears?|cogs?|engines?|generators?|boilers?|pumps?|valves?|tanks?|consoles?|computers?|terminals?|screens?|panels?|elevators?|lifts?|cranes?|winch(es)?|pulleys?|hoppers?|devices?|reactors?")],

  ["Vehicles", "Spacecraft", W("spaceships?|scifi ?ship|space ?ships?|fighter|cruiser|bomber|shuttles?|space ?stations?|asteroids?|freighters?")],
  ["Vehicles", "Airships", W("airships?|gunships?|zeppelins?|blimps?|dirigibles?|skyships?")],
  ["Vehicles", "Ship Parts & Rigging", W("masts?|sails?|rigging|anchors?|anchorwheel|oars?|paddles?|boatpaddles?|hulls?|figureheads?|rudders?|headpoles?|lifeboat ?suspension|ship ?parts?|ship ?wheel|shipwheel|helm ?wheel|crows ?nest")],
  ["Vehicles", "Ships & Boats", W("ships?|boats?|rowboats?|sailboats?|canoes?|galleons?|warships?|longships?|frigates?|barges?|gondolas?|skiffs?|yachts?|rafts?|shipwrecks?|dinghy|dinghies")],
  ["Vehicles", "Carts & Wagons", W("carwheels?|cartwheels?|wagonwheels?|carts?|wagons?|carriages?|coaches?|wheelbarrows?|caravans?|sleds?|sledges?")],

  ["Nature", "Plants & Foliage", W("plants?|bush(es)?|shrubs?|grass(es)?|ferns?|flowers?|vines?|ivy|leaves|leaf|weeds?|moss|hanging ?moss|reeds?|cattails?|lily|lilies|hedges?|foliage|undergrowth|vegetation|cactus|cacti|succulents?|brambles?|thorns?|flora|mushrooms?|fungus|fungi|toadstools?|shelf ?fungus|seaweed|kelp|coral|corals|lichen|herbs?|sprouts?|philodendron|nests?")],
  ["Nature", "Crops & Farming", W("crops?|wheat|corn|hay|haystacks?|straw|barley|farm|farming|fields?|orchards?|scarecrows?|troughs?|pens?|coops?|stables?")],
  ["Nature", "Caves & Formations", W("stalagmites?|stalactites?|speleothems?|caves?|caverns?|cave ?walls?|formations?|columns? of rock|grottos?")],
  ["Nature", "Cliffs & Mountains", W("cliffs?|crags?|craggy|ridges?|mesas?|buttes?|bluffs?|outcrops?|peaks?|vista|vistas|canyons?|escarpments?")],
  ["Nature", "Rocks & Boulders", W("rocks?|boulders?|stones?|pebbles?|standing ?stones?|menhirs?|monoliths?|groundrock|granite|limestone|sandstone|slate|basalt|scree|gravel")],
  ["Nature", "Water & Waterfalls", W("water|waterfalls?|wfl|rivers?|streams?|ponds?|pools?|lakes?|puddles?|springs?|wells?|lava|magma|ice ?sheets?|creeks?")],
  ["Nature", "Terrain & Ground", W("terrain|ground|dirt|mud|sand|snow ?drifts?|hills?|dunes?|landscapes?|land|heightmaps?|earth|soil|paths?|trails?|roads?|mounds?|piles?")],

  ["Characters", "Creatures & NPCs", W("npcs?|creatures?|monsters?|animals?|people|villagers?|guards?|dragon|wolf|horse|cow|pig|sheep|chickens?|birds?|dogs?|cats?|rats?|spiders?")],
];

// Folder names used by the game-rip modules as role folders. These are strong signals
// and go straight to a type; the generic ones ("other", "decoration", "props_medium")
// only say "this is a prop" and fall through to the keyword rules.
const ROLE_FOLDERS = {
  wall: "Walls", walls: "Walls", roof: "Roofs & Ceilings", ceiling: "Roofs & Ceilings", ceilings: "Roofs & Ceilings",
  floor: "Floors & Tiles", floors: "Floors & Tiles", stair: "Stairs & Ladders", stairs: "Stairs & Ladders",
  door: "Doors & Gates", doors: "Doors & Gates", window: "Windows", windows: "Windows",
  arch: "Arches", arches: "Arches", pillar: "Pillars & Columns", pillars: "Pillars & Columns",
  balustrade: "Railings & Trim", trim: "Railings & Trim", fence: "Fences & Barriers", fences: "Fences & Barriers",
  bridge: "Bridges", building: "Towers & Buildings", buildings: "Towers & Buildings",
  tree: "Trees", plant: "Plants & Foliage", rock: "Rocks & Boulders", cliff: "Cliffs & Mountains",
  cave: "Caves & Formations", waterfall: "Water & Waterfalls", water: "Water & Waterfalls", terrain: "Terrain & Ground",
  books: "Books & Scrolls", tableware: "Food & Tableware", cookware: "Cookware", bottles: "Bottles & Potions",
  vessels: "Pots, Jars & Vases", containers: null, storage: null, table: "Tables & Desks", seating: "Seating",
  bed: "Beds", light: "Lights & Fires", lighting: "Lights & Fires", soft_goods: "Rugs, Banners & Cloth",
  art: "Statues & Art", statues: "Statues & Art", valuables: "Treasure & Valuables", tool: "Tools & Equipment",
  puzzle: "Traps & Puzzles", trap: "Traps & Puzzles", mechanisms: "Traps & Puzzles", flesh: "Bones & Remains",
  remains: "Bones & Remains", tombs: "Graves & Tombs", ship: "Ships & Boats",
  // Skyrim / Oblivion
  books_scrolls: "Books & Scrolls", bridges: "Bridges", columns_arches: "Pillars & Columns", halls_rooms: "Rooms & Corridors",
  statues: "Statues & Art", rubble: "Ruins & Rubble", food_drink: "Food & Tableware", flora: "Plants & Foliage",
  food: "Food & Tableware", tools: "Tools & Equipment", traps: "Traps & Puzzles",
  // FF12 / FF7 folder names
  swords: "Weapons & Armour", ranged: "Weapons & Armour", axes: "Weapons & Armour", staves: "Weapons & Armour",
  shields: "Weapons & Armour", polearms: "Weapons & Armour", armour: "Weapons & Armour", trinkets: "Treasure & Valuables",
  machines: "Machines & Pipes", machinery: "Machines & Pipes", study: "Books & Scrolls",
  block: "Walls", workedstone: "Walls", fixture: "Machines & Pipes", lamp: "Lights & Fires", hanginglantern: "Lights & Fires",
  candle: "Lights & Fires", chandelier: "Lights & Fires", stonelantern: "Lights & Fires", ladder: "Stairs & Ladders",
  cupandplate: "Food & Tableware", feast: "Food & Tableware", provisions: "Food & Tableware", crate: "Crates & Boxes",
  undergrowth: "Plants & Foliage", potplant: "Plants & Foliage", flower: "Plants & Foliage",
  nest: "Plants & Foliage", potandvase: "Pots, Jars & Vases", potandkettle: "Cookware", shelf: "Shelves & Cabinets",
  smithandfarm: "Tools & Equipment", sack: "Sacks & Baskets", basket: "Sacks & Baskets", bucket: "Sacks & Baskets",
  barrel: "Barrels & Kegs", chairandstool: "Seating", bench: "Seating", chest: "Chests", cart: "Carts & Wagons",
  rope: "Tools & Equipment", timber: "Floors & Tiles", altar: "Religious & Shrines", shelter: "Towers & Buildings",
  householdclutter: null, stage: "Floors & Tiles", prison: "Rooms & Corridors", ruins: "Ruins & Rubble",
  bottle: "Bottles & Potions",
};
export const TYPE_GROUP_LIST = TYPE_RULES.map(([g, t]) => [g, t]);
const TYPE_GROUP = Object.fromEntries(TYPE_RULES.map(([g, t]) => [t, g]));
TYPE_GROUP["Map Pieces"] = "Architecture";
export const TYPE_GROUPS = TYPE_GROUP;
TYPE_GROUP["Grass Billboards"] = "Nature";
TYPE_GROUP["Unsorted Props"] = "Other";
TYPE_GROUP["Level Geometry"] = "Architecture";
TYPE_GROUP["Misc Architecture"] = "Architecture";
TYPE_GROUP["Misc Furniture"] = "Furniture";
TYPE_GROUP["Misc Containers"] = "Containers";
TYPE_GROUP["Misc Decor"] = "Decor";
TYPE_GROUP["Misc Clutter"] = "Clutter";
TYPE_GROUP["Misc Nature"] = "Nature";

// Folders that only say "this is broadly X": used when nothing more specific matched.
const ROLE_DEFAULTS = {
  furniture: "Misc Furniture", containers: "Misc Containers", storage: "Misc Containers",
  decoration: "Misc Decor", decor: "Misc Decor", dressing: "Misc Decor", art: "Statues & Art",
  clutter: "Misc Clutter", householdclutter: "Misc Clutter", misc: null, other: null,
  nature: "Misc Nature", vegetation: "Misc Nature", scenery: "Misc Nature",
  structures: "Misc Architecture", structure: "Misc Architecture",
  structures_large: "Level Geometry", structures_medium: "Level Geometry", structures_small: "Level Geometry",
  floors_roofs: "Floors & Tiles", household_clutter: "Misc Clutter", household_furniture: "Misc Furniture", building_parts: "Misc Architecture", common_architecture: "Misc Architecture",
};

// Folders that are bookkeeping rather than meaning — dropped before matching.
const NOISE = new Set(["models", "assets", "tiles", "modules", "props", "artificial", "natural", "set", "v", "gen", "misc",
  "other", "alt", "new", "old", "a", "b", "c", "d", "e", "f", "the", "and", "of", "with", "mz", "glb", "gltf", "scaled",
  "high", "res", "structures", "large", "medium", "small", "props", "piece", "pieces", "decoration", "decor", "clutter",
  "furniture", "nature", "dressing", "scenery", "interiors", "interior", "exterior", "outside", "inside"]);

function hay(ws) {
  const s = " " + ws.join(" ") + " ";
  return [s, " " + ws.join("") + " "];
}

const ANCHORED = new Map();
function anchored(re) {
  if (!ANCHORED.has(re)) ANCHORED.set(re, new RegExp("^ " + re.source.replace(/^\(\^\| \)/, "")));
  return ANCHORED.get(re);
}
/** Type from a file name: the RIGHTMOST word that names a type wins, because in names like
 * "mage-tower-crystal" or "wooden-fort-wall" the last noun is the thing itself. */
// Words that describe a thing rather than name it — material, position, state, season,
// setting. They never count as the head noun ("chest-large-gold" is a chest, not gold).
const MODIFIERS = new Set(("stone stones rock rocks wood wooden brick bricks gold golden silver iron metal steel sand sandy ice icy snow snowy " +
  "marble clay glass bone water moss mossy dirt mud cracked broken ruin ruined ruins damaged destroyed pile piles ground empty filled " +
  "scattered corner corners edge edges corridor alley top bottom base side sides end ends mid middle inner outer left right upper lower " +
  "small large big tiny huge tall short wide narrow long thin thick low high final alone single double detail details spring summer " +
  "standalone autumn winter graveyard forest lake desert jungle cave underdark dungeon castle town city village scaffold scaffolding painted " +
  "straight curved convex concave angled round square half full cluster group set variant alt road").split(" "));

function headType(ws) {
  for (let k = ws.length - 1; k >= 0; k--) {
    if (MODIFIERS.has(ws[k])) continue;
    const tail = " " + ws.slice(k).join(" ") + " ";
    for (const [, type, re] of TYPE_RULES) if (anchored(re).test(tail)) return type;
  }
  return null;
}

function ruleType(ws) {
  if (!ws.length) return null;
  const [spaced] = hay(ws);
  for (const [, type, re] of TYPE_RULES) if (re.test(spaced)) return type;
  // compounds ("castlewall", "bookcase"): split into known words and try again
  const split = ws.flatMap(splitGlued);
  if (split.length === ws.length) return null;
  const [s2] = hay(split);
  for (const [, type, re] of TYPE_RULES) if (re.test(s2)) return type;
  return null;
}

// ───────────────────────────────────────────── themes ──
const THEME_RULES = [
  ["Dungeon", W("dungeons?|dun|oubliette|keep ?dungeon|catacombs?|labyrinth|mad ?mage|stoneveil|dungeon")],
  ["Underdark", W("blackreach|falmer|falmer ?hives|root ?tunnels|underdark|drow|duergar|mindflayer|mind ?flayer|nautiloid|colony|myconid|feydark|abyss|oolacile|ash ?lake|blighttown|grimmgard")],
  ["Caves & Mines", W("caverns|mines|caves?|caverns?|mines?|mining|grotto|quarry|speleothems?|stalagmites?|skull ?cavern|tunnels?")],
  ["Crypt & Graveyard", W("nordic ?ruins|draugr|barrow|soul ?cairn|graveyard|cemetery|cem|crypts?|tombs?|catacombs?|gravesite|mausoleum|ossuary|necropolis|undead|grave|graves|coffins?|sarcophag\\w*|burial|loculi|gothic")],
  ["Temple & Holy", W("weynon ?priory|sky ?haven|high ?hrothgar|sovngarde|shrines ?and ?monuments|azuras ?star|temples?|church|chapel|cathedral|abbey|shrine|monastery|sanctuary|divine|holy|shar|selune|sanctum|pantheon|bevelle|baaj|djose|kilika|besaid|macalania|remiem|zanarkand|anor ?londo|parish")],
  ["Castle & Fortress", W("cloud ?ruler|white ?gold ?palace|fort ?dawnguard|imperial ?forts?|volkihar|castles?|keeps?|fortress|forts?|citadel|stronghold|battlements?|ramparts?|towers?|stormveil|drangleic|iron ?keep|castlewall|fortifications?|gatehouse|palace|throne")],
  ["Town & City", W("town|towns|city|cities|village|villages|street|streets|market|urban|township|district|houses?|rural ?street|plaza|reithwin|baldurs|anvil|whiterun|riften|solitude|markarth|windhelm|winterhold|raven ?rock|skaal|chorrol|cheydinhal|bravil|bruma|skingrad|leyawiin|kvatch|imperial ?city|majula|shops?|citz|anvilupperclass|anvillchouse")],
  ["Tavern & Home", W("tavern|inn|kitchen|bedroom|dining|home|household|living|cottage|homestead|the ?rest|bar")],
  ["Wizard & Arcane", W("arcane ?university|orrery|telvanni|wizard|wizards|mage|mages|arcane|magic|alchemy|alchemist|laboratory|lab|sorcer\\w*|library|scriptorium|mages ?guild|anvilmagesguildinterior|runes?")],
  ["Prison & Torture", W("imperial ?prison|prison|prisons|jail|cells?|torture|torturerack|gaol|dungeon ?cells?|stocks|gallows|pris|shackles|cages?")],
  ["Harbour & Coast", W("shipwrecks?|ships ?and ?docks|harbou?r|docks?|port|pier|wharf|coastal|seaside|beach|ship|ships|shipwreck|sea|ocean|lighthouse|sandy ?seaside|smugglers?|anvillighthouse|coral")],
  ["Forest & Wilds", W("forest|woods|woodland|grove|druid|wilds?|wilderness|ancient ?forest|forest ?lake|glade|meadow|bloodforest|huntsman|copse|fey|feywild|summer|spring|autumn")],
  ["Jungle", W("jungle|tropical|rainforest|palm|philodendron")],
  ["Desert", W("desert|deserts|sand|sandy|dunes?|oasis|pyramid|sandstone|cactus|arid|caravanserai|tomb ?of ?annihilation")],
  ["Snow & Ice", W("snow|snowy|ice|icy|frozen|frost|winter|glacier|tundra|arctic|frostmaiden")],
  ["Swamp", W("swamp|swamps|bog|marsh|marshes|fen|mire|bayou|mangrove|bullywug")],
  ["Farm & Countryside", W("farmhouses?|hearthfire|homestead|countryside|shacks?|farm|farms|farmlands?|rural|crops?|barn|field|fields|orchard|countryside|pasture|mill|windmill|harvest|hay")],
  ["Camp & Travel", W("riekling|camps?|campsite|campfire|tents?|caravan|roadside|wagon|travel|expedition|bandit ?hideout|bandit")],
  ["Ruins", W("ruins?|ruined|ancient ?castle|fallen ?titan|titans ?end|cetra|cetraruins|forgotten|remnants|ayleid|dwemer|nordic|fort ?ruins|new ?londo")],
  ["Hell & Infernal", W("oblivion ?plane|oblivion ?gates|oblivion ?caves|apocrypha|hell|hells|infernal|abyssal|demonic|devil|avernus|fiend|lava|volcanic|cinders|chaos|izalith|burning|brimstone")],
  ["Sci-fi & Space", W("scifi|sci ?fi|space|spaceship|starship|asteroids?|cyberpunk|futuristic|station|stations|spelljammer|scav|robot|robots")],
  ["Industrial & Sewer", W("ratway|sewers?|sew|industrial|factory|forge|smithy|blacksmith|foundry|workshop|pipes?|machinery|sawmill|refinery")],
];

const CONDITION_RULES = [
  ["Mossy & Overgrown", W("mossy|moss|overgrown|vines?|ivy|vined|jungle ?stone")],
  ["Snowy", W("snow|snowy|frozen|icy|frost")],
  ["Broken & Ruined", W("broken|cracked|destroyed|destruct|damaged|ruined|ruins?|wrecked|crumbling|collapsed|burnt|burned|shattered|eroded|decayed|rotten|missing")],
  ["Pristine", W("pristine|clean|polished|intact")],
];

// ───────────────────────────────────────────── collections ──
function monthName(tok) {
  const m = tok.match(/^([a-z]+)(\d{2})$/);
  if (m && MONTHS[m[1]]) return `${MONTHS[m[1]]} 20${m[2]}`;
  return null;
}

/** Baileywiki files everything by release. Turn that into sets a person would recognise. */
function baileywikiCollection(parts) {
  // parts: path segments below modules/baileywiki-3d, without file name
  const p = parts.slice();
  if (p[0] === "models") p.shift();
  const clean = (s) => titleCase(s.replace(/^\d+-/, "").replace(/[-_]+/g, " ").replace(/\bv(\d)\b/, "v$1").trim());
  if (!p.length) return "Baileywiki — loose";
  // models/2025/06-june/walls-mossy  → "Walls Mossy (Jun 2025)"
  if (/^20\d\d$/.test(p[0]) && p[1]) {
    const mon = MONTHS[p[1].replace(/^\d+-/, "")] || clean(p[1]);
    const set = p[2] ? clean(p[2]) : "Release";
    return `${set} (${mon} ${p[0]})`;
  }
  // models/maps/2024/24-10-caravan  or models/maps/23-02-forest-cliffs
  if (p[0] === "maps") {
    const leaf = p.filter((x) => !/^20\d\d$/.test(x) && x !== "maps" && x !== "Geometry")[0] || p[p.length - 1];
    const name = leaf.replace(/^\d{2,4}-\d{2}-?/, "").replace(/^\d{2}-\d{2}\s*/, "");
    return `Map: ${clean(name || leaf)}`;
  }
  if (p[0] === "scenes") return `Scene: ${clean(p[1] || "misc")}`;
  if (p[0] === "maps-modular" || p[0] === "00-modular-sets") {
    const set = clean(p[1] || "modular");
    const sub = p[2] && ["cracked", "mossy", "pristine"].includes(p[2]) ? ` — ${clean(p[2])}` : "";
    return `${set.replace(/^Dec24 /, "Dec 2024 ").replace(/^Oct24 /, "Oct 2024 ")}${sub}`;
  }
  // props-natural/trees/mar24-set → "Trees — Mar 2024 set"
  if (p[0] === "props-natural" || p[0] === "props-artificial") {
    const cat = clean(p[1] || "props");
    const rest = p.slice(2).filter((x) => x !== "props");
    if (!rest.length) return `${cat} — core`;
    const set = rest[0];
    const mon = monthName(set.replace(/-set$/, ""));
    const setName = mon ? `${mon} set` : clean(set.replace(/-set$/, " set"));
    return `${cat} — ${setName}`;
  }
  return clean(p[0]);
}

const TOP_COLLECTION_DEPTH = {
  "canvas3dcompendium": 2, // KayKitPack/Dungeon
};

function prettyFolder(s) {
  return titleCase(decodeURIComponent(s).replace(/[_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim())
    .replace(/\bS\b/g, "s").replace(/ S /g, "'s ");
}

// ───────────────────────────────────────────── size ──
export const SIZE_BUCKETS = [
  ["Tiny (< 0.5 m)", 0.5],
  ["Small (0.5–2 m)", 2],
  ["Medium (2–6 m)", 6],
  ["Large (6–20 m)", 20],
  ["Huge (20 m +)", Infinity],
];
export function sizeBucket(maxDim) {
  if (maxDim == null || !isFinite(maxDim) || maxDim <= 0) return null;
  return SIZE_BUCKETS.find(([, lim]) => maxDim < lim)[0];
}
export const DETAIL_BUCKETS = [
  ["Light (< 5k tris)", 5000],
  ["Standard (5k–50k)", 50000],
  ["Detailed (50k–150k)", 150000],
  ["Heavy (150k–250k)", 250000],
  ["Risky (250k +, may freeze)", Infinity],
];
export function detailBucket(tris) {
  if (tris == null) return null;
  return DETAIL_BUCKETS.find(([, lim]) => tris < lim)[0];
}


// ───────────────────────────────────────────── glued names ──
// Skyrim and Oblivion name files like "shipanchorwheel01" or "prisonercarriage01": one long
// lowercase run. Those are split into the known words they contain (longest match first),
// so "shipanchorwheel" reads as "ship anchor wheel".
const EXTRA_VOCAB = "standalone burnt burned burning spawn sarcophagus silverfir cupboard sewer sewers dead draugr piece pieces static anim animating loose guild ingot ingots common prisoner crafting wreck katariah bloatedfloat redsaber emmamaya large small ship boat cart wagon carriage anchor wheel mast oar plank planks deck cabin".split(" ");
let _vocab = null;
function vocab() {
  if (_vocab) return _vocab;
  const v = new Set(EXTRA_VOCAB);
  for (const [, , re] of TYPE_RULES) {
    const body = re.source.replace(/^\(\^\| \)\(/, "").replace(/\)\( \|\$\)$/, "");
    for (let alt of body.split("|")) {
      alt = alt.replace(/ \?/g, "");
      const base = alt.replace(/\((es|ies|s)\)\?$/, "").replace(/s\?$/, "").replace(/\?$/, "");
      if (/[^a-z]/.test(base)) continue;
      v.add(base);
      if (/\(es\)\?$/.test(alt)) v.add(base + "es");
      if (/s\?$/.test(alt)) v.add(base + "s");
    }
  }
  for (const m of MODIFIERS) v.add(m);
  _vocab = [...v].filter((w) => w.length >= 4 || ["oar", "rug", "mat", "pot", "jar", "urn", "keg", "bed", "cot", "hut", "box", "log", "cup", "mug", "axe", "net", "cog"].includes(w))
    .sort((a, b) => b.length - a.length);
  _vocab.set = new Set(_vocab);
  _vocab.byFirst = {};
  for (const v of _vocab) (_vocab.byFirst[v[0]] ??= []).push(v);
  return _vocab;
}
export function splitGlued(w) {
  const V = vocab();
  if (w.length < 6 || V.set.has(w)) return [w];
  const out = [];
  let i = 0;
  while (i < w.length) {
    const hit = (V.byFirst[w[i]] || []).find((v) => w.startsWith(v, i));
    if (hit) { out.push(hit); i += hit.length; } else i++;
  }
  // only trust a split that explains most of the word
  return out.length && out.join("").length >= w.length * 0.4 ? out : [w];
}

// ───────────────────────────────────────────── vehicles ──
// A whole ship, airship or wagon is a Vehicle whatever folder it sits in. A PIECE of one
// (a hull wall, a deck floor) keeps its architectural type and is ALSO listed under
// Vehicles › Ship Parts, so it turns up whichever way you look for it.
const AIR = new Set("airship airships gunship gunships zeppelin zeppelins blimp blimps dirigible dirigibles skyship skyships".split(" "));
const SEA = new Set("ship ships boat boats rowboat rowboats sailboat sailboats canoe canoes raft rafts galleon galleons warship warships longship longships frigate frigates barge barges gondola gondolas skiff skiffs dinghy dinghies yacht yachts shipwreck shipwrecks ferry".split(" "));
const LAND = new Set("wagon wagons cart carts carriage carriages coach coaches sled sleds sledge sledges wheelbarrow wheelbarrows handcart".split(" "));
// structural words: anywhere in the name they mean "a piece of"
const STRUCT = new Set(("wall walls floor floors deck decks plank planks beam beams crossbeam trim border borders window windows door doors " +
  "doorframe hatch hatches stair stairs steps ladder ladders rope ropes railing railings rail rails pillar pillars column columns roof roofs " +
  "ceiling ceilings cabin cabins interior hull hulls frame frames mechanism pullup platform platforms corridor launch dock docks pier " +
  "rigging mast masts mainmast anchor anchors anchorwheel oar oars paddle paddles figurehead wheel wheels rivets entrance board boards cannon cannons netting " +
  "balcony balconies balustrade balustrades throne trapdoor patch fence fences fabric sailback exterior darkness rudder headpole water").split(" "));
// contents words: only a piece when they come AFTER the vehicle word ("ship crate" vs "barrel cart")
const CONTENTS = new Set("bell bells crate crates barrel barrels hammock hammocks bed beds table tables chair chairs bench benches lantern lanterns lamp lamps flag flags net nets cargo seat seats sack sacks".split(" "));
const SHIPLIKE_PLACE = /(nautiloid|bloatedfloat|redsaber|emmamaya|katariah|shipwreck|(^|\/)ships?(_parts)?\/|(^|\/)ship_|starship|shipyard|airship)/i;

function vehicleOf(w) { return AIR.has(w) ? "Airships" : SEA.has(w) ? "Ships & Boats" : LAND.has(w) ? "Carts & Wagons" : null; }

const VEHICLE_TYPES = new Set(["Airships", "Ships & Boats", "Carts & Wagons", "Spacecraft"]);
function vehicleCheck(fileWords, relPath, strongRole) {
  let at = -1, vtype = null;
  fileWords.forEach((w, i) => { const t = vehicleOf(w); if (t && (vtype == null || t === "Airships")) { at = i; vtype = t; } });
  if (vtype) {
    // "boat-small-sails-up" is a sailboat, not a sail
    const after = headType(fileWords.slice(at + 1).filter((w) => w !== "sail" && w !== "sails"));
    const piece = strongRole || /ship_parts/i.test(relPath)
      || fileWords.some((w) => STRUCT.has(w)) || fileWords.some((w, i) => i > at && CONTENTS.has(w))
      || (after && !VEHICLE_TYPES.has(after));
    if (!piece) return { whole: vtype };
    return { extra: vtype === "Carts & Wagons" ? "Carts & Wagons" : "Ship Parts & Rigging" };
  }
  if (SHIPLIKE_PLACE.test(relPath)) return { extra: "Ship Parts & Rigging" };
  return null;
}

// ───────────────────────────────────────────── assets ──
/**
 * @param {string} path   e.g. "modules/bg3-faerun/assets/Tiles/Underdark/plant/Underdark_Mushroom_A.glb"
 * @param {string} root   the registered source folder the file was found under
 */
export function classifyAsset(path, root) {
  const dec = decodeURIComponent(path);
  const moduleId = dec.split("/")[1];
  const below = root && dec.startsWith(decodeURIComponent(root) + "/") ? dec.slice(decodeURIComponent(root).length + 1) : dec.split("/").slice(2).join("/");
  const parts = below.split("/");
  const file = parts.pop();
  const folderWords = parts.map((f) => words(f).filter((w) => !NOISE.has(w)));
  const folderSet = new Set(folderWords.flat());
  if (folderSet.has("starship") || folderSet.has("scifi")) folderSet.add("ship");
  // "shelves stocked with books": what follows is contents, not the thing
  const fw = words(file.replace(/\.(glb|gltf|webp)$/i, "")).flatMap(splitGlued);
  const cut = fw.findIndex((w, i) => i > 0 && ["with", "stocked", "filled", "containing", "holding"].includes(w));
  const rawFileWords = (cut > 0 ? fw.slice(0, cut) : fw).filter((w) => !NOISE.has(w))
    .join(" ").replace(/\b(scifi|space) ship\b/g, "spaceship").split(" ").filter(Boolean);
  // Baileywiki prefixes file names with their release ("oct24-cupboard1") and its starship
  // props all start "scifi-ship-", so those words are dropped before matching.
  let fileWords = rawFileWords.filter((w) => !monthName(w) && !(MONTHS[w] && rawFileWords.length > 1));
  if (folderSet.has("starship")) fileWords = fileWords.filter((w) => w !== "scifi" && w !== "ship" && w !== "spaceship");
  if (!fileWords.length) fileWords = rawFileWords;
  const allWords = [...fileWords, ...folderWords.flat()];

  // ── type
  const isGame = (SOURCES[moduleId]?.group === "Games");
  // A game rip's first folder is the place it came from ("Iron_Keep", "Crown_of_the_Shulva").
  // Place names are not evidence of what a thing is, so they never drive the type.
  const typeFolderWords = isGame ? folderWords.slice(1) : folderWords;
  let type = null;
  let roleDefault = null;
  let strongRole = false;
  const isBillboard = /\.webp$/i.test(file);
  if (isBillboard) type = "Grass Billboards";
  if (!type && moduleId === "baileywiki-3d" && (parts[1] === "maps" || parts[0] === "scenes")) type = "Map Pieces";
  if (!type && moduleId === "ffx-spira-3d") type = "Map Pieces";
  if (!type) {
    for (let i = parts.length - 1; i >= (isGame ? 1 : 0); i--) {
      const key = parts[i].toLowerCase();
      if (ROLE_FOLDERS[key]) { type = ROLE_FOLDERS[key]; strongRole = !VEHICLE_TYPES.has(type) && type !== "Towers & Buildings"; break; }
      if (!roleDefault && ROLE_DEFAULTS[key]) roleDefault = ROLE_DEFAULTS[key];
    }
  }
  // a role folder that disagrees with a clearly architectural file name loses:
  // Oblivion files "arena_sewer_a" under tableware/, which is the rip's mistake
  if (type && strongRole && (type === "Food & Tableware" || type === "Tools & Equipment")) {
    const nameType = headType(fileWords);
    if (nameType && TYPE_GROUP[nameType] === "Architecture" && nameType !== "Towers & Buildings") type = nameType;
  }
  if (!type) type = headType(fileWords) || ruleType(fileWords);
  if (!type) for (let i = typeFolderWords.length - 1; i >= 0 && !type; i--) type = ruleType(typeFolderWords[i]);
  if (!type) type = roleDefault;
  if (!type) type = "Unsorted Props";
  const types = [type];
  if (!isBillboard && type !== "Map Pieces") {
    const v = vehicleCheck(fileWords, below, strongRole);
    if (v?.whole) { if (type !== v.whole) types.unshift(v.whole); type = v.whole; types.splice(1); }
    else if (v?.extra && !types.includes(v.extra)) {
      // a ship piece that has no better home (unsorted, decor, clutter) lives under Vehicles
      const g = TYPE_GROUP[type];
      if (v.extra === "Ship Parts & Rigging" && (!["Architecture", "Furniture", "Containers", "Lighting", "Nature"].includes(g) || (type === "Towers & Buildings" && !strongRole))) { type = v.extra; types.splice(0, types.length, v.extra); }
      else types.push(v.extra);
    }
  }
  const group = TYPE_GROUP[type] || "Other";

  // ── themes: whole path, plus region folder names
  const [spaced] = hay(allWords);
  const regionWords = words(parts.join(" "));
  const [regionSpaced] = hay(regionWords);
  const themes = [];
  for (const [theme, re] of THEME_RULES) if (re.test(spaced) || re.test(regionSpaced)) themes.push(theme);
  // implied themes by type
  if (type === "Spacecraft" && !themes.includes("Sci-fi & Space")) themes.push("Sci-fi & Space");
  if (types.some((t) => t === "Ships & Boats" || t === "Ship Parts & Rigging") && !themes.includes("Harbour & Coast") && !/starship|nautiloid|scifi|space/i.test(dec)) themes.push("Harbour & Coast");
  if (themes.includes("Sci-fi & Space")) { const i = themes.indexOf("Harbour & Coast"); if (i >= 0) themes.splice(i, 1); }
  if (moduleId === "baileywiki-3d" && /scifi|starship|space/.test(dec) && !themes.includes("Sci-fi & Space")) themes.push("Sci-fi & Space");

  // ── condition
  let condition = null;
  for (const [c, re] of CONDITION_RULES) if (re.test(spaced)) { condition = c; break; }

  // ── collection
  let collection;
  if (moduleId === "baileywiki-3d") collection = baileywikiCollection(parts);
  else if (moduleId === "3d-animations") collection = "Animated props";
  else if (isBillboard) collection = "Vegetation billboards";
  else {
    const depth = TOP_COLLECTION_DEPTH[moduleId] || 1;
    const top = parts.slice(0, depth);
    // canvas3dcompendium second level is only meaningful for the kit folders
    if (moduleId === "canvas3dcompendium" && !["KayKitPack", "Kenney", "CreativeTrio"].includes(parts[0])) top.length = 1;
    collection = top.length ? top.map(prettyFolder).join(" › ") : "Loose";
  }

  return { moduleId, type, types, group, themes, condition, collection, name: displayName(file), billboard: isBillboard };
}

// ───────────────────────────────────────────── tokens ──
const CREATURE_RULES = [
  ["Dragon", W("lichdragon|dragons?|drakes?|wyrms?|wyverns?|dracolich|dragonborn ?wyrm|pseudodragon|faerie ?dragon|drake|wyrmling|dragon ?turtle|bahamut|tiamat|midgar ?zolom")],
  ["Undead", W("undead|skeletons?|skeletal|zombies?|ghouls?|ghasts?|ghosts?|wraiths?|specters?|spectres?|liches?|lich|vampires?|vampire ?spawn|mummy|mummies|banshees?|revenants?|wights?|shadows?|poltergeist|bonepile|hollow|hollows|deathknight|death ?knight|fallen ?monk|zombie|crypt|bone|bones|flameskull|demilich|dullahan|nightwalker")],
  ["Fiend", W("demons?|devils?|fiends?|imps?|quasits?|balors?|pit ?fiend|succubus|incubus|erinyes|hell ?hounds?|hellhound|barbazu|orthon|cambion|yugoloths?|glabrezu|hezrou|vrock|nalfeshnee|marilith|abyssal|infernal|elementaldevil")],
  ["Celestial", W("angels?|celestials?|devas?|planetars?|solars?|couatls?|pegasus|unicorns?|seraph")],
  ["Elemental", W("elementals?|mephits?|azers?|salamanders?|galeb|genies?|djinni|efreeti|dao|marid|flame|magma|water ?weird|bombs?|grenade|elemental")],
  ["Fey", W("fey|fairy|faerie|sprites?|pixies?|dryads?|satyrs?|hags?|redcaps?|eladrin|nymphs?|harengon|pixie|quickling|korred|moogles?|cactuar|tonberry")],
  ["Giant", W("giants?|ogres?|trolls?|ettins?|cyclops|fomorians?|titans?|firbolg ?giant|oni|colossus|hill ?giant|frost ?giant|fire ?giant|storm ?giant")],
  ["Construct", W("golems?|constructs?|automatons?|modrones?|animated ?armou?r|helmed ?horror|warforged|robots?|mechs?|machina|drones?|shield ?guardian|gargoyles?|iron ?man|mythril ?golem|catch ?mech|sentry|turret|tower|guardian|buster|ykt|clockwork")],
  ["Plant", W("treants?|shambling ?mounds?|blights?|myconids?|vegepygmy|sprouts?|flowers?|plants?|vines?|mandrake|malboro|mandragora|fungus|mushrooms?|dryad ?tree|tree|bed ?of ?chaos|shrieker")],
  ["Ooze", W("oozes?|jell(y|ies)|puddings?|slimes?|gelatinous|flan|flans|blob")],
  ["Aberration", W("aberrations?|beholders?|mind ?flayers?|illithids?|aboleths?|gibbering|nothics?|chuul|grells?|intellect ?devourer|otyugh|cloaker|gazer|spectator|slaad|flumph|elder ?brain|nautiloid|sinspawn|sin")],
  ["Monstrosity", W("monstrosit(y|ies)|owlbears?|chimeras?|manticores?|basilisks?|medusas?|hydras?|minotaurs?|harpies?|harpy|griffons?|gryphons?|hippogriffs?|krakens?|mimics?|nagas?|rocs?|remorhaz|purple ?worm|bulette|umber ?hulk|ankheg|displacer|behir|lamia|sphinx|yeti|worgs?|cockatrice|gorgon|chimera|behemoth|coeurl|marlboro|cockatrice|saurian|reaver|crestbird|mimic|urn|kimara|capparwire|bagnadrana|bagrisk|gigantoad|grand ?horn|fusant|jersey")],
  ["Beast", W("beasts?|wolf|wolves|bears?|boars?|rats?|bats?|spiders?|snakes?|serpents?|crocodiles?|alligators?|lions?|tigers?|panthers?|horses?|ponies|pony|dogs?|hounds?|cats?|birds?|ravens?|crows?|eagles?|hawks?|owls?|crabs?|turtles?|tortoises?|sharks?|fish|piranhas?|frogs?|toads?|lizards?|apes?|monkeys?|elephants?|mammoths?|deer|elk|goats?|sheep|cows?|oxen|ox|bulls?|chickens?|insects?|beetles?|scorpions?|centipedes?|worms?|wasps?|bees?|ants?|dinosaurs?|chocobos?|raptors?|mosquito|mosquitoes|splasher|shred|dire|tiger|bee|octopus|squid|seal|walrus|yak|camel|moose|hyena|jackal|badger|weasel|ferret|mole|hedgehog|vulture|slug|snail")],
  ["Humanoid", W("humanoids?|humans?|elves?|elf|drow|dwarf|dwarves|dwarven|halflings?|gnomes?|orcs?|half ?orc|goblins?|hobgoblins?|bugbears?|kobolds?|gnolls?|lizardfolk|tabaxi|tieflings?|aasimar|dragonborn|goliaths?|firbolgs?|tritons?|kenku|yuan ?ti|githyanki|githzerai|duergar|svirfneblin|bullywugs?|grungs?|tortles?|lycanthropes?|werewolf|wererat|werebear|wereboar|weretiger|bandits?|guards?|soldiers?|knights?|nobles?|priests?|acolytes?|cultists?|mages?|wizards?|sorcer\\w+|warlocks?|clerics?|paladins?|rangers?|rogues?|fighters?|barbarians?|bards?|druids?|monks?|artificers?|assassins?|spies|spy|thugs?|veterans?|gladiators?|commoners?|villagers?|townsfolk|merchants?|blacksmiths?|barkeeps?|bakers?|pirates?|sailors?|captains?|archers?|warriors?|judges?|party|companion|beastfolk|npcs?|adventurers?|hunters?|witch|witches|torturer|trader|barkeep|bar ?keep|noblewoman|nobleman|ninja|prisoner|overseer|keeper|scholar|gunslinger|cavalier|steelworker|exile|cleanrot|cuckoo|glintstone|outfit|armoured|hero|heroes|villain|king|queen|prince|princess|lord|lady|monk|nun|sorceress|punk|girl|boy|man|woman|female|male")],
  ["Object / Effect", W("spell ?effects?|spiritual ?weapon|effects?|objects?|furniture|portable|anvil|wagon|cart|boat|ship|vehicle|statue|totem|altar|sealed ?orb|turret|cannon")],
];

const TOKEN_ROLE_RULES = [
  ["Boss", W("bosses|boss")],
  ["Summon / Esper", W("summons?|espers?|aeons?|fayth")],
  ["Adventurer / PC", W("adventurers?|party|turnsheet|companions?|heroes|artificer|barbarians|bard|clerics|druids|fighters|monks|paladins|rangers|rogues|sorcerers|warlocks|wizards")],
  ["NPC", W("npcs?|townsfolk|beastfolk|commoners|townsfolk|moogles|judges|soldiers|extras|armoured|merchants?|misc ?npcs")],
  ["Enemy", W("enemies|enemy|creatures|monsters|beasts|animals|machina|undead|bombs|aquatic|insects|plants")],
];

const SIZE_CODES = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };
const TYPE_FROM_5E = {
  aberration: "Aberration", beast: "Beast", celestial: "Celestial", construct: "Construct", dragon: "Dragon",
  elemental: "Elemental", fey: "Fey", fiend: "Fiend", giant: "Giant", humanoid: "Humanoid", monstrosity: "Monstrosity",
  ooze: "Ooze", plant: "Plant", undead: "Undead",
};

function normName(s) {
  return words(s).filter((w) => !["mz", "animated", "new", "alt", "colorized", "the", "a", "and", "hum", "v"].includes(w) && !/^\d+$/.test(w)).join(" ");
}

/**
 * Look a token up in the 5e bestiary by name. Tries the whole cleaned name, then drops
 * trailing words ("Bugbear New MorningStar" → "Bugbear") until something matches.
 */
export function bestiaryMatch(name, bestiary) {
  if (!bestiary) return null;
  const ws = normName(name).split(" ").filter(Boolean);
  // 1) the whole name, or the name with trailing descriptors dropped ("Bugbear New Morningstar" → "bugbear"):
  //    trustworthy enough to take size and CR from.
  for (let n = ws.length; n >= 1; n--) {
    const k = ws.slice(0, n).join(" ");
    if (k.length >= 3 && bestiary[k]) return { key: k, full: true, ...bestiary[k] };
  }
  // 2) any other run of words ("Tiefling Female Druid" → "druid"): only the creature type is kept.
  for (let n = ws.length - 1; n >= 1; n--) {
    for (let start = 1; start + n <= ws.length; start++) {
      const k = ws.slice(start, start + n).join(" ");
      if (k.length >= 4 && bestiary[k]) return { key: k, full: false, t: bestiary[k].t };
    }
  }
  return null;
}

export function crBucket(cr) {
  if (cr == null) return null;
  let v = Number(cr);
  if (typeof cr === "string" && cr.includes("/")) { const [a, b] = cr.split("/").map(Number); v = a / b; }
  if (!isFinite(v)) return null;
  if (v < 1) return "CR 0–½";
  if (v <= 4) return "CR 1–4";
  if (v <= 10) return "CR 5–10";
  if (v <= 16) return "CR 11–16";
  return "CR 17 +";
}

export function classifyToken(path, root, bestiary) {
  const dec = decodeURIComponent(path);
  const moduleId = dec.split("/")[1];
  const below = root && dec.startsWith(decodeURIComponent(root) + "/") ? dec.slice(decodeURIComponent(root).length + 1) : dec.split("/").slice(2).join("/");
  const parts = below.split("/");
  const file = parts.pop();
  const name = displayName(file);
  const folderWords = words(parts.join(" "));
  const allWords = [...words(name), ...folderWords];
  const [spaced] = hay(allWords);
  const [nameSpaced] = hay(words(name));

  const b = bestiaryMatch(name, bestiary);
  let creature = null;
  if (b && b.t) {
    const t = String(b.t).toLowerCase();
    creature = TYPE_FROM_5E[t] || null;
  }
  if (!creature) for (const [c, re] of CREATURE_RULES) if (re.test(nameSpaced)) { creature = c; break; }
  if (!creature) for (const [c, re] of CREATURE_RULES) if (re.test(spaced)) { creature = c; break; }
  if (!creature) creature = "Unsorted";

  let role = null;
  for (const [r, re] of TOKEN_ROLE_RULES) if (re.test(spaced)) { role = r; break; }
  if (!role) role = creature === "Humanoid" ? "NPC" : "Enemy";

  // collection: the book (token collection), the game's own folder, or the letter-bucket parent
  let collection;
  const p0 = parts[0] || "";
  if (moduleId === "canvas3dtokencompendium") {
    if (p0 === "_Colorized") collection = prettyFolder(parts[1] || "Painted");
    else collection = prettyFolder(p0) + (parts[1] && p0 === "Adventurers" ? " › " + prettyFolder(parts[1]) : "");
  } else if (moduleId === "3d-animations") {
    collection = root.endsWith("adventurers") ? (p0 === "TurnSheet" ? "Turn-sheet adventurers" : "Adventurers")
      : root.endsWith("npcs") ? "NPCs" : (parts.length > 1 ? prettyFolder(parts[1]) : "Creatures");
  } else {
    collection = parts.length ? parts.map(prettyFolder).join(" › ").replace(/_/g, " ") : "Loose";
  }
  const painted = moduleId === "canvas3dtokencompendium" ? p0 === "_Colorized" : null;

  return {
    moduleId, name, creature, role, collection, painted,
    size5e: b?.full && b.s ? SIZE_CODES[b.s] || null : null,
    cr: b?.full ? crBucket(b.cr) : null,
    env: (b?.full && b.env) || [],
    matched: b?.key || null,
  };
}
