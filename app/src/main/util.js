// Utilidades compartilhadas do processo principal.
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')
const YAML = require('yaml')

// "~" e "~/x" viram a pasta do usuário
function expandHome (p) {
  if (!p || p === '~') return os.homedir()
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2))
  return p
}

function isDir (p) {
  try { return fs.statSync(p).isDirectory() } catch { return false }
}

// Data/hora local no formato ISO com fuso (ex: 2026-10-01T14:32:05-03:00)
function nowIso (d = new Date()) {
  const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0')
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(off / 60)}:${pad(off % 60)}`
}

function today () {
  return nowIso().slice(0, 10)
}

function slugify (text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'sessao'
}

// Frontmatter YAML entre linhas "---"
const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function parseFrontmatter (text) {
  const m = text.match(FM)
  if (!m) return { data: {}, body: text }
  return { data: YAML.parse(m[1]) || {}, body: text.slice(m[0].length) }
}

function stringifyFrontmatter (data, body) {
  return `---\n${YAML.stringify(data, { lineWidth: 0 })}---\n${body.startsWith('\n') ? '' : '\n'}${body}`
}

module.exports = { expandHome, isDir, nowIso, today, slugify, parseFrontmatter, stringifyFrontmatter }
