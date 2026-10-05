import { describe, test, expect } from 'vitest'
import { sudoCommand, buildCommands, recentCommands, inScope, rankCommands, SCOPES } from '../../src/lib/commands.js'
import { SITE_NAME } from '../../src/lib/seo.js'
import { PROJECTS_PATH, projectPath } from '../../src/lib/router.js'
import { projectsList } from '../../src/lib/projects.js'

const commands = buildCommands({ theme: 'dark', toggleTheme: () => {} })

describe('buildCommands', () => {
  test('every command lands in a filter scope', () => {
    const ids = SCOPES.map((s) => s.id).filter((id) => id !== 'all')
    for (const command of commands) expect(ids).toContain(command.scope)
  })

  test('verbs follow what the row does', () => {
    const byId = (id) => commands.find((c) => c.id === id)
    expect(byId('page-home').verb).toBe('Open')
    expect(byId('link-email').verb).toBe('Visit')
    expect(byId('action-copy-email').verb).toBe('Copy')
    expect(byId('action-theme').verb).toBe('Run')
  })

  test('layout grid only exists when the page has one', () => {
    expect(commands.some((c) => c.id === 'action-grid')).toBe(false)
    const withGrid = buildCommands({ theme: 'dark', toggleTheme: () => {}, toggleGrid: () => {} })
    expect(withGrid.find((c) => c.id === 'action-grid').shortcut).toEqual(['⇧', 'G'])
  })
})

describe('comment commands', () => {
  const at = '2026-10-05T12:00:00Z'
  const saved = [
    { id: 'a', path: '/', text: 'hero spacing\nsecond line', at, x: 0.5, y: 100, resolved: true },
    { id: 'b', path: '/cv', text: 'typo in dates', at, x: 0.5, y: 100, resolved: false },
  ]

  test('only "add" shows when there are none', () => {
    const ids = commands.filter((c) => c.scope === 'comments').map((c) => c.id)
    expect(ids).toEqual(['comment-add'])
  })

  test('lists every comment, newest first, with its page', () => {
    const withComments = buildCommands({ theme: 'dark', toggleTheme: () => {}, comments: saved, path: '/' })
    const listed = withComments.filter((c) => c.group === 'Your comments')
    expect(listed.map((c) => c.label)).toEqual(['typo in dates', 'hero spacing'])
    expect(listed[0].hint).toMatch(/^CV · /)
    expect(listed[1].hint).toMatch(/resolved$/)
    expect(rankCommands(withComments, 'typo')[0].id).toBe('comment-b')
  })

  test('page actions follow what is on the current page', () => {
    const onHome = buildCommands({ theme: 'dark', toggleTheme: () => {}, comments: saved, path: '/' }).map((c) => c.id)
    expect(onHome).toEqual(expect.arrayContaining(['comment-toggle', 'comment-copy', 'comment-clear', 'comment-clear-resolved']))
    const onCv = buildCommands({ theme: 'dark', toggleTheme: () => {}, comments: saved, path: '/cv' }).map((c) => c.id)
    expect(onCv).toContain('comment-clear')
    expect(onCv).not.toContain('comment-clear-resolved')
  })
})

describe('inScope', () => {
  test('all keeps everything, a scope keeps its own', () => {
    const projects = rankCommands(commands, '').filter((c) => inScope(c, 'projects'))
    expect(projects.length).toBe(projectsList.length)
    expect(commands.every((c) => inScope(c, 'all'))).toBe(true)
  })
})

describe('recentCommands', () => {
  const first = projectsList[0]

  test('maps visited paths to commands, newest first, skipping the current page', () => {
    const recent = recentCommands(commands, ['/', projectPath(first.id), PROJECTS_PATH], { exclude: '/' })
    expect(recent.map((c) => c.label)).toEqual([first.title, 'Projects Archive'])
    expect(recent.every((c) => c.group === 'Recent' && c.id.startsWith('recent-'))).toBe(true)
  })

  test('drops unknown paths and respects the limit', () => {
    expect(recentCommands(commands, ['/nope', '/missing'])).toEqual([])
    expect(recentCommands(commands, ['/', PROJECTS_PATH, projectPath(first.id)], { limit: 2 })).toHaveLength(2)
  })
})

describe('sudoCommand', () => {
  test('bare sudo suggests the default line', () => {
    expect(sudoCommand('sudo').label).toBe(`sudo hire ${SITE_NAME}`)
    expect(sudoCommand('  SUDO  ').label).toBe(`sudo hire ${SITE_NAME}`)
  })

  test('echoes what was typed, whitespace collapsed', () => {
    expect(sudoCommand('sudo  rm   -rf /').label).toBe('sudo rm -rf /')
  })

  test('only fires on sudo as its own word', () => {
    expect(sudoCommand('')).toBeNull()
    expect(sudoCommand('sudoku')).toBeNull()
    expect(sudoCommand('run sudo')).toBeNull()
  })
})
