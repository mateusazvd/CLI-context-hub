// Empacota o editor de desenho (Excalidraw + React) e o leitor de Markdown em módulos para a tela do Electron.
// Uso: npm run build:draw
const esbuild = require('esbuild')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const out = path.join(root, 'src', 'renderer', 'draw', 'dist')

fs.rmSync(out, { recursive: true, force: true })

esbuild.build({
  // draw = desenho (Excalidraw); md = leitor/editor de Markdown; svg = visualizador de SVG
  entryPoints: {
    draw: path.join(root, 'src', 'renderer', 'draw', 'index.jsx'),
    md: path.join(root, 'src', 'renderer', 'draw', 'md.js'),
    svg: path.join(root, 'src', 'renderer', 'draw', 'svg.js')
  },
  bundle: true,
  format: 'esm',
  splitting: true,           // carrega idiomas e o mermaid só quando forem usados
  outdir: out,
  entryNames: '[name]',
  minify: true,
  jsx: 'automatic',
  target: 'chrome130',
  conditions: ['production'],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.IS_PREACT': '"false"' },
  loader: { '.woff2': 'file', '.ttf': 'file', '.png': 'file', '.svg': 'file' },
  logLevel: 'info'
}).then(() => {
  // fontes locais (sem a Xiaolai, de 13 MB, usada só para chinês/japonês)
  const fonts = path.join(root, 'node_modules', '@excalidraw', 'excalidraw', 'dist', 'prod', 'fonts')
  fs.cpSync(fonts, path.join(out, 'fonts'), { recursive: true, filter: src => !src.includes(`${path.sep}Xiaolai`) })
  console.log('ok: desenho empacotado em', path.relative(root, out))
}).catch(() => process.exit(1))
