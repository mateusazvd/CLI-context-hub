const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const { syncWorkspace } = require('../src/main/sync')

function fixture (t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cch-sync-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  for (const [name, content] of [
    ['skills/demo/SKILL.md', 'skill'],
    ['agents/demo.md', 'agent'],
    ['commands/demo.md', 'command'],
    ['mcp/mcp.json', '{"mcpServers":{"demo":{"command":"demo"}}}']
  ]) {
    const file = path.join(dir, ...name.split('/'))
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return dir
}

test('Gemini ignora mkdir EPERM em .claude e nao cria configuracao de outros CLIs', t => {
  const dir = fixture(t)
  const file = path.resolve(__dirname, '../src/main/sync.js')
  const localRequire = createRequire(file)
  const blocked = path.join(dir, '.claude', 'skills')
  const error = Object.assign(new Error(`EPERM: mkdir '${blocked}'`), { code: 'EPERM' })
  const context = {
    module: { exports: {} },
    require: name => name === 'node:fs'
      ? { ...fs, mkdirSync: (target, options) => {
          if (target === blocked) throw error
          return fs.mkdirSync(target, options)
        } }
      : localRequire(name)
  }
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file })
  const sync = context.module.exports.syncWorkspace
  sync(dir, 'gemini')
  sync(dir, 'gemini')
  assert.equal(fs.readFileSync(path.join(dir, '.gemini', 'skills', 'demo', 'SKILL.md'), 'utf8'), 'skill')
  assert.match(fs.readFileSync(path.join(dir, 'GEMINI.md'), 'utf8'), /@AGENTS.md/)
  for (const name of ['.claude', '.github', 'CLAUDE.md', '.mcp.json']) {
    assert.equal(fs.existsSync(path.join(dir, name)), false)
  }
  assert.throws(() => sync(dir, 'copilot'), err => err === error)
})

for (const engine of ['claude', 'copilot']) {
  test(`${engine} sincroniza seus recursos sem tocar Gemini`, t => {
    const dir = fixture(t)
    const manual = path.join(dir, '.gemini', 'skills', 'demo', 'SKILL.md')
    fs.mkdirSync(path.dirname(manual), { recursive: true })
    fs.writeFileSync(manual, 'manual')
    syncWorkspace(dir, engine)
    assert.equal(fs.readFileSync(manual, 'utf8'), 'manual')
    assert.equal(fs.existsSync(path.join(dir, 'GEMINI.md')), false)
    assert.equal(fs.readFileSync(path.join(dir, '.claude', 'skills', 'demo', 'SKILL.md'), 'utf8'), 'skill')
    assert.equal(fs.existsSync(path.join(dir, '.github', 'agents', 'demo.agent.md')), engine === 'copilot')
    assert.equal(fs.existsSync(path.join(dir, '.claude', 'agents', 'demo.md')), engine === 'claude')
    assert.equal(fs.existsSync(path.join(dir, '.claude', 'commands', 'demo.md')), engine === 'claude')
    assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), engine === 'claude')
    assert.equal(fs.existsSync(path.join(dir, '.mcp.json')), engine === 'claude' || engine === 'copilot')
  })
}

test('sincronizacao completa permanece disponivel e motor invalido falha antes de gravar', t => {
  const dir = fixture(t)
  assert.throws(() => syncWorkspace(dir, 'invalido'), /desconhecido/)
  assert.equal(fs.existsSync(path.join(dir, '.claude')), false)
  syncWorkspace(dir)
  for (const name of ['.claude', '.github', '.gemini', 'CLAUDE.md', 'GEMINI.md']) {
    assert.equal(fs.existsSync(path.join(dir, name)), true)
  }
})
