import { describe, test, expect } from 'vitest'
import { sudoCommand } from '../../src/lib/commands.js'
import { SITE_NAME } from '../../src/lib/seo.js'

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
