const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567'
const V3_LENGTH = 56
const V2_LENGTH = 16
const VERSION = 3
const RATE = 136
const CHECKSUM_PREFIX = new TextEncoder().encode('.onion checksum')

const rotl = (lane, n) => ((lane << BigInt(n)) | (lane >> BigInt(64 - n))) & 0xffffffffffffffffn

function keccakF(lanes) {
  let lfsr = 1
  for (let round = 0; round < 24; round += 1) {
    const column = [0, 1, 2, 3, 4].map((x) => lanes[x] ^ lanes[x + 5] ^ lanes[x + 10] ^ lanes[x + 15] ^ lanes[x + 20])
    for (let x = 0; x < 5; x += 1) {
      const d = column[(x + 4) % 5] ^ rotl(column[(x + 1) % 5], 1)
      for (let y = 0; y < 25; y += 5) lanes[x + y] ^= d
    }

    let x = 1
    let y = 0
    let carried = lanes[1]
    for (let t = 0; t < 24; t += 1) {
      ;[x, y] = [y, (2 * x + 3 * y) % 5]
      const next = lanes[x + 5 * y]
      lanes[x + 5 * y] = rotl(carried, (((t + 1) * (t + 2)) / 2) % 64)
      carried = next
    }

    for (let row = 0; row < 25; row += 5) {
      const lane = lanes.slice(row, row + 5)
      for (let i = 0; i < 5; i += 1) lanes[row + i] = lane[i] ^ (~lane[(i + 1) % 5] & lane[(i + 2) % 5])
    }

    for (let j = 0; j < 7; j += 1) {
      lfsr = ((lfsr << 1) ^ ((lfsr >> 7) * 0x71)) % 256
      if (lfsr & 2) lanes[0] ^= 1n << BigInt((1 << j) - 1)
    }
  }
}

export function sha3(bytes) {
  const lanes = new Array(25).fill(0n)
  const absorb = (at, byte) => {
    lanes[at >> 3] ^= BigInt(byte) << BigInt((at & 7) * 8)
  }
  let at = 0
  for (const byte of bytes) {
    absorb(at, byte)
    at += 1
    if (at === RATE) {
      keccakF(lanes)
      at = 0
    }
  }
  absorb(at, 0x06)
  absorb(RATE - 1, 0x80)
  keccakF(lanes)
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i += 1) out[i] = Number((lanes[i >> 3] >> BigInt((i & 7) * 8)) & 0xffn)
  return out
}

function base32(text) {
  const out = new Uint8Array(Math.floor((text.length * 5) / 8))
  let value = 0
  let bits = 0
  let i = 0
  for (const char of text) {
    value = ((value << 5) | BASE32.indexOf(char)) & 0xfff
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out[i] = (value >> bits) & 0xff
      i += 1
    }
  }
  return out
}

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

export const normalizeOnion = (input) =>
  String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/\.onion$/, '')
    .split('.')
    .at(-1)

export const onionParts = (address) => [
  { kind: 'key', text: address.slice(0, 52) },
  { kind: 'checksum', text: address.slice(52, 55) },
  { kind: 'version', text: address.slice(55) },
]

export function checkOnion(input) {
  const address = normalizeOnion(input)
  if (!address) return { status: 'empty', address }
  if (/[^a-z2-7]/.test(address)) return { status: 'charset', address }
  if (address.length === V2_LENGTH) return { status: 'v2', address }
  if (address.length !== V3_LENGTH) return { status: 'length', address, length: address.length }

  const bytes = base32(address)
  const key = bytes.slice(0, 32)
  const version = bytes[34]
  if (version !== VERSION) return { status: 'version', address, version }

  const expected = sha3([...CHECKSUM_PREFIX, ...key, VERSION]).slice(0, 2)
  const found = bytes.slice(32, 34)
  const result = { address, key: hex(key), checksum: hex(found), expected: hex(expected) }
  return { ...result, status: result.checksum === result.expected ? 'valid' : 'checksum' }
}

export function typo(address, random = Math.random) {
  const at = Math.floor(random() * 52)
  const swaps = BASE32.replace(address[at], '')
  return address.slice(0, at) + swaps[Math.floor(random() * swaps.length)] + address.slice(at + 1)
}
