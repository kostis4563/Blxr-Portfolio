export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 72

const COMMON = new Set([
  'passwordpassword', 'passwordpass', 'passwordone', 'password', 'iloveyou', 'letmein', 'qwertyuiop', 'qwertyuiopasdfghjkl',
  'qwertyuiopasdfghjklzxcvbnm', 'asdfghjklqwertyuiop', 'abcdefghijkl', 'abcdefghijklmnop', 'abcdefghijklmnopqrstuvwxyz',
  'zxcvbnmasdfghjkl', 'qazwsxedcrfv', 'qazwsxedcrfvtgb', 'qwertyqwerty', 'qwertyasdfgh', 'administrator', 'adminadmin',
  'welcomewelcome', 'welcometothejungle', 'changemechangeme', 'thisismypassword', 'mypasswordis', 'ihatepasswords',
  'trustnoone', 'superman', 'batmanbatman', 'spiderman', 'starwars', 'harrypotter', 'gameofthrones', 'basketball',
  'football', 'liverpool', 'manchester', 'barcelona', 'realmadrid', 'metallica', 'computer', 'internet', 'whatever',
  'sunshine', 'princess', 'blessed', 'monkeymonkey', 'dragondragon', 'masterkey', 'godisgood', 'jesuschrist', 'jesusislord',
  'loveyouforever', 'ilovemyself', 'iloveyoubaby', 'iloveyoutoo', 'iloveyouforever', 'happybirthday', 'summertime',
  'passw0rdpassw0rd', 'pa55w0rdpa55w0rd', 'letmeinplease', 'openthedoor', 'hellohello', 'goodmorning', 'goodbyegoodbye',
  'secretsecret', 'topsecret', 'mysecret', 'secretpassword', 'newpassword', 'oldpassword', 'temppassword', 'defaultpassword',
  'rootroot', 'toortoor', 'guestguest', 'testtest', 'testpassword', 'userpassword', 'adminpassword', 'loginpassword',
])

const CANON = (s) => s.toLowerCase().replace(/[^a-z]/g, '')

function longestRun(s) {
  let best = 1
  let run = 1
  for (let i = 1; i < s.length; i++) {
    run = s[i] === s[i - 1] ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

function isSequence(s) {
  if (s.length < 6) return false
  const step = s.charCodeAt(1) - s.charCodeAt(0)
  if (Math.abs(step) !== 1) return false
  for (let i = 2; i < s.length; i++) if (s.charCodeAt(i) - s.charCodeAt(i - 1) !== step) return false
  return true
}

export function passwordProblem(password, { email = '', name = '' } = {}) {
  const p = String(password || '')
  if (p.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (new TextEncoder().encode(p).length > PASSWORD_MAX) return `Keep it under ${PASSWORD_MAX} characters.`
  if (new Set(p).size < 4 || longestRun(p) >= 5) return 'Too repetitive — use more different characters.'
  if (isSequence(p.toLowerCase())) return 'Sequences like abcdef or 123456 are the first thing tried.'
  const canon = CANON(p)
  if (COMMON.has(canon) || (canon.length >= 8 && COMMON.has(canon.replace(/(.+)\1$/, '$1')))) {
    return 'That password is on every breach list. Pick something less guessable.'
  }
  for (const own of [email.split('@')[0], name]) {
    const part = CANON(String(own || ''))
    if (part.length >= 4 && canon.includes(part)) return 'Do not use your name or email address in the password.'
  }
  return null
}

export function strengthOf(password) {
  if (!password) return 0
  let score = password.length >= PASSWORD_MIN ? 1 : 0
  if (password.length >= 16) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1
  return Math.min(score, 4)
}
