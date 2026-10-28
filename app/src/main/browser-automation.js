// Automações do navegador embutido: executa "receitas" (JSON) numa aba e grava novas receitas a partir dos cliques.
// Formato da receita: { name, description, vars: {chave: valor}, steps: [ { action, ... } ] }
// Ações: navigate{url} · wait{selector?|ms?,timeout?} · click{selector} · fill{selector,value} · press{key}
//        scroll{selector?|y?} · extract{selector?,mode:text|table|links|attr,attr?,all?,as?,save?:{rel,format:md|json|csv}}
// Passos de risco (enviar/comprar/apagar, campo de senha, Enter em formulário) pedem confirmação, a menos que "confirmed": true.

const RISKY_TEXT = /\b(enviar|submit|comprar|pagar|pagamento|finalizar|confirmar|excluir|apagar|deletar|remover|publicar|assinar|delete|remove|buy|pay|purchase|checkout|send|post|sign ?in|login|entrar)\b/i
const SPECIAL_KEYS = { Enter: '\r', Tab: '\t' }

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const q = value => JSON.stringify(String(value))

function interpolate (text, vars) {
  return String(text ?? '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
    if (key === 'date') return new Date().toISOString().slice(0, 10)
    if (key === 'datetime') return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    return key in vars ? String(vars[key]) : match
  })
}

function validateRecipe (recipe) {
  if (!recipe || typeof recipe !== 'object' || !Array.isArray(recipe.steps)) throw new Error('Receita inválida: faltam os "steps".')
  const known = ['navigate', 'wait', 'click', 'fill', 'press', 'scroll', 'extract']
  recipe.steps.forEach((step, i) => {
    if (!step || !known.includes(step.action)) throw new Error(`Passo ${i + 1}: ação desconhecida "${step && step.action}".`)
    if (step.action === 'navigate' && !/^https?:\/\//i.test(String(step.url || ''))) throw new Error(`Passo ${i + 1}: navigate precisa de uma URL http(s).`)
    if (['click', 'fill'].includes(step.action) && !step.selector) throw new Error(`Passo ${i + 1}: ${step.action} precisa de "selector".`)
  })
  return recipe
}

// Descreve o elemento (para decidir se a ação é arriscada) sem alterá-lo
function findScript (selector, text) {
  const byText = text ? `Array.from(document.querySelectorAll('a, button, [role=button], summary, label')).find(n => (n.innerText || n.value || n.getAttribute('aria-label') || '').trim() === ${q(text)})` : 'null'
  return `(() => { let el = null; try { el = document.querySelector(${q(selector)}) } catch {} ; return el || ${byText} })()`
}

function describeScript (selector, text) {
  return `(() => {
    const el = ${findScript(selector, text)}
    if (!el) return null
    const label = (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 80)
    return { tag: el.tagName.toLowerCase(), type: (el.getAttribute('type') || '').toLowerCase(), label,
      inForm: !!el.closest('form'), submit: el.tagName === 'BUTTON' ? (el.getAttribute('type') || 'submit') === 'submit' : (el.getAttribute('type') || '') === 'submit' }
  })()`
}

function extractScript (step) {
  const sel = step.selector ? q(step.selector) : 'null'
  return `(() => {
    const sel = ${sel}, mode = ${q(step.mode || 'text')}, attr = ${q(step.attr || '')}, all = ${step.all ? 'true' : 'false'}
    const nodes = sel ? Array.from(document.querySelectorAll(sel)) : [document.body]
    if (!nodes.length) return { error: 'Nenhum elemento para "' + sel + '"' }
    const clean = s => (s || '').replace(/\\s+/g, ' ').trim()
    if (mode === 'table') {
      const tables = nodes.flatMap(n => n.tagName === 'TABLE' ? [n] : Array.from(n.querySelectorAll('table')))
      if (!tables.length) return { error: 'Nenhuma tabela encontrada' }
      return { value: tables.slice(0, all ? tables.length : 1).map(t => Array.from(t.rows).map(r => Array.from(r.cells).map(c => clean(c.innerText)))) }
    }
    if (mode === 'links') return { value: nodes.flatMap(n => n.tagName === 'A' ? [n] : Array.from(n.querySelectorAll('a[href]'))).map(a => ({ text: clean(a.innerText), href: a.href })) }
    if (mode === 'attr') return { value: (all ? nodes : nodes.slice(0, 1)).map(n => n.getAttribute(attr)) }
    return { value: (all ? nodes : nodes.slice(0, 1)).map(n => (n.innerText || '').trim()) }
  })()`
}

function toCsv (rows) {
  return rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')
}

function formatOutput (value, format, mode) {
  if (format === 'json') return JSON.stringify(value, null, 2)
  const tables = mode === 'table' ? value : null
  if (format === 'csv') return tables ? tables.map(toCsv).join('\n\n') : toCsv((Array.isArray(value) ? value : [value]).map(v => [typeof v === 'object' ? JSON.stringify(v) : v]))
  // markdown
  if (tables) {
    return tables.map(t => {
      if (!t.length) return ''
      const width = Math.max(...t.map(r => r.length))
      const row = r => '| ' + Array.from({ length: width }, (_, i) => String(r[i] ?? '').replace(/\|/g, '\\|')).join(' | ') + ' |'
      return [row(t[0]), '| ' + Array(width).fill('---').join(' | ') + ' |', ...t.slice(1).map(row)].join('\n')
    }).join('\n\n') + '\n'
  }
  if (mode === 'links') return value.map(l => `- [${l.text || l.href}](${l.href})`).join('\n') + '\n'
  return (Array.isArray(value) ? value : [value]).join('\n\n') + '\n'
}

// deps: { wc, confirm(msg)->Promise<bool>, saveOutput(rel,text), onProgress(info), isCancelled() }
async function runRecipe (recipe, deps) {
  validateRecipe(recipe)
  const { wc, confirm, saveOutput, onProgress = () => {}, isCancelled = () => false } = deps
  const vars = { ...(recipe.vars || {}) }
  const results = {}
  const saved = []
  const total = recipe.steps.length
  const js = code => wc.executeJavaScript(code)
  // páginas carregam aos poucos: tenta achar o elemento por até 8s (ou step.timeout) antes de falhar
  const describe = async step => {
    const limit = Date.now() + (step.timeout || 8000)
    for (;;) {
      const info = await js(describeScript(step.selector, step.text))
      if (info || Date.now() > limit) return info
      if (isCancelled()) throw new Error('Automação cancelada.')
      await sleep(250)
    }
  }

  for (let i = 0; i < total; i++) {
    if (isCancelled()) throw new Error('Automação cancelada.')
    const step = recipe.steps[i]
    onProgress({ step: i + 1, total, action: step.action, message: step.selector || step.url || step.key || '' })
    const risky = async what => {
      if (step.confirmed) return
      if (!(await confirm(what))) throw new Error('Ação recusada pelo usuário.')
    }

    if (step.action === 'navigate') {
      try { await wc.loadURL(interpolate(step.url, vars)) } catch (e) {
        // redirecionamentos cancelam a carga inicial (ERR_ABORTED); a página seguinte carrega normalmente
        if (e && e.errno !== -3 && !/ERR_ABORTED/.test(String(e.message))) throw new Error(`Passo ${i + 1}: não foi possível abrir ${step.url} (${e.message})`)
        await sleep(500)
      }
    } else if (step.action === 'wait') {
      if (step.selector) {
        const limit = Date.now() + (step.timeout || 10000)
        while (!(await js(`!!document.querySelector(${q(step.selector)})`))) {
          if (Date.now() > limit) throw new Error(`Passo ${i + 1}: tempo esgotado esperando "${step.selector}".`)
          if (isCancelled()) throw new Error('Automação cancelada.')
          await sleep(200)
        }
      } else await sleep(Math.min(step.ms || 1000, 60000))
    } else if (step.action === 'click') {
      const info = await describe(step)
      if (!info) throw new Error(`Passo ${i + 1}: elemento não encontrado: ${step.selector}${step.text ? ` (nem pelo texto "${step.text}")` : ''}. Use "wait" antes ou ajuste o seletor.`)
      if (info.submit || RISKY_TEXT.test(info.label)) await risky(`Clicar em "${info.label || step.selector}"?\n\nPode enviar, comprar ou apagar algo.`)
      await js(`(() => { const el = ${findScript(step.selector, step.text)}; el.scrollIntoView({ block: 'center' }); el.click() })()`)
    } else if (step.action === 'fill') {
      const info = await describe(step)
      if (!info) throw new Error(`Passo ${i + 1}: campo não encontrado: ${step.selector}`)
      if (info.type === 'password') await risky('Preencher um campo de senha?')
      const value = interpolate(step.value, vars)
      await js(`(() => {
        const el = document.querySelector(${q(step.selector)})
        el.focus()
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')
        if (setter && setter.set && el.tagName !== 'SELECT') setter.set.call(el, ${q(value)}); else el.value = ${q(value)}
        el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
      })()`)
    } else if (step.action === 'press') {
      const key = String(step.key || '')
      if (key === 'Enter') {
        const inForm = await js('!!(document.activeElement && document.activeElement.form)')
        if (inForm) await risky('Pressionar Enter em um formulário?\n\nPode enviá-lo.')
      }
      wc.sendInputEvent({ type: 'keyDown', keyCode: key })
      if (SPECIAL_KEYS[key] || key.length === 1) wc.sendInputEvent({ type: 'char', keyCode: SPECIAL_KEYS[key] || key })
      wc.sendInputEvent({ type: 'keyUp', keyCode: key })
    } else if (step.action === 'scroll') {
      if (step.selector) await js(`document.querySelector(${q(step.selector)})?.scrollIntoView({ block: 'center' })`)
      else await js(`window.scrollTo({ top: ${Number(step.y) || 0} })`)
    } else if (step.action === 'extract') {
      const out = await js(extractScript(step))
      if (out.error) throw new Error(`Passo ${i + 1}: ${out.error}`)
      const key = step.as || `extract${i + 1}`
      results[key] = out.value
      if (step.save && step.save.rel) {
        const rel = interpolate(step.save.rel, vars)
        saveOutput(rel, formatOutput(out.value, step.save.format || 'md', step.mode || 'text'))
        saved.push(rel)
      }
    }
    if (step.delay) await sleep(Math.min(step.delay, 30000))
  }
  return { results, saved }
}

// ---------- gravador ----------
const RECORDER_PREFIX = '__HHREC__'

const RECORDER_SCRIPT = `(() => {
  window.__hhRecorder = true
  if (window.__hhRecorderInstalled) return
  window.__hhRecorderInstalled = true
  const uniq = s => { try { return document.querySelectorAll(s).length === 1 } catch { return false } }
  const esc = s => (window.CSS && CSS.escape) ? CSS.escape(s) : s
  const pick = el => {
    if (el.id && uniq('#' + esc(el.id))) return '#' + esc(el.id)
    for (const a of ['data-testid', 'name', 'aria-label', 'placeholder', 'href']) {
      const v = el.getAttribute(a)
      if (v) { const s = el.tagName.toLowerCase() + '[' + a + '=' + JSON.stringify(v) + ']'; if (uniq(s)) return s }
    }
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 5) {
      const same = Array.from(node.parentElement ? node.parentElement.children : []).filter(c => c.tagName === node.tagName)
      parts.unshift(node.tagName.toLowerCase() + (same.length > 1 ? ':nth-of-type(' + (same.indexOf(node) + 1) + ')' : ''))
      const s = parts.join(' > ')
      if (uniq(s)) return s
      node = node.parentElement
    }
    return parts.join(' > ')
  }
  const emit = o => window.__hhRecorder && console.log(${q(RECORDER_PREFIX)} + JSON.stringify(o))
  document.addEventListener('click', e => {
    const el = e.target.closest('a, button, input, select, textarea, [role=button], label, summary') || e.target
    if (['INPUT', 'TEXTAREA'].includes(el.tagName) && !['submit', 'button', 'checkbox', 'radio'].includes(el.type)) return
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim()
    emit({ action: 'click', selector: pick(el), text: text && text.length <= 60 ? text : undefined })
  }, true)
  document.addEventListener('change', e => {
    const el = e.target
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || ['checkbox', 'radio', 'submit', 'button'].includes(el.type)) return
    emit({ action: 'fill', selector: pick(el), value: el.type === 'password' ? '{{senha}}' : el.value })
  }, true)
})()`

// Grava cliques e preenchimentos da aba; devolve { stop() -> steps }
function startRecording (wc) {
  const steps = [{ action: 'navigate', url: wc.getURL() }]
  const onConsole = (...args) => {
    const message = typeof args[0]?.message === 'string' ? args[0].message : args[2]
    if (typeof message !== 'string' || !message.startsWith(RECORDER_PREFIX)) return
    try {
      const step = JSON.parse(message.slice(RECORDER_PREFIX.length))
      const last = steps[steps.length - 1]
      if (step.action === 'fill' && last && last.action === 'fill' && last.selector === step.selector) last.value = step.value
      else steps.push(step)
    } catch {}
  }
  const inject = () => { wc.executeJavaScript(RECORDER_SCRIPT).catch(() => {}) }
  wc.on('console-message', onConsole)
  wc.on('did-finish-load', inject)
  inject()
  return {
    stop () {
      wc.removeListener('console-message', onConsole)
      wc.removeListener('did-finish-load', inject)
      wc.executeJavaScript('window.__hhRecorder = false').catch(() => {})
      return steps
    }
  }
}

module.exports = { runRecipe, validateRecipe, startRecording, formatOutput, interpolate }
