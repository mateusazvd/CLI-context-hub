#!/usr/bin/env node
// Statusline do Claude Code usada nas abas do harness-hub.
// O Claude chama este script depois de cada resposta e entrega, pela entrada padrão, um JSON
// com o estado da sessão, incluindo os limites do plano (rate_limits.five_hour / seven_day).
// O script grava esses dados para o mini-dashboard e imprime uma linha curta de status.
//
// Uso: node claude-statusline.js <pasta-de-uso>
const fs = require('fs')
const path = require('path')

const dir = process.argv[2] || process.env.HARNESS_HUB_USAGE_DIR
let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', c => { input += c })
process.stdin.on('end', () => {
  let data = {}
  try { data = JSON.parse(input || '{}') } catch {}

  const rl = data.rate_limits || null
  if (dir && rl) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      const out = {
        receivedAt: new Date().toISOString(),
        rate_limits: rl,
        model: data.model?.display_name || data.model?.id || null,
        session_id: data.session_id || null
      }
      const file = path.join(dir, 'claude-statusline.json')
      fs.writeFileSync(file + '.tmp', JSON.stringify(out, null, 2))
      fs.renameSync(file + '.tmp', file) // troca atômica: o app nunca lê um arquivo pela metade
    } catch {}
  }

  const pct = v => (v == null ? '—' : `${Math.round(v)}%`)
  const parts = ['harness-hub']
  if (data.model?.display_name) parts.push(data.model.display_name)
  if (rl?.five_hour) parts.push(`sessão ${pct(rl.five_hour.used_percentage)}`)
  if (rl?.seven_day) parts.push(`semana ${pct(rl.seven_day.used_percentage)}`)
  process.stdout.write(parts.join(' · '))
})
