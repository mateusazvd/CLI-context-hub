const test = require('node:test')
const assert = require('node:assert')
const { runRecipe, validateRecipe, formatOutput, interpolate } = require('../src/main/browser-automation')

// wc falso: responde às consultas do executor sem navegador real
function fakeWc (responder) {
  const calls = []
  return {
    calls,
    loadURL: async url => { calls.push(['loadURL', url]) },
    sendInputEvent: e => calls.push(['key', e.type, e.keyCode]),
    executeJavaScript: async code => { calls.push(['js', code]); return responder(code) }
  }
}

test('interpolate troca variáveis e preserva as desconhecidas', () => {
  assert.strictEqual(interpolate('a {{x}} b {{y}}', { x: 1 }), 'a 1 b {{y}}')
  assert.match(interpolate('{{date}}', {}), /^\d{4}-\d{2}-\d{2}$/)
})

test('validateRecipe recusa ação desconhecida e navigate sem http', () => {
  assert.throws(() => validateRecipe({ steps: [{ action: 'x' }] }), /ação desconhecida/)
  assert.throws(() => validateRecipe({ steps: [{ action: 'navigate', url: 'file:///c:/x' }] }), /http/)
  assert.throws(() => validateRecipe({ steps: [{ action: 'click' }] }), /selector/)
})

test('formatOutput gera tabela markdown e csv', () => {
  const tables = [[['a', 'b'], ['1', '2']]]
  assert.strictEqual(formatOutput(tables, 'md', 'table'), '| a | b |\n| --- | --- |\n| 1 | 2 |\n')
  assert.strictEqual(formatOutput(tables, 'csv', 'table'), '"a","b"\n"1","2"')
})

test('clique arriscado pede confirmação e recusa interrompe', async () => {
  const wc = fakeWc(code => code.includes('closest') ? { tag: 'button', type: '', label: 'Enviar pedido', inForm: true, submit: true } : undefined)
  const asked = []
  const recipe = { steps: [{ action: 'click', selector: '#ok' }] }
  await assert.rejects(runRecipe(recipe, { wc, confirm: async m => { asked.push(m); return false }, saveOutput () {} }), /recusada/)
  assert.strictEqual(asked.length, 1)
  assert.ok(!wc.calls.some(c => c[1] && c[1].includes('.click()')))
})

test('extract salva a saída e navigate/wait/fill executam', async () => {
  const wc = fakeWc(code => {
    if (code.includes('closest')) return { tag: 'input', type: 'text', label: '', inForm: false, submit: false }
    if (code.includes('!!document.querySelector')) return true
    if (code.includes('const nodes')) return { value: ['Olá'] }
  })
  const saved = {}
  const out = await runRecipe({ vars: { nome: 'Ana' }, steps: [
    { action: 'navigate', url: 'https://exemplo.com' },
    { action: 'wait', selector: 'h1' },
    { action: 'fill', selector: '#n', value: '{{nome}}' },
    { action: 'extract', selector: 'h1', as: 'titulo', save: { rel: 'navegador/t.md', format: 'md' } }
  ] }, { wc, confirm: async () => true, saveOutput: (rel, text) => { saved[rel] = text } })
  assert.deepStrictEqual(out.results.titulo, ['Olá'])
  assert.strictEqual(saved['navegador/t.md'], 'Olá\n')
  assert.ok(wc.calls.some(c => c[0] === 'js' && c[1].includes('"Ana"')))
})
