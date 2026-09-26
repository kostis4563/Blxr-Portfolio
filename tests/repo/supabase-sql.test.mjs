import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../deploy/supabase')
const files = Object.fromEntries(
  await Promise.all((await readdir(DIR)).filter((f) => f.endsWith('.sql')).map(async (f) => [f, await readFile(path.join(DIR, f), 'utf8')])),
)
const all = Object.entries(files)

const functionsIn = (sql) =>
  [...sql.matchAll(/create or replace function (public\.\w+)\(([\s\S]*?)\$\$;/gi)].map((m) => ({
    name: m[1],
    text: m[0],
    header: m[0].slice(0, m[0].indexOf('$$')),
  }))

describe('tables', () => {
  for (const [file, sql] of all) {
    for (const [, table] of sql.matchAll(/create table if not exists (public\.\w+)/gi)) {
      test(`${file}: ${table} has RLS enabled and at least one policy per command it allows`, () => {
        assert.match(sql, new RegExp(`alter table ${table.replace('.', '\\.')} enable row level security;`, 'i'))
        const policies = [...sql.matchAll(new RegExp(`create policy "[^"]+" on ${table.replace('.', '\\.')}\\s+for (\\w+)`, 'gi'))].map((m) => m[1].toLowerCase())
        assert.ok(policies.length > 0, 'RLS without policies locks everyone out')
        assert.ok(policies.includes('select') || policies.includes('all'), 'nothing can be read')
      })
    }
  }
})

describe('functions', () => {
  for (const [file, sql] of all) {
    for (const fn of functionsIn(sql)) {
      if (!/security definer/i.test(fn.header)) continue
      test(`${file}: SECURITY DEFINER ${fn.name} pins search_path`, () => {
        assert.match(fn.header, /set search_path\s*=\s*[\w, ]+/i, 'a mutable search_path lets a caller shadow tables/functions the definer uses')
      })
    }
  }

  test('helpers defined in several files are identical (the last file run wins silently)', () => {
    const byName = new Map()
    for (const [file, sql] of all) for (const fn of functionsIn(sql)) byName.set(fn.name, [...(byName.get(fn.name) || []), { file, text: fn.text.replace(/\s+/g, ' ') }])
    const drift = [...byName].filter(([, defs]) => defs.length > 1 && new Set(defs.map((d) => d.text)).size > 1)
    assert.deepEqual(drift.map(([name, defs]) => `${name} differs across ${defs.map((d) => d.file).join(', ')}`), [])
  })

  test('privileged helpers are not executable by anon', () => {
    for (const [file, sql] of all) {
      for (const fn of functionsIn(sql)) {
        if (!/security definer/i.test(fn.header)) continue
        const sig = fn.name.replace('.', '\\.')
        const revoked = new RegExp(`revoke all on function ${sig}\\([^)]*\\) from (public|anon)`, 'i').test(sql)
        const trigger = /returns trigger/i.test(fn.header)
        assert.ok(revoked || trigger, `${file}: ${fn.name} is SECURITY DEFINER but never revoked from public`)
      }
    }
  })
})

describe('views', () => {
  for (const [file, sql] of all) {
    for (const m of sql.matchAll(/create (?:or replace )?view (public\.\w+)\s*([\s\S]*?)\bas\b/gi)) {
      test(`${file}: view ${m[1]} runs with the caller's rights (security_invoker)`, () => {
        assert.match(m[2], /security_invoker\s*=\s*(on|true)/i)
      })
    }
  }
})

describe('storage', () => {
  test('storage.objects policies are scoped to a bucket', () => {
    for (const [file, sql] of all) {
      for (const m of sql.matchAll(/create policy "([^"]+)" on storage\.objects([\s\S]*?);/gi)) {
        assert.match(m[2], /bucket_id\s*=\s*'[^']+'/, `${file}: "${m[1]}" applies to every bucket`)
      }
    }
  })
})
