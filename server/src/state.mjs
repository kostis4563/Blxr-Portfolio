import fs from 'node:fs'
import path from 'node:path'

export function readState(file) {
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
  try {
    return JSON.parse(raw)
  } catch {
    const kept = `${file}.corrupt-${Date.now()}`
    try {
      fs.renameSync(file, kept)
      console.warn(`state: ${path.basename(file)} was unreadable, kept as ${path.basename(kept)}`)
    } catch {
    }
    return undefined
  }
}

export function writeState(file, data, mode = 0o600) {
  const tmp = `${file}.${process.pid}.tmp`
  let fd
  try {
    fd = fs.openSync(tmp, 'w', mode)
    fs.writeSync(fd, JSON.stringify(data))
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fd = undefined
    fs.renameSync(tmp, file)
    return true
  } catch {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd)
      } catch {
      }
    }
    try {
      fs.unlinkSync(tmp)
    } catch {
    }
    return false
  }
}
