// Preload para miniapps: expõe leitura/escrita de data.json no diretório do miniapp.
// O arquivo fica no repo git, então sincroniza entre máquinas via push/pull.
// Também injeta titlebar customizado (frameless) e botão de sair do fullscreen.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('miniappData', {
  load: () => ipcRenderer.invoke('miniapp-data:load'),
  save: data => ipcRenderer.invoke('miniapp-data:save', data)
})

contextBridge.exposeInMainWorld('miniappWindow', {
  minimize: () => ipcRenderer.invoke('miniapp-window:minimize'),
  maximize: () => ipcRenderer.invoke('miniapp-window:maximize'),
  close: () => ipcRenderer.invoke('miniapp-window:close'),
  isMaximized: () => ipcRenderer.invoke('miniapp-window:isMaximized'),
  toggleFullscreen: () => ipcRenderer.invoke('miniapp-window:toggleFullscreen'),
  isFullscreen: () => ipcRenderer.invoke('miniapp-window:isFullscreen')
})

// ── Injeta titlebar + exit-fullscreen button em todos os miniapps ──
// Usa ipcRenderer diretamente nos handlers (preload context isolado do main world)
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style')
  style.textContent = `
    #miniapp-titlebar { display: flex; align-items: center; justify-content: space-between; height: 32px; background: #1a1c22; border-bottom: 1px solid #2a2d35; flex-shrink: 0; -webkit-app-region: drag; user-select: none; z-index: 99999; }
    #miniapp-titlebar .mtb-drag { flex: 1; display: flex; align-items: center; padding-left: 14px; height: 100%; }
    #miniapp-titlebar .mtb-title { font-size: 12px; color: #7c8495; font-weight: 500; letter-spacing: 0.03em; font-family: system-ui, -apple-system, sans-serif; }
    #miniapp-titlebar .mtb-controls { display: flex; -webkit-app-region: no-drag; height: 100%; }
    #miniapp-titlebar .mtb-btn { background: transparent; border: none; color: #7c8495; width: 46px; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .1s, color .1s; }
    #miniapp-titlebar .mtb-btn:hover { background: rgba(255,255,255,0.08); color: #e0e4ea; }
    #miniapp-titlebar .mtb-btn.mtb-close:hover { background: #e81123; color: #fff; }
    #miniapp-exit-fs { display: none; position: fixed; top: 8px; right: 8px; z-index: 999999; background: rgba(26,28,34,0.92); border: 1px solid #2a2d35; border-radius: 6px; color: #7c8495; padding: 6px 14px; font-size: 12px; font-family: system-ui, -apple-system, sans-serif; font-weight: 500; cursor: pointer; -webkit-app-region: no-drag; transition: background .15s, color .15s; backdrop-filter: blur(8px); }
    #miniapp-exit-fs:hover { background: rgba(42,45,53,0.95); color: #e0e4ea; }
  `
  document.head.appendChild(style)

  const svgMin = '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="5.5" width="10" height="1" fill="currentColor"/></svg>'
  const svgMax = '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>'
  const svgRestore = '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="3" y="0.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/><rect x="0.5" y="3" width="8" height="8" rx="1.5" fill="#1a1c22" stroke="currentColor" stroke-width="1"/></svg>'
  const svgFs = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
  const svgClose = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>'

  // Remove titlebar manual se existir (evita duplicata)
  const existing = document.getElementById('titlebar')
  if (existing) existing.remove()

  const title = document.title || 'Miniapp'
  const titlebar = document.createElement('header')
  titlebar.id = 'miniapp-titlebar'
  titlebar.innerHTML = `
    <div class="mtb-drag"><span class="mtb-title">${title} · harness-hub</span></div>
    <div class="mtb-controls">
      <button class="mtb-btn" id="mtb-min" title="Minimizar">${svgMin}</button>
      <button class="mtb-btn" id="mtb-max" title="Maximizar">${svgMax}</button>
      <button class="mtb-btn" id="mtb-fs" title="Tela cheia (F11)">${svgFs}</button>
      <button class="mtb-btn mtb-close" id="mtb-close" title="Fechar">${svgClose}</button>
    </div>
  `
  document.body.prepend(titlebar)

  const exitFs = document.createElement('button')
  exitFs.id = 'miniapp-exit-fs'
  exitFs.textContent = 'Sair da tela cheia (F11)'
  document.body.appendChild(exitFs)

  // Referências
  const btnMax = document.getElementById('mtb-max')
  const btnFs = document.getElementById('mtb-fs')

  async function updateMaxIcon () {
    const max = await ipcRenderer.invoke('miniapp-window:isMaximized')
    btnMax.title = max ? 'Restaurar' : 'Maximizar'
    btnMax.innerHTML = max ? svgRestore : svgMax
  }

  async function updateFsState () {
    const fs = await ipcRenderer.invoke('miniapp-window:isFullscreen')
    titlebar.style.display = fs ? 'none' : 'flex'
    exitFs.style.display = fs ? 'block' : 'none'
    btnFs.title = fs ? 'Sair da tela cheia (F11)' : 'Tela cheia (F11)'
  }

  document.getElementById('mtb-min').onclick = () => ipcRenderer.invoke('miniapp-window:minimize')
  btnMax.onclick = async () => { await ipcRenderer.invoke('miniapp-window:maximize'); updateMaxIcon() }
  btnFs.onclick = async () => { await ipcRenderer.invoke('miniapp-window:toggleFullscreen'); updateFsState() }
  document.getElementById('mtb-close').onclick = () => ipcRenderer.invoke('miniapp-window:close')
  exitFs.onclick = async () => { await ipcRenderer.invoke('miniapp-window:toggleFullscreen'); updateFsState() }

  document.addEventListener('keydown', e => {
    if (e.key === 'F11') { e.preventDefault(); ipcRenderer.invoke('miniapp-window:toggleFullscreen').then(() => updateFsState()) }
  })
})
