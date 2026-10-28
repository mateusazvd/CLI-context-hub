const fs = require('node:fs')
const path = require('node:path')
const YAML = require('yaml')

const MANIFEST = 'miniapp.yaml'
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function createMiniappStore (root) {
  function read (name) {
    if (!NAME_RE.test(name)) throw new Error(`Miniapp inválido: ${name}`)
    const dir = path.join(root, name)
    const manifestPath = path.join(dir, MANIFEST)
    const manifest = YAML.parse(fs.readFileSync(manifestPath, 'utf8')) || {}
    const entry = String(manifest.entry || '').trim()
    if (!entry || path.isAbsolute(entry) || entry.split(/[\\/]/).includes('..')) {
      throw new Error(`Manifesto inválido para "${name}": entry inválido.`)
    }
    const entryPath = path.resolve(dir, entry)
    if (path.dirname(entryPath) !== path.resolve(dir) && !entryPath.startsWith(`${path.resolve(dir)}${path.sep}`)) {
      throw new Error(`Manifesto inválido para "${name}": entry fora da pasta.`)
    }
    if (!fs.existsSync(entryPath) || !fs.statSync(entryPath).isFile()) {
      throw new Error(`Manifesto inválido para "${name}": entry não encontrado.`)
    }
    return {
      name,
      title: String(manifest.title || name),
      version: String(manifest.version || '0.0.0'),
      description: String(manifest.description || ''),
      runtime: String(manifest.runtime || 'electron-web'),
      entry,
      path: dir,
      entryPath,
      dataScope: String(manifest.dataScope || 'isolated'),
      integration: String(manifest.integration || 'none'),
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions.map(String) : [],
      capabilities: Array.isArray(manifest.capabilities) ? manifest.capabilities.map(String) : []
    }
  }

  function list () {
    if (!fs.existsSync(root)) return []
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(item => item.isDirectory() && !item.name.startsWith('_') && !item.name.startsWith('.'))
      .map(item => {
        try { return read(item.name) } catch (error) {
          console.error(`[miniapps] Ignorando "${item.name}": ${error.message}`)
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(({ entryPath, path: dir, ...miniapp }) => miniapp)
  }

  function get (name) {
    return read(String(name))
  }

  return { root, list, get }
}

module.exports = { createMiniappStore }
