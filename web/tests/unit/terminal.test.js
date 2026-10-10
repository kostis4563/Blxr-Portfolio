import { describe, test, expect, vi } from 'vitest'
import {
  execute,
  complete,
  tokenize,
  splitChain,
  expandHistory,
  calculate,
  findPage,
  COMMANDS,
  PAGES,
} from '../../src/lib/terminal.js'
import { projectsList } from '../../src/lib/projects.js'
import { projectPath, PROJECTS_PATH, HOME_PATH, TERMINAL_PATH, staticPaths } from '../../src/lib/router.js'

const textOf = (lines) =>
  lines
    .map((line) => (Array.isArray(line) ? line : line.parts))
    .map((parts) => parts.map((part) => (typeof part === 'string' ? part : part.text)).join(''))
    .join('\n')

const partsOf = (lines) => lines.flatMap((line) => (Array.isArray(line) ? line : line.parts))

const output = async (input, ctx = {}) => textOf(await execute(input, ctx))

describe('parsing', () => {
  test('tokenize keeps quoted words together', () => {
    expect(tokenize(`echo "hello world"  'a b' c`)).toEqual(['echo', 'hello world', 'a b', 'c'])
    expect(tokenize('   ')).toEqual([])
    expect(tokenize('echo ""')).toEqual(['echo', ''])
  })

  test('splitChain splits on ; and && outside quotes', () => {
    expect(splitChain('about; skills && pwd')).toEqual(['about', 'skills', 'pwd'])
    expect(splitChain('echo "a; b"')).toEqual(['echo "a; b"'])
  })

  test('expandHistory resolves !! and !n, and reports a missing event', () => {
    const history = ['about', 'projects', 'skills']
    expect(expandHistory('!!', history)).toBe('skills')
    expect(expandHistory('!1', history)).toBe('about')
    expect(expandHistory('!-2', history)).toBe('projects')
    expect(expandHistory('!9', history)).toBeNull()
    expect(expandHistory(':q!', history)).toBe(':q!')
  })

  test('calculate follows precedence and refuses anything that is not arithmetic', () => {
    expect(calculate('2+3*4')).toBe(14)
    expect(calculate('(2+3)^2 / 5')).toBe(5)
    expect(calculate('-2^2')).toBe(-4)
    expect(calculate('2^3^2')).toBe(512)
    expect(calculate('0.1+0.2')).toBe(0.3)
    expect(calculate('10 % 4')).toBe(2)
    expect(() => calculate('1/0')).toThrow()
    expect(() => calculate('alert(1)')).toThrow()
    expect(() => calculate('2+')).toThrow()
  })
})

describe('commands', () => {
  test('every visible command has a group and a summary, and runs without throwing', async () => {
    for (const [name, command] of Object.entries(COMMANDS)) {
      if (!command.hidden) {
        expect(command.group, name).toBeTruthy()
        expect(command.summary, name).toBeTruthy()
      }
      await expect(execute(name, { now: () => new Date('2026-10-10T12:00:00Z') })).resolves.toBeInstanceOf(Array)
    }
  })

  test('help lists the main commands', async () => {
    const text = await output('help')
    for (const name of ['about', 'projects', 'contact', 'skills', 'cd', 'neofetch']) expect(text).toContain(name)
    expect(text).not.toContain('hesoyam')
  })

  test('help <command> explains usage and aliases', async () => {
    const text = await output('help project')
    expect(text).toContain('usage: project <id>')
    expect(await output('man ls')).toContain('usage: ls')
  })

  test('projects lists every project and project <id> shows its details', async () => {
    const list = await output('projects')
    for (const project of projectsList) expect(list).toContain(project.id)
    const first = projectsList[0]
    const detail = await execute(`project ${first.id}`)
    expect(textOf(detail)).toContain(first.title)
    expect(partsOf(detail).some((part) => part.to === projectPath(first.id))).toBe(true)
  })

  test('unknown commands suggest the closest real one', async () => {
    const text = await output('projcts')
    expect(text).toContain('command not found: projcts')
    expect(text).toContain('did you mean projects?')
  })

  test('bare arithmetic is evaluated', async () => {
    expect(await output('2+2')).toContain('= 4')
  })

  test('echo expands variables', async () => {
    expect(await output('echo hi $USER')).toBe('hi visitor')
  })

  test('chained commands print in order', async () => {
    expect(await output('echo one; echo two && echo three')).toBe('one\ntwo\nthree')
  })

  test('cd navigates to a page and rejects unknown ones', async () => {
    const navigate = vi.fn()
    await execute('cd projects', { navigate })
    expect(navigate).toHaveBeenCalledWith(PROJECTS_PATH)
    await execute('cd ..', { navigate })
    expect(navigate).toHaveBeenLastCalledWith(HOME_PATH)
    expect(await output('cd projets', { navigate })).toContain('did you mean projects?')
    expect(navigate).toHaveBeenCalledTimes(2)
  })

  test('open handles projects, pages and external links', async () => {
    const navigate = vi.fn()
    const openUrl = vi.fn()
    await execute(`open ${projectsList[0].id}`, { navigate, openUrl })
    expect(navigate).toHaveBeenCalledWith(projectPath(projectsList[0].id))
    await execute('open github', { navigate, openUrl })
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('github.com'))
  })

  test('cat reads virtual files and reports missing ones', async () => {
    expect(await output('cat about.txt')).toContain('Kostis')
    expect(await output(`cat projects/${projectsList[0].id}.md`)).toContain(projectsList[0].title)
    expect(await output('cat nope.txt')).toContain('No such file or directory')
    expect(await output('cat projects')).toContain('Is a directory')
  })

  test('ls / lists the site pages, ls lists the home folder', async () => {
    const pages = await output('ls /')
    for (const page of PAGES) expect(pages).toContain(`${page.name}/`)
    const home = await output('ls')
    expect(home).toContain('projects/')
    expect(home).not.toContain('.secrets')
    expect(await output('ls -a')).toContain('.secrets')
  })

  test('clear calls ctx.clear and prints nothing', async () => {
    const clear = vi.fn()
    expect(await execute('clear', { clear })).toEqual([])
    expect(clear).toHaveBeenCalled()
  })

  test('theme switches only when it changes something', async () => {
    const toggleTheme = vi.fn()
    expect(await output('theme dark', { theme: 'dark', toggleTheme })).toContain('already dark')
    expect(toggleTheme).not.toHaveBeenCalled()
    await execute('theme light', { theme: 'dark', toggleTheme })
    await execute('light', { theme: 'dark', toggleTheme })
    expect(toggleTheme).toHaveBeenCalledTimes(2)
  })

  test('sudo rm -rf / and its relatives trigger the effect, plain rm does not', async () => {
    const fx = vi.fn()
    await execute('sudo rm -rf /', { fx })
    expect(fx).toHaveBeenCalledWith('rmrf')
    fx.mockClear()
    expect(await output('rm -rf /', { fx })).toContain('--no-preserve-root')
    expect(fx).not.toHaveBeenCalled()
    await execute('rm -rf --no-preserve-root /', { fx })
    expect(fx).toHaveBeenCalledWith('rmrf')
    expect(await output('sudo ls')).toContain('not in the sudoers file')
  })

  test('async commands use the context and fail softly', async () => {
    const now = { playing: true, track: { title: 'Song', artists: [{ name: 'Artist' }], durationMs: 200000 }, progressMs: 1000, sampledAt: Date.now() }
    expect(await output('now', { spotifyNow: async () => now })).toContain('Song — Artist')
    expect(await output('now', { spotifyNow: async () => { throw new Error('offline') } })).toContain('could not reach Spotify')
    expect(await output('weather', { athensTemp: async () => 21.6 })).toContain('22°C')
    expect(await output('weather', { athensTemp: async () => null })).toContain('did not answer')
    expect(await output('ping', { ping: async () => 12.34 })).toContain('4 received, 0% packet loss')
    expect(await output('ping google.com', { ping: async () => 1 })).toContain('can only reach blxr.net')
  })

  test('copy reports success and failure', async () => {
    expect(await output('copy email', { copy: async () => true })).toContain('copied')
    expect(await output('copy email', { copy: async () => false })).toContain('clipboard said no')
  })

  test('neofetch stacks the logo on narrow screens', async () => {
    const wide = await execute('neofetch', { columns: 100 })
    const narrow = await execute('neofetch', { columns: 40 })
    expect(narrow.length).toBeGreaterThan(wide.length)
  })
})

describe('completion', () => {
  test('completes a unique command', () => {
    expect(complete('neof').value).toBe('neofetch ')
  })

  test('lists options for an ambiguous prefix', () => {
    const result = complete('c')
    expect(result.options).toEqual(expect.arrayContaining(['cd', 'cat', 'cal', 'clear', 'contact']))
  })

  test('completes arguments from the command', () => {
    const id = projectsList[0].id
    expect(complete(`project ${id.slice(0, id.length - 1)}`).value).toBe(`project ${id} `)
    expect(complete('cd proj').value).toBe('cd projects ')
    expect(complete('cat projects/').options.length).toBe(projectsList.length)
  })

  test('leaves input alone when nothing matches', () => {
    expect(complete('zzz')).toEqual({ value: 'zzz', options: [] })
  })
})

describe('routing', () => {
  test('/terminal is a static page and a known page in the shell', () => {
    expect(staticPaths()).toContain(TERMINAL_PATH)
    expect(findPage('terminal')?.to).toBe(TERMINAL_PATH)
    expect(findPage('~')?.to).toBe(HOME_PATH)
    expect(findPage('/projects/')?.to).toBe(PROJECTS_PATH)
  })
})
