export const libraryList = [
  {
    id: 'supreme-restock',
    title: 'Supreme Restock',
    date: '2026',
    category: 'Interfaces',
    accent: '#ef3b2d',
    url: null,
    github: null,
    image: '/library/supreme-restock-items.webp',
    gallery: [
      '/library/supreme-restock-items.webp',
      '/library/supreme-restock.webp',
      '/library/supreme-restock-compact.webp'
    ],
    logo: null,
    shortDescription:
      'A dark restock interface that separates criminal and personal supplies, then makes item quantities, stock levels and loadout changes immediately readable.',
    fullDescription:
      'A focused restock interface for Supreme. The opening screen separates criminal and personal inventory into two unmistakable paths before showing any controls. Inside personal restock, every item presents its artwork, current stock or quantity, a small amount stepper and a direct stock or unstock action. A loadout selector keeps different setups within the same view, while bulk actions let a player restock their current setup or clear everything without working through each item individually. Red and green states make the direction of every inventory change clear at a glance.',
    metrics: [
      { label: 'Type', value: 'NUI' },
      { label: 'Stack', value: 'HTML/CSS/JS' },
      { label: 'Flows', value: '2' }
    ],
    features: [
      'Separate criminal and personal restock paths from one compact opening screen',
      'Current-loadout selector for switching between saved equipment setups',
      'Per-item artwork, available stock and adjustable transfer quantity',
      'Direct stock and unstock actions with clear green and red states',
      'Bulk controls to unstock everything or restock the active loadout',
      'Responsive item presentation that remains readable in card and compact row layouts'
    ],
    tags: ['FiveM', 'NUI', 'HTML', 'CSS', 'JavaScript']
  },
  {
    id: 'autopilot',
    title: 'Autopilot',
    date: '2026',
    category: 'Systems',
    accent: '#3b82f6',
    url: null,
    github: null,
    image: '/library/autopilot.webp',
    gallery: ['/library/autopilot.webp', '/library/autopilot-admin.webp'],
    logo: null,
    shortDescription:
      'A Lua-powered driving system with waypoint, cruise, follow and parking modes, plus a live admin room for monitoring and controlling every active driver.',
    fullDescription:
      'A complete autopilot system for FiveM, pairing a focused player interface with a server-wide admin control room. Players can drive to a map waypoint, choose a known place or coordinates, cruise freely, follow another vehicle, or ask the car to park. Three driving levels cover everyday, fast and extreme use, while the custom controls expose speed, acceleration, aggression, following distance, overtaking, routing and safety behaviour. The admin side shows every active driver, vehicle, mode, destination, speed and remaining journey in one live table, with controls for rules, history, player access and emergency stops.',
    metrics: [
      { label: 'Type', value: 'Lua' },
      { label: 'Stack', value: 'Lua + NUI' },
      { label: 'Modes', value: '6' }
    ],
    features: [
      'Six destinations and modes — waypoint, known places, coordinates, cruise, follow and park',
      'Basic, fast and extreme driving presets with a fully adjustable custom profile',
      'Controls for speed, acceleration, aggression, follow distance, overtaking and route behaviour',
      'Compact driving HUD with destination, distance, journey time and vehicle condition',
      'Live admin table for players, vehicles, modes, destinations, speed and time remaining',
      'Server-wide admin controls for access, rules, history, speed caps and emergency stops'
    ],
    tags: ['Lua', 'FiveM', 'NUI', 'HTML', 'CSS', 'JavaScript']
  },
  {
    id: 'battlepass',
    title: 'Battlepass',
    date: '2026',
    category: 'Interfaces',
    accent: '#ef4444',
    url: null,
    github: null,
    image: '/library/battlepass.webp',
    logo: null,
    shortDescription:
      'A seasonal reward track: one level ring, a countdown to the next level, and a row of reward tiles that each know whether they are claimed, claimable, in progress or still locked.',
    fullDescription:
      'A battlepass interface for a roleplay server. The left panel is the player\'s standing — current level in a ring that fills with progress, the exact XP figure against the level\'s target, the time left before the next level ticks over, and a buy-level action for players who would rather not wait. The right side is the reward track itself: a numbered, paged row of tiles, each with the item it grants and a line explaining how it is earned. Every tile carries its own state rather than a single global progress bar, so a player reads the whole season at a glance — what they already took, what is waiting to be collected, what they are working on now, and what is still ahead. Tiles tied to a challenge rather than a level are flagged as accomplishments so the two kinds of reward are never confused.',
    metrics: [
      { label: 'Type', value: 'NUI' },
      { label: 'Stack', value: 'HTML/CSS/JS' },
      { label: 'States', value: '4' }
    ],
    features: [
      'Level ring with XP against the next level\'s target and a live countdown to level-up',
      'Buy-level action for skipping the wait',
      'Paged reward track with arrows either side, so a long season stays on one screen',
      'Four tile states — received, claimable, in progress and locked — each styled distinctly',
      'Accomplishment tiles marked apart from level rewards, for prizes earned by challenge',
      'Reward tiles carry the item art, its name and how it is earned in one card'
    ],
    tags: ['Lua', 'NUI', 'HTML', 'CSS', 'JavaScript']
  },
  {
    id: 'events-board',
    title: 'Events Board',
    date: '2026',
    category: 'Interfaces',
    accent: '#fb7185',
    url: null,
    github: null,
    image: '/library/events-board.webp',
    logo: null,
    shortDescription:
      'A live operation schedule: three event tracks, the times each one runs, what it pays out, and the briefing — one event per page, with a carousel through the rest.',
    fullDescription:
      'An in-game events board that answers the two questions a player actually has: what is running, and when. Events are split across three tracks — criminal, cartel and gang — each its own tab across the top. The page below shows one event at a time: cover art with a live badge when it is running now, the fixed times it starts through the day, the loot it pays and the quantity range for each, and a short briefing describing the job in plain language. A dot row and arrows page through the rest of the track, so a server can run a dozen events without the board turning into a list to scroll.',
    metrics: [
      { label: 'Type', value: 'NUI' },
      { label: 'Stack', value: 'HTML/CSS/JS' },
      { label: 'Tracks', value: '3' }
    ],
    features: [
      'Three event tracks — criminal, cartel and gang — as top-level tabs',
      'Live badge on the cover while an event is actually running',
      'Fixed start times shown as chips, so the schedule is readable without a clock',
      'Reward tiles with item art and the quantity range each one pays',
      'A written briefing per event, phrased for players rather than for scripters',
      'Carousel with a dot row, so the board holds a full season of events at one screen height'
    ],
    tags: ['Lua', 'NUI', 'HTML', 'CSS', 'JavaScript']
  },
  {
    id: 'ox-inventory-xray',
    title: 'Ox Inventory — X-Ray',
    date: '2026',
    category: 'Interfaces',
    accent: '#10b981',
    url: null,
    github: null,
    image: '/library/ox-inventory-xray.webp',
    logo: null,
    shortDescription:
      'A rebuilt ox_inventory front end that puts a body-damage x-ray and the player\'s identity documents either side of the grids, so one screen covers carrying, health and ID.',
    fullDescription:
      'A replacement interface for ox_inventory, built in its React UI rather than bolted on beside it. The stock two-grid layout stays where players expect it — own inventory on the left, whatever is open on the right, backpack below, search over the top — and the space around it is put to work. The left column is an x-ray of the character with a labelled bar per limb, so injuries are read at a glance instead of through a separate medical menu. Underneath it sits the player\'s identity: name, phone number, state ID and citizen ID. Every slot keeps ox_inventory\'s own affordances — slot number, stack count, durability bar and weight against the container\'s limit — so nothing about how the inventory behaves changes, only how much it tells you.',
    metrics: [
      { label: 'Type', value: 'NUI' },
      { label: 'Stack', value: 'React' },
      { label: 'Base', value: 'ox_inventory' }
    ],
    features: [
      'Per-limb damage x-ray — head, arms, body and legs, each with its own bar',
      'Identity card under the body: name, phone number, state ID and citizen ID',
      'Player, secondary container and backpack grids on one screen, no tab switching',
      'Weight shown per container against its limit, so a full bag is obvious before a transfer fails',
      'Durability bars and stack counts kept on every slot, straight from ox_inventory',
      'Search field over the grid, and an amount field for splitting a stack on transfer'
    ],
    tags: ['React', 'TypeScript', 'ox_inventory', 'NUI', 'CSS']
  },
  {
    id: 'ox-inventory-supreme',
    title: 'Ox Inventory — Supreme',
    date: '2026',
    category: 'Interfaces',
    accent: '#a855f7',
    url: null,
    github: null,
    image: '/library/ox-inventory-supreme.webp',
    logo: null,
    shortDescription:
      'A second ox_inventory skin, red on glass, with the server\'s menus — events, battlepass, restock, fights, leaderboards, Discord — docked as a bar above the grids.',
    fullDescription:
      'The same ox_inventory front end taken in a different direction: a red-on-dark skin whose grid cells are drawn as corner brackets rather than filled boxes, so the game shows through the inventory instead of being covered by it. The change that matters is the bar above it. Rather than making a player close the inventory and press a separate key for each system, the server\'s menus are docked across the top — events, battlepass, restock, start fight, leaderboards and the Discord link — each with its own colour so they are picked out by shape and hue rather than by reading. Both containers below are headed with their owner and a live weight against the limit.',
    metrics: [
      { label: 'Type', value: 'NUI' },
      { label: 'Stack', value: 'React' },
      { label: 'Base', value: 'ox_inventory' }
    ],
    features: [
      'Server menu bar docked over the inventory — six entries, each colour-coded',
      'Bracket-cornered slots on glass, so the world stays visible behind the UI',
      'Both containers headed with owner and live weight against the limit',
      'Item art, stack count and durability kept per slot',
      'Drag and drop between the two grids, unchanged from ox_inventory',
      'Shares its data layer with the x-ray skin — the two are themes over one build'
    ],
    tags: ['React', 'TypeScript', 'ox_inventory', 'NUI', 'CSS']
  },
  {
    id: 'vehicle-interaction-menu',
    title: 'Vehicle Interaction Menu',
    date: '2026',
    category: 'Interfaces',
    accent: '#f97316',
    url: null,
    github: null,
    image: '/library/vehicle-interaction-menu.webp',
    logo: null,
    shortDescription:
      'The menu that opens when a player aims at a car: five labelled actions off the crosshair, each with its own icon, the destructive one marked apart.',
    fullDescription:
      'A targeting menu for vehicles, opened by holding ALT. Aiming at a car draws a dashed leader from the crosshair to a short column of actions — open the door, check the engine, refuel, repair, and lock or unlock — each on its own row with an icon that identifies it before the label is read. Lock/unlock is tinted apart from the rest, because it is the one entry on the list whose effect a player is likely to regret. The list is short on purpose: everything on it is an action, not a submenu, so any interaction with a vehicle is at most two inputs away.',
    metrics: [
      { label: 'Type', value: 'NUI' },
      { label: 'Stack', value: 'HTML/CSS/JS' },
      { label: 'Actions', value: '5' }
    ],
    features: [
      'Five vehicle actions — open door, check engine, refuel, repair, lock/unlock',
      'Dashed leader line from the crosshair to the list, so the target is never ambiguous',
      'One icon per row, so entries are told apart before the label is read',
      'Lock/unlock tinted apart from the rest as the entry with lasting effect',
      'Flat list rather than nested menus — every action is one input from the crosshair'
    ],
    tags: ['Lua', 'NUI', 'HTML', 'CSS', 'JavaScript']
  },
  {
    id: 'direct-roleplay-inventory',
    title: 'Direct Roleplay — Inventory & Shop',
    date: '2026',
    category: 'Interfaces',
    accent: '#0ea5e9',
    url: null,
    github: null,
    image: '/library/direct-roleplay-inventory.webp',
    logo: null,
    shortDescription:
      'Inventory, shop and the whole server menu on one transparent screen — buy from a priced grid, trade with the player in front of you, and tune how see-through the UI is while it is open.',
    fullDescription:
      'An inventory that doubles as the server\'s front door. The carrying grid and its weight sit on the left, a priced shop grid on the right with the player\'s spending money above it, and a hotbar of numbered slots along the bottom. Down the left edge is every menu the server has — Discord, battlepass, achievements, personal and mafia restock, leaderboards, 1v1 and team fight, commands, and a donate panel — so none of them needs a key of its own. Between the two grids sit the trade actions: give an item, use it, or hand over money, with an amount field shared between them. The whole interface is drawn transparent over the world rather than on a panel, and a settings flyout on the right lets each player set the background transparency and item-tile opacity to taste, which is the part that makes a full-screen inventory bearable to leave open.',
    metrics: [
      { label: 'Type', value: 'NUI' },
      { label: 'Actions', value: '10' },
      { label: 'Slots', value: '8' }
    ],
    features: [
      'Inventory and priced shop side by side, with carried weight and spending money on show',
      'Ten server menus docked down the left edge, so none of them needs its own keybind',
      'Give item, use and give money as one action row with a shared amount field',
      'Eight-slot numbered hotbar along the bottom',
      'Per-player UI settings — background transparency and item-tile opacity — applied live',
      'Drawn transparent over the world rather than on a panel, so the game stays readable underneath'
    ],
    tags: ['Lua', 'NUI', 'HTML', 'CSS', 'JavaScript']
  }
]

export const LIBRARY_CATEGORIES = [...new Set(libraryList.map((entry) => entry.category).filter(Boolean))]

export const hasPlaceholders = libraryList.some((entry) => entry.placeholder)

export const LIB_METRIC_KEY = {
  Framework: 'lib.metric.framework',
  Type: 'lib.metric.type',
  Status: 'lib.metric.status',
  Stack: 'lib.metric.stack',
  Base: 'lib.metric.base',
  States: 'lib.metric.states',
  Tracks: 'lib.metric.tracks',
  Actions: 'lib.metric.actions',
  Slots: 'lib.metric.slots'
}

export const LIB_VALUE_KEY = {
  Placeholder: 'lib.value.placeholder',
  Standalone: 'lib.value.standalone',
  Server: 'lib.value.server'
}

export const findLibraryItem = (id) => libraryList.find((entry) => entry.id === id) ?? null
