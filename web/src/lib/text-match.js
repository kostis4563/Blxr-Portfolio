export function foldWithMap(s) {
  let out = ''
  const map = []
  for (let i = 0; i < s.length; i++) {
    const folded = s[i].normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    for (let k = 0; k < folded.length; k++) {
      out += folded[k]
      map.push(i)
    }
  }
  return { out, map }
}

export const fold = (s) => foldWithMap(s).out

export function matchRange(text, q) {
  const { out, map } = foldWithMap(text)
  const i = out.indexOf(q)
  if (i === -1) return null
  return [map[i], map[i + q.length - 1] + 1]
}
