// Countries shown white on /travel. Names must match the Natural Earth names in travel-map.js.
export const VISITED = [
  { name: 'Greece', home: true },
  { name: 'Italy', visits: 3 },
  { name: 'Germany', visits: 2 },
  { name: 'France', visits: 2 },
  { name: 'Spain', visits: 1 },
  { name: 'Austria', visits: 1 },
  { name: 'United Kingdom', visits: 1 },
  { name: 'Belgium', visits: 1 },
]

export const VISITED_NAMES = new Set(VISITED.map((country) => country.name))

export const describeVisit = ({ name, home, visits }) =>
  home ? `${name} (home)` : `${name} (${visits === 1 ? 'once' : `${visits} times`})`
