// Visualizador de SVG do harness-hub.
// Renderiza o SVG sanitizado com pan e zoom via mouse/scroll.
import DOMPurify from 'dompurify'

/**
 * Renderiza o conteúdo SVG dentro de `el`, sanitizando com DOMPurify.
 * Retorna o elemento <svg> inserido (ou null se inválido).
 */
function render (el, text) {
  const clean = DOMPurify.sanitize(text || '', { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['use'], FORBID_TAGS: ['script', 'iframe', 'form'] })
  el.innerHTML = ''
  const wrapper = document.createElement('div')
  wrapper.className = 'svg-canvas'
  wrapper.innerHTML = clean
  const svg = wrapper.querySelector('svg')
  if (!svg) { el.textContent = 'SVG inválido ou vazio.'; return null }
  // garante que o SVG preencha o espaço disponível
  if (!svg.getAttribute('width') && !svg.style.width) svg.setAttribute('width', '100%')
  if (!svg.getAttribute('height') && !svg.style.height) svg.setAttribute('height', '100%')
  el.appendChild(wrapper)
  setupPanZoom(wrapper, svg)
  return svg
}

function setupPanZoom (wrapper, svg) {
  let scale = 1, tx = 0, ty = 0, dragging = false, startX, startY

  const apply = () => { svg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})` }
  svg.style.transformOrigin = '0 0'
  svg.style.cursor = 'grab'

  wrapper.addEventListener('wheel', e => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const rect = wrapper.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    // zoom centrado no cursor
    tx = mx - (mx - tx) * factor
    ty = my - (my - ty) * factor
    scale *= factor
    apply()
  }, { passive: false })

  wrapper.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    dragging = true; startX = e.clientX - tx; startY = e.clientY - ty
    svg.style.cursor = 'grabbing'
  })
  window.addEventListener('mousemove', e => {
    if (!dragging) return
    tx = e.clientX - startX; ty = e.clientY - startY
    apply()
  })
  window.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false; svg.style.cursor = 'grab'
  })

  // duplo clique reseta
  wrapper.addEventListener('dblclick', () => { scale = 1; tx = 0; ty = 0; apply() })
}

window.HubSvg = { render }
window.dispatchEvent(new Event('hubsvg:ready'))
