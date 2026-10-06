import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, access } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => readFile(path.join(ROOT, p), 'utf8')
const exists = (p) => access(path.join(ROOT, p)).then(() => true, () => false)
const deploySh = () => read('deploy/deploy.sh')
const built = await exists('web/csp-script-hashes.txt')

describe('server is deployable as a flat copy of server/src/*.mjs', () => {
  test('imports are node: built-ins or sibling .mjs files only — no npm packages, no subfolders', async () => {
    const files = (await readdir(path.join(ROOT, 'server/src'))).filter((f) => f.endsWith('.mjs'))
    assert.ok(files.includes('server.mjs'))
    const builtins = new Set(builtinModules)
    for (const file of files) {
      const src = await read(`server/src/${file}`)
      const specs = [...src.matchAll(/^\s*import\s[^'"]*?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm)].map((m) => m[1] || m[2])
      for (const spec of specs) {
        if (spec.startsWith('node:')) {
          assert.ok(builtins.has(spec.slice(5)), `${file}: unknown built-in ${spec}`)
          continue
        }
        assert.match(spec, /^\.\/[\w.-]+\.mjs$/, `${file} imports "${spec}", which will not exist on the box`)
        assert.ok(files.includes(spec.slice(2)), `${file} imports missing ${spec}`)
      }
    }
  })

  test('server/package.json declares no runtime dependencies', async () => {
    const pkg = JSON.parse(await read('server/package.json'))
    assert.deepEqual(pkg.dependencies ?? {}, {})
    assert.equal(pkg.main, 'src/server.mjs')
  })

  test('the systemd unit runs what deploy.sh installs, under the hardening it relies on', async () => {
    const unit = await read('server/deploy/blxr-search.service')
    const sh = await deploySh()
    const serverRoot = /^SERVER_ROOT=(.+)$/m.exec(sh)[1]
    assert.match(unit, new RegExp(`^ExecStart=/usr/bin/node ${serverRoot}/server\\.mjs$`, 'm'))
    assert.match(unit, /^EnvironmentFile=\/etc\/blxr-search\.env$/m)
    assert.match(sh, /^SERVER_ENV=\/etc\/blxr-search\.env$/m)
    for (const line of ['StateDirectory=blxr-search', 'User=www-data', 'NoNewPrivileges=true', 'ProtectSystem=strict', 'ProtectHome=true', 'PrivateTmp=true', 'CapabilityBoundingSet=', 'RestrictAddressFamilies=AF_INET AF_INET6', 'UMask=0077']) {
      assert.ok(unit.split('\n').includes(line), `unit lost ${line}`)
    }
  })

  test('the port the server defaults to is the one nginx proxies to and deploy.sh health-checks', async () => {
    const server = await read('server/src/server.mjs')
    const port = /const PORT = Number\(process\.env\.PORT\) \|\| (\d+)/.exec(server)[1]
    assert.match(await read('deploy/nginx/blxr.conf'), new RegExp(`proxy_pass http://127\\.0\\.0\\.1:${port};`))
    assert.match(await deploySh(), new RegExp(`curl -fsS http://127\\.0\\.0\\.1:${port}/api/music/health`))
    assert.match(server, /const HOST = '127\.0\.0\.1'/, 'loopback only')
  })

  test('nginx gives the chart endpoint longer than the server takes before answering "warming"', async () => {
    const budget = Number(/TOP_RESPONSE_BUDGET_MS = ([\d_]+)/.exec(await read('server/src/server.mjs'))[1].replace(/_/g, ''))
    const nginxRead = Number(/proxy_read_timeout (\d+)s;/.exec(await read('deploy/nginx/blxr.conf'))[1]) * 1000
    assert.ok(nginxRead > budget, `nginx proxy_read_timeout ${nginxRead}ms must exceed the server's ${budget}ms budget or users see 504s`)
  })

  test("nginx accepts bodies at least as large as the server's biggest JSON limit", async () => {
    const server = await read('server/src/server.mjs')
    const limits = [...server.matchAll(/readJsonBody\(req, ([\d_]+)\)/g)].map((m) => Number(m[1].replace(/_/g, '')))
    const apiBlock = /location \/api\/ \{([\s\S]*?)\n {4}\}/.exec(await read('deploy/nginx/blxr.conf'))[1]
    const nginxKb = Number(/client_max_body_size (\d+)k;/.exec(apiBlock)[1])
    assert.ok(nginxKb * 1024 >= Math.max(...limits))
  })

  test('nginx gives the blog editor room for its body limit and its GitHub round trips', async () => {
    const server = await read('server/src/server.mjs')
    const constant = (name) => Function(`return ${new RegExp(`const ${name} = ([\\d_ *]+)\\n`).exec(server)[1].replace(/_/g, '')}`)()
    const blogBlock = /location \/api\/blog\/ \{([\s\S]*?)\n {4}\}/.exec(await read('deploy/nginx/blxr.conf'))[1]
    const nginxMb = Number(/client_max_body_size (\d+)m;/.exec(blogBlock)[1])
    assert.ok(nginxMb * 1024 * 1024 >= constant('BLOG_BODY_MAX'))
    const nginxRead = Number(/proxy_read_timeout (\d+)s;/.exec(blogBlock)[1]) * 1000
    assert.ok(nginxRead > constant('BLOG_TIMEOUT_MS') * 3, 'a save makes several sequential GitHub calls')
    assert.match(blogBlock, /proxy_set_header X-Forwarded-Proto https;/)
    assert.match(blogBlock, /limit_req zone=blxr_api/)
  })
})

describe('deploy.sh', () => {
  test('parses (bash -n)', async () => {
    await exec('bash', ['-n', path.join(ROOT, 'deploy/deploy.sh')])
  })

  test('rejects unknown targets with usage and exit 2', async () => {
    const err = await exec('bash', [path.join(ROOT, 'deploy/deploy.sh'), 'bogus'], { env: { ...process.env, DRY_RUN: '1' } }).catch((e) => e)
    assert.equal(err.code, 2)
    assert.match(err.stderr, /usage:/)
  })

  test('server dry-run installs every module, merges public settings without printing values, and health-checks', async () => {
    const { stdout } = await exec('bash', [path.join(ROOT, 'deploy/deploy.sh'), 'server'], { env: { ...process.env, DRY_RUN: '1' } })
    for (const f of (await readdir(path.join(ROOT, 'server/src'))).filter((x) => x.endsWith('.mjs'))) {
      assert.match(stdout, new RegExp(`install -D -m 0644 \\S+/server/src/${f.replace('.', '\\.')} /opt/blxr-search/${f.replace('.', '\\.')}`), f)
    }
    assert.match(stdout, /systemctl restart blxr-search/)
    assert.match(stdout, /\/api\/music\/health/)
    const env = await read('deploy/server.env')
    for (const [, value] of env.matchAll(/^[A-Z_]+=(.+)$/gm)) assert.ok(!stdout.includes(value), 'a setting value was printed to the CI log')
  })

  test('nginx dry-run succeeds once a build has produced the CSP hashes and Early Hints', { skip: !built && 'run npm run build first' }, async () => {
    const { stdout } = await exec('bash', [path.join(ROOT, 'deploy/deploy.sh'), 'nginx'], { env: { ...process.env, DRY_RUN: '1' } })
    assert.match(stdout, /install security-headers snippet with\s+[1-9]\d* hash/)
    assert.match(stdout, /nginx -t/)
  })

  test('the deploy workflow lints and tests before it deploys', async () => {
    const wf = await read('.github/workflows/deploy.yml')
    const at = (s) => wf.indexOf(s)
    assert.ok(at('npm ci') >= 0)
    assert.ok(at('npm run lint') > at('npm ci'), 'lint runs after install')
    assert.ok(at('npm test') > at('npm ci'), 'tests run after install')
    assert.ok(at('deploy/deploy.sh') > at('npm test'), 'deploy only after tests pass')
  })
})

describe('log levels match what actually went wrong', () => {
  const server = async () => read('server/src/server.mjs')

  test('a feature switched off in the environment is info, not error', async () => {
    const src = await server()
    assert.match(src, /const EXPECTED_OFF = /)
    assert.match(src, /function apiLevel\(status, code\)/)
    assert.doesNotMatch(src, /level: status >= 500 \? 'error' : 'warn',/)
    assert.match(src, /level: apiLevel\(status, body\?\.error\),/)
  })

  test('every *_disabled 503 the server can emit is covered by that rule', async () => {
    const src = await server()
    const codes = [...src.matchAll(/return json\(res, 503, \{ error: '([a-z_]+)'/g)].map((m) => m[1])
    assert.ok(codes.length >= 4, `expected several 503 codes, found ${codes.join(', ')}`)
    for (const code of codes) {
      assert.ok(
        code === 'warming' || code.endsWith('_disabled') || code === 'paused',
        `${code} is a deliberate "unavailable" response and must not be logged as an error`,
      )
    }
  })

  test('a 5xx from GitHub is warn, since stats are optional and cached', async () => {
    const src = await server()
    const graphql = /async function ghGraphql[\s\S]*?\n}/.exec(src)[0]
    assert.doesNotMatch(graphql, /log\.error\('github', `GraphQL answered/)
    assert.match(graphql, /log\.warn\('github', `GraphQL answered/)
  })

  test('weather serves the last good reading instead of 502-ing', async () => {
    const src = await server()
    assert.match(src, /const WEATHER_STALE = /)
    const route = /if \(url\.pathname === '\/api\/weather'\) \{[\s\S]*?\n {4}\}/.exec(src)[0]
    assert.match(route, /return json\(res, 200, weatherCache\.data, stale \? WEATHER_STALE : WEATHER_CACHE\)/)
    assert.match(route, /weather_failed/)
  })
})
