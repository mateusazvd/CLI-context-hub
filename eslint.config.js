// ESLint flat config (ESLint 9+). Correção/qualidade; a formatação fica com o Prettier.
'use strict'

const node = {
  process: 'readonly', require: 'readonly', module: 'writable', __dirname: 'readonly',
  console: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', URL: 'readonly', structuredClone: 'readonly',
  AbortController: 'readonly', fetch: 'readonly'
}
const browser = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly',
  fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly',
  clearInterval: 'readonly', console: 'readonly', requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly', CustomEvent: 'readonly', Image: 'readonly', URL: 'readonly',
  structuredClone: 'readonly', indexedDB: 'readonly', Blob: 'readonly', FileReader: 'readonly',
  crypto: 'readonly', confirm: 'readonly', getSelection: 'readonly', getComputedStyle: 'readonly',
  CSS: 'readonly', ResizeObserver: 'readonly', NodeFilter: 'readonly', AbortController: 'readonly',
  KeyboardEvent: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly', performance: 'readonly',
  // bibliotecas e módulos carregados como global no renderer
  THREE: 'readonly', Terminal: 'readonly', FitAddon: 'readonly',
  WorkspaceGraph: 'readonly', Graph3DRenderer: 'readonly', HubDraw: 'readonly'
}

const rules = {
  'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
  'no-undef': 'error',
  'no-var': 'error',
  'prefer-const': 'warn',
  eqeqeq: ['warn', 'smart'],
  'no-empty': ['warn', { allowEmptyCatch: true }]
}

module.exports = [
  // draw/ é React empacotado pelo esbuild (JSX/ESM), não entra no lint do núcleo
  { ignores: ['app/node_modules/**', 'node_modules/**', 'app/src/renderer/draw/**'] },
  {
    files: ['app/src/main/**/*.js', 'app/scripts/**/*.js', 'app/src/preload.js', 'app/src/statusline/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: node },
    rules
  },
  {
    // preload que monta DOM: tem Node (require) e browser (document)
    files: ['app/src/miniapp-preload.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...node, ...browser } },
    rules
  },
  {
    files: ['app/tests/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...node, test: 'readonly', describe: 'readonly', it: 'readonly', before: 'readonly', after: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' } },
    rules
  },
  {
    files: ['app/src/renderer/**/*.js', 'app/apps/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...browser, module: 'writable', require: 'readonly' } },
    rules
  }
]
