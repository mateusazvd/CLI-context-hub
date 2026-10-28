// Roda antes do `npm start`: só empacota o desenho se o pacote não existir ou se o código mudou.
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..')
const dir = path.join(root, 'src', 'renderer', 'draw')
const pairs = [['index.jsx', 'draw.js'], ['md.js', 'md.js']]
const stale = pairs.some(([src, out]) => {
  const o = path.join(dir, 'dist', out)
  return !fs.existsSync(o) || fs.statSync(path.join(dir, src)).mtimeMs > fs.statSync(o).mtimeMs
})
if (stale) require('./build-draw.js')
