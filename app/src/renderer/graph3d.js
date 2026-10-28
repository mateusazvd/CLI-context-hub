// Grafo das pastas do harness no estilo do Obsidian: pontos planos e discretos, linhas finas,
// rótulos pequenos e destaque da pasta e dos vizinhos ao passar o mouse.
// Reduzido: gira sozinho. Expandido: arrastar gira. Nos dois: roda do mouse aproxima, clique duplo reenquadra.
// Clicar numa pasta com subpastas abre ou fecha o ramo (anel = ramo fechado).
const CONFIG_FOLDERS = new Set([])

function getGraphStyle (isDark = true) {
  return isDark ? {
    node: new THREE.Color('#6b7d8e'),
    root: new THREE.Color('#e8eaed'),
    near: new THREE.Color('#b8c4d0'),
    accent: new THREE.Color('#e5484d'),
    link: new THREE.Color('#2a3540'),
    linkHot: new THREE.Color('#8ec8d8'),
    linkDim: new THREE.Color('#1a1f25'),
    label: new THREE.Color('#8aa0b0'),
    memory: new THREE.Color('#3eb8a0'),
    memoryHot: new THREE.Color('#5eddcc'),
    memoryLabel: new THREE.Color('#5ac8b4'),
    linkMemory: new THREE.Color('#2a4a44'),
    config: new THREE.Color('#5a8abf'),
    configHot: new THREE.Color('#7ab0e0'),
    configLabel: new THREE.Color('#6a9ad0'),
    skills: new THREE.Color('#9a6ec8'),
    skillsHot: new THREE.Color('#b88ee8'),
    skillsLabel: new THREE.Color('#a880d8'),
    file: new THREE.Color('#5e6e7a'),
    fileHot: new THREE.Color('#90b8cc'),
    fileLabel: new THREE.Color('#7a98aa'),
    pulse: new THREE.Color('#ff6b6b'),
    fog: 0x0b0c0e,
  } : {
    node: new THREE.Color('#5a6a7a'),
    root: new THREE.Color('#1a2a3a'),
    near: new THREE.Color('#3a5a70'),
    accent: new THREE.Color('#c0392b'),
    link: new THREE.Color('#b0bac8'),
    linkHot: new THREE.Color('#2a8a8a'),
    linkDim: new THREE.Color('#d4dae0'),
    label: new THREE.Color('#3a5060'),
    memory: new THREE.Color('#1a8a6a'),
    memoryHot: new THREE.Color('#0ab090'),
    memoryLabel: new THREE.Color('#1a7a5a'),
    linkMemory: new THREE.Color('#a0d0c0'),
    config: new THREE.Color('#2a6aaa'),
    configHot: new THREE.Color('#1a80d0'),
    configLabel: new THREE.Color('#2a5a90'),
    skills: new THREE.Color('#6a3aaa'),
    skillsHot: new THREE.Color('#8050d0'),
    skillsLabel: new THREE.Color('#5a2a9a'),
    file: new THREE.Color('#5a6a78'),
    fileHot: new THREE.Color('#2a7a8a'),
    fileLabel: new THREE.Color('#4a6070'),
    pulse: new THREE.Color('#c0392b'),
    fog: 0xf4f5f7,
  }
}
let GRAPH_STYLE = getGraphStyle(true)

class Graph3DRenderer {
  static circleTexture (ring) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const x = c.getContext('2d')
    x.beginPath()
    x.arc(64, 64, ring ? 52 : 58, 0, Math.PI * 2)
    if (ring) { x.lineWidth = 7; x.strokeStyle = '#fff'; x.stroke() } else { x.fillStyle = '#fff'; x.fill() }
    return new THREE.CanvasTexture(c)
  }

  static glowTexture () {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const x = c.getContext('2d')
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }

  // contexts/ e suas subpastas ficam laranja. Distância até contexts/ (0 = a própria, 1 = filha...) ou -1.
  static memoryDepth (node) {
    for (let n = node, k = 0; n; n = n.parent, k++) if (n.depth === 1 && n.name === 'contexts') return k
    return -1
  }

  static memoryColor (k) {
    return k === 0 ? GRAPH_STYLE.memory.clone() : GRAPH_STYLE.memory.clone().lerp(GRAPH_STYLE.node, 0.45)
  }

  // sessions, agents, commands, mcp ficam em teal.
  static isConfigFolder (node) {
    if (node.isFile) return false
    for (let n = node; n; n = n.parent) if (n.depth === 1 && CONFIG_FOLDERS.has(n.name)) return true
    return false
  }

  // skills, commands, agents, mcp, sessions ficam na mesma cor cinza-claro.
  static isSkillsFolder (node) {
    if (node.isFile) return false
    const SKILL_LIKE = new Set(['skills', 'commands', 'agents', 'mcp', 'sessions'])
    for (let n = node; n; n = n.parent) if (n.depth === 1 && SKILL_LIKE.has(n.name)) return true
    return false
  }

  static makeLabel (text) {
    const font = '500 30px system-ui, "Segoe UI", sans-serif'
    const c = document.createElement('canvas')
    const x = c.getContext('2d')
    x.font = font
    const m = x.measureText(text)
    const textW = m.actualBoundingBoxLeft != null
      ? m.actualBoundingBoxLeft + m.actualBoundingBoxRight
      : m.width
    c.width = Math.ceil(textW) + 24
    c.height = 48
    x.font = font
    x.fillStyle = '#fff'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText(text, c.width / 2, c.height / 2)
    const map = new THREE.CanvasTexture(c)
    map.minFilter = THREE.LinearFilter
    map.generateMipmaps = false
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map, color: GRAPH_STYLE.label.clone(), transparent: true, depthWrite: false, opacity: 0
    }))
    sprite.center.set(0.5, 1)
    sprite.renderOrder = 2
    return { sprite, aspect: c.width / c.height }
  }

  // onPick(node, aberta): avisado a cada clique numa pasta; aberta = null quando ela não tem subpastas
  constructor (container, graph, { onPick, onContextMenu } = {}) {
    this.container = container
    this.graph = graph
    this.onPick = onPick
    this.onContextMenu = onContextMenu
    this.customColors = new Map() // nodeId -> THREE.Color
    this.topicNodeColors = null   // Map<nodeId, THREE.Color> — per-node topic colors
    this.topicDim = 0             // 0..1 lerped dim factor for non-topic nodes
    this.thinking = false         // true while AI is processing
    this.thinkingIntensity = 0    // 0..1 lerped
    this.thinkingNodes = null     // Map<nodeId, THREE.Color> — nodes to pulse during thinking
    this.expanded = false
    this.zoom = 1
    this.rotX = 0.35
    this.rotY = 0
    this.spinX = 0
    this.spinY = 0
    this.heat = 1
    this.hovered = null
    this.drag = null
    this.fitted = false
    this.pointer = new THREE.Vector2(-10, -10)
    this.entries = new Map()
    this.pulses = new Map()   // nodeId -> timestamp do início do pulse
    this.links = []
    this.listeners = []
    this.focusTarget = new THREE.Vector3()
    this.focusPos = new THREE.Vector3()
    this.tmp = { v: new THREE.Vector3(), d: new THREE.Vector3(), up: new THREE.Vector3(), q: new THREE.Quaternion() }

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(GRAPH_STYLE.fog, 100, 1000)
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 20000)
    this.camera.position.set(0, 0, 300)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.canvas = this.renderer.domElement
    container.replaceChildren(this.canvas)
    this.world = new THREE.Group()
    this.scene.add(this.world)

    this.disk = Graph3DRenderer.circleTexture(false)
    this.ring = Graph3DRenderer.circleTexture(true)
    this.glow = Graph3DRenderer.glowTexture()
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false
    }))
    this.lines.frustumCulled = false
    this.world.add(this.lines)

    this.sync()
    this.bind()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.loop = this.loop.bind(this)
    this.frame = requestAnimationFrame(this.loop)
  }

  // Ajusta a cena aos ramos abertos: pastas novas nascem junto do pai e se acomodam pelo layout.
  sync () {
    const visible = this.graph.visible()
    const ids = new Set(visible.map(n => n.id))
    for (const [id, e] of this.entries) {
      if (!ids.has(id)) { this.drop(e); this.entries.delete(id) }
    }
    for (const node of visible) {
      let e = this.entries.get(node.id)
      if (!e) {
        const from = node.parent && this.entries.get(node.parent.id)
        const pos = from ? from.pos.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(6)) : new THREE.Vector3()
        e = this.makeEntry(node, pos)
        this.entries.set(node.id, e)
      } else if (e.node !== node) {
        // mesma pasta numa árvore recarregada: mantém a posição, atualiza dados e tamanho
        e.node = node
        e.r = Graph3DRenderer.radius(node)
        e.sprite.scale.setScalar(e.r * 2)
      }
      e.ring.visible = node.isFile || (node.children.length > 0 && !this.graph.isOpen(node))
    }
    if (this.hovered && !this.entries.has(this.hovered.node.id)) this.hovered = null

    this.links = visible.filter(n => n.parent).map(n => [this.entries.get(n.parent.id), this.entries.get(n.id)])
    this.linePos = new Float32Array(this.links.length * 6)
    this.lineCol = new Float32Array(this.links.length * 6)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.lineCol, 3))
    this.lines.geometry.dispose()
    this.lines.geometry = geometry
    this.applyCustomColors()
    this.heat = 1
  }

  static radius (node) {
    if (node.isFile) return 1.5
    return node.depth === 0 ? 5 : 2 + Math.min(Math.sqrt(node.weight) * 0.6, 3.5)
  }

  // Pastas que já existiam mantêm o estado aberto/fechado; pastas novas seguem o padrão da árvore.
  setGraph (graph) {
    const known = new Set(this.graph.nodes.map(n => n.id))
    const ids = new Set(graph.nodes.map(n => n.id))
    graph.expanded = new Set([
      ...[...this.graph.expanded].filter(id => ids.has(id)),
      ...[...graph.expanded].filter(id => !known.has(id))
    ])
    this.graph = graph
    this.sync()
  }

  makeEntry (node, pos) {
    const branch = Graph3DRenderer.memoryDepth(node)
    const memory = branch === 0
    const config = Graph3DRenderer.isConfigFolder(node)
    const skills = Graph3DRenderer.isSkillsFolder(node)
    const r = Graph3DRenderer.radius(node)
    const base = node.isFile
      ? GRAPH_STYLE.file
      : branch >= 0
        ? Graph3DRenderer.memoryColor(branch)
        : skills
          ? GRAPH_STYLE.skills.clone()
          : config
            ? GRAPH_STYLE.config.clone()
            : node.depth === 0
              ? GRAPH_STYLE.root
              : GRAPH_STYLE.node
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.disk, color: base.clone(), transparent: true, depthWrite: false
    }))
    sprite.scale.setScalar(r * 2)
    sprite.position.copy(pos)
    sprite.renderOrder = 1
    const ringColor = node.isFile ? new THREE.Color('#4a9a8a') : GRAPH_STYLE.node.clone()
    const ringOpacity = node.isFile ? 0.18 : 0.6
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.ring, color: ringColor, transparent: true, depthWrite: false, opacity: ringOpacity
    }))
    ring.scale.setScalar(node.isFile ? 2.2 : 1.9)
    ring.renderOrder = 1
    sprite.add(ring)
    let glow = null
    if (memory) {
      glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glow, color: GRAPH_STYLE.memory.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      }))
      glow.renderOrder = 0
      sprite.add(glow)
    }
    const label = Graph3DRenderer.makeLabel(node.name)
    if (node.isFile) label.sprite.material.color.copy(GRAPH_STYLE.fileLabel)
    else if (memory) label.sprite.material.color.copy(GRAPH_STYLE.memoryLabel)
    else if (skills) label.sprite.material.color.copy(GRAPH_STYLE.skillsLabel)
    else if (config) label.sprite.material.color.copy(GRAPH_STYLE.configLabel)
    this.world.add(sprite, label.sprite)
    return {
      node, r, base, sprite, ring, glow, memory, config, skills, branch,
      pos: sprite.position,
      vel: new THREE.Vector3(),
      label: label.sprite,
      aspect: label.aspect,
      alpha: 0,
      labelAlpha: 0
    }
  }

  // Aplica cor personalizada a um nó e todos os filhos (recursivo)
  setFolderColor (nodeId, hexColor) {
    if (hexColor) {
      this.customColors.set(nodeId, new THREE.Color(hexColor))
    } else {
      this.customColors.delete(nodeId)
    }
    // aplica ao nó e filhos visíveis
    const applyToTree = id => {
      const e = this.entries.get(id)
      if (!e) return
      const c = hexColor ? new THREE.Color(hexColor) : null
      if (c) { e.base = c.clone(); e.customColor = c }
      else { delete e.customColor }
      for (const child of e.node.children) {
        if (hexColor) this.customColors.set(child.id, new THREE.Color(hexColor))
        else this.customColors.delete(child.id)
        applyToTree(child.id)
      }
    }
    applyToTree(nodeId)
  }

  // Restaura cores customizadas após sync (quando entries são recriadas)
  applyCustomColors () {
    for (const [id, color] of this.customColors) {
      const e = this.entries.get(id)
      if (e) { e.base = color.clone(); e.customColor = color }
    }
  }

  // Highlight nodes belonging to one or more topics.
  // nodeColorMap = Map<nodeId, hexColorString> — each node gets its own topic color.
  // Ancestors of highlighted nodes inherit the color of the first child that adds them.
  setTopicHighlight (nodeColorMap) {
    const full = new Map() // Map<nodeId, THREE.Color>
    const softRed = new THREE.Color('#c45c5c')
    for (const [id, hex] of nodeColorMap) {
      // mistura a cor do tópico com um vermelho suave e dessatura
      const raw = new THREE.Color(hex)
      const c = raw.lerp(softRed, 0.6)
      const hsl = {}; c.getHSL(hsl)
      c.setHSL(hsl.h, hsl.s * 0.5, hsl.l * 0.85)
      if (!full.has(id)) full.set(id, c)
      // trail: ancestor folders get the same color (first topic wins)
      const e = this.entries.get(id)
      if (!e) continue
      for (let n = e.node.parent; n; n = n.parent) {
        if (!full.has(n.id)) full.set(n.id, c)
      }
    }
    this.topicNodeColors = full
    this.topicDim = 0 // will lerp toward 1
  }

  clearTopicHighlight () {
    this.topicNodeColors = null
    this.topicDim = 0
  }

  setThinking (on, nodeColorMap) {
    if (on && this.thinking && this.thinkingNodes) return // already active, skip rebuild
    this.thinking = on
    if (on && nodeColorMap) {
      // expand with ancestors like setTopicHighlight
      const full = new Map()
      for (const [id, val] of nodeColorMap) {
        const hot = new THREE.Color(val.hot)
        const base = new THREE.Color(val.base)
        if (!full.has(id)) full.set(id, { hot, base })
        const e = this.entries.get(id)
        if (!e) continue
        for (let n = e.node.parent; n; n = n.parent) {
          if (!full.has(n.id)) full.set(n.id, { hot, base })
        }
      }
      this.thinkingNodes = full
    }
  }

  drop (e) {
    this.world.remove(e.sprite, e.label)
    e.sprite.material.dispose()
    e.ring.material.dispose()
    e.glow?.material.dispose()
    e.label.material.map.dispose()
    e.label.material.dispose()
  }

  // Layout por forças: repulsão entre todas as pastas, mola nas ligações, leve atração ao centro.
  simulate () {
    if (this.heat < 0.004) return
    const list = [...this.entries.values()]
    const d = this.tmp.d
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        d.subVectors(list[i].pos, list[j].pos)
        const l2 = Math.max(d.lengthSq(), 9)
        d.multiplyScalar(1800 / (l2 * Math.sqrt(l2)))
        list[i].vel.add(d)
        list[j].vel.sub(d)
      }
    }
    for (const [a, b] of this.links) {
      d.subVectors(b.pos, a.pos)
      const l = Math.max(d.length(), 0.01)
      d.multiplyScalar(((l - 40) / l) * 0.1)
      a.vel.add(d)
      b.vel.sub(d)
    }
    for (const e of list) {
      if (e.node.depth === 0) { e.pos.set(0, 0, 0); e.vel.set(0, 0, 0); continue }
      e.vel.addScaledVector(e.pos, -0.01).multiplyScalar(0.5).clampLength(0, 10)
      e.pos.addScaledVector(e.vel, this.heat)
    }
    this.heat *= 0.985
  }

  // A pasta mais próxima do cursor (até 12 px) fica destacada.
  pick () {
    if (this.pointer.x < -1.5 || this.drag?.moved > 4) return null
    let best = null
    let bestD = 144
    for (const e of this.entries.values()) {
      const v = this.tmp.v.copy(e.pos).applyMatrix4(this.world.matrixWorld).project(this.camera)
      if (v.z > 1) continue
      const dx = (v.x - this.pointer.x) * this.width / 2
      const dy = (v.y - this.pointer.y) * this.height / 2
      const dist = dx * dx + dy * dy
      if (dist < bestD) { bestD = dist; best = e }
    }
    return best
  }

  loop (t) {
    this.frame = requestAnimationFrame(this.loop)
    if (!this.width || this.container.offsetParent === null) return
    this.simulate()

    if (!this.drag) {
      const spinning = Math.abs(this.spinY) > 0.0005 || Math.abs(this.spinX) > 0.0005
      if (spinning || this.expanded) {
        this.rotY += this.spinY
        this.rotX += this.spinX
        this.spinY *= 0.92
        this.spinX *= 0.92
      }
      if (!this.expanded && !spinning) {
        this.rotY += 0.003
        this.rotX += (0.35 + Math.sin(t / 4000) * 0.12 - this.rotX) * 0.02
      }
    }
    this.rotX = THREE.MathUtils.clamp(this.rotX, -1.3, 1.3)
    this.world.rotation.set(this.rotX, this.rotY, 0)
    // interpola foco suavemente para o nó clicado
    this.focusPos.lerp(this.focusTarget, 0.06)
    this.world.position.copy(this.focusPos).negate().applyEuler(this.world.rotation)
    this.world.updateMatrixWorld()

    let radius = 12
    for (const e of this.entries.values()) radius = Math.max(radius, this.tmp.v.copy(e.pos).sub(this.focusPos).length() + e.r)
    const half = THREE.MathUtils.degToRad(this.camera.fov / 2)
    const target = radius * 1.08 / Math.sin(half) / Math.min(1, this.camera.aspect) / this.zoom
    this.camera.position.z = this.fitted ? this.camera.position.z + (target - this.camera.position.z) * 0.08 : target
    this.fitted = true
    const camZ = this.camera.position.z
    this.scene.fog.near = Math.max(1, camZ - radius)
    this.scene.fog.far = camZ + radius * 3.5

    this.hovered = this.pick()
    const hovered = this.hovered
    this.canvas.style.cursor = hovered?.node.parent ? 'pointer' : ''
    const hot = new Set()
    if (hovered) {
      hot.add(hovered)
      if (hovered.node.parent) hot.add(this.entries.get(hovered.node.parent.id))
      for (const c of hovered.node.children) if (this.entries.has(c.id)) hot.add(this.entries.get(c.id))
    }

    // topic highlight: lerp dim factor toward 1 when active, 0 when inactive
    const topicActive = this.topicNodeColors != null
    this.topicDim += ((topicActive ? 1 : 0) - this.topicDim) * 0.1
    // thinking intensity: ramps up fast, fades out slowly
    const tkTarget = this.thinking ? 1 : 0
    this.thinkingIntensity += (tkTarget - this.thinkingIntensity) * (this.thinking ? 0.12 : 0.03)
    if (!this.thinking && this.thinkingIntensity < 0.01) this.thinkingNodes = null

    const up = this.tmp.up.set(0, 1, 0).applyQuaternion(this.tmp.q.copy(this.world.quaternion).invert())
    for (const e of this.entries.values()) {
      const isHot = hot.has(e)
      const nodeTopicColor = topicActive ? this.topicNodeColors.get(e.node.id) : null
      const inTopic = nodeTopicColor != null
      // opacity: topic files = full, non-topic = dimmed but visible (0.25)
      const hoverAlpha = !hovered || isHot ? 1 : 0.18
      const topicAlpha = inTopic ? 1 : 0.25
      const blendedTarget = this.topicDim > 0.01 ? topicAlpha * (1 - (1 - hoverAlpha) * (hovered ? 1 : 0)) : hoverAlpha
      e.alpha += (blendedTarget - e.alpha) * 0.15
      e.sprite.material.opacity = e.alpha
      e.ring.material.opacity = e.alpha * 0.6
      // color: topic nodes get their per-node topic color
      const topicBase = inTopic ? nodeTopicColor.clone() : null
      const hotColor = e.customColor ? e.customColor.clone().lerp(new THREE.Color('#fff'), 0.08) : topicBase ? topicBase.clone().lerp(new THREE.Color('#fff'), 0.08) : GRAPH_STYLE.near
      // when topic is active, blend the node base color toward its topic color (soft red tint)
      const effectiveBase = topicBase && this.topicDim > 0.01 ? e.base.clone().lerp(topicBase, this.topicDim * 0.35) : e.base
      // pulse: esfera pisca verde por 1.6 s quando o arquivo muda no disco
      const pulseStart = this.pulses.get(e.node.id)
      const pulseT = pulseStart ? (t - pulseStart) / 1600 : -1
      if (pulseT >= 0 && pulseT < 1) {
        const intensity = Math.cos(pulseT * Math.PI * 3) * 0.5 + 0.5
        const scale = 1 + 0.16 * intensity * (1 - pulseT)
        e.sprite.scale.setScalar(e.r * 2 * scale)
        e.sprite.material.color.lerp(GRAPH_STYLE.pulse, intensity * (1 - pulseT) * 0.12)
      } else {
        if (pulseT >= 1) this.pulses.delete(e.node.id)
        e.sprite.material.color.lerp(isHot && hovered ? hotColor : effectiveBase, 0.2)
      }
      // thinking: subtle glow on matched nodes — additive, doesn't change others
      const tk = this.thinkingIntensity
      const thinkEntry = this.thinkingNodes ? this.thinkingNodes.get(e.node.id) : null
      const isThinking = thinkEntry != null && tk > 0.02
      if (isThinking && (pulseT < 0 || pulseT >= 1)) {
        const wave = (Math.sin(t / 450 - e.node.depth * 0.9) + 1) / 2
        const thinkPulse = wave * tk
        // pico = vermelho, vale = cor do tópico (roxo, verde etc)
        const blended = thinkEntry.base.clone().lerp(thinkEntry.hot, thinkPulse * 0.22)
        e.sprite.scale.setScalar(e.r * 2 * (1 + 0.16 * thinkPulse))
        e.sprite.material.color.copy(blended)
        e.sprite.material.opacity = Math.min(1, e.alpha + 0.14 * thinkPulse)
        e.ring.material.color.copy(blended)
        e.ring.material.opacity = Math.min(1, 0.3 + 0.14 * thinkPulse)
        e.ring.visible = true
      }
      if (e.memory) {
        // a esfera e o brilho "respiram" juntos, devagar (~3,5 s)
        const breath = (Math.sin(t / 560) + 1) / 2
        if (pulseT < 0 || pulseT >= 1) e.sprite.scale.setScalar(e.r * 2 * (1 + 0.08 * breath))
        e.glow.material.opacity = e.alpha * (0.14 + 0.16 * breath)
        e.glow.scale.setScalar(2.3 + 0.7 * breath)
      } else if (e.node.isFile && (pulseT < 0 || pulseT >= 1) && !isThinking) {
        // topic files breathe gently when highlighted
        if (inTopic && this.topicDim > 0.5) {
          const topicBreath = (Math.sin(t / 700 + e.r * 10) + 1) / 2
          e.sprite.scale.setScalar(e.r * 2 * (1 + 0.06 * topicBreath * this.topicDim))
        } else {
          e.sprite.scale.setScalar(e.r * 2)
        }
      }

      const deep = this.expanded || this.zoom >= 1.8
      const veryClose = this.zoom >= 2.5
      let labelTgt
      if (hovered) {
        labelTgt = isHot ? 1 : 0.1
      } else if (topicActive && this.topicDim > 0.3) {
        if (e.node.isFile) {
          labelTgt = inTopic && veryClose ? 0.85 : 0
        } else {
          labelTgt = inTopic && e.node.depth <= 2 ? (deep ? 0.7 : 0.5) : 0
        }
      } else {
        // sem tópico: só pastas de nível 1 quando zoom médio, nível 2 quando muito perto
        if (e.node.isFile) {
          labelTgt = 0
        } else if (e.node.depth <= 1) {
          labelTgt = deep ? 0.7 : this.zoom >= 1.3 ? 0.5 : 0
        } else if (e.node.depth === 2) {
          labelTgt = veryClose ? 0.5 : 0
        } else {
          labelTgt = 0
        }
      }
      e.labelAlpha += (labelTgt - e.labelAlpha) * 0.15
      e.label.material.opacity = e.labelAlpha
      const labelTarget = e === hovered ? GRAPH_STYLE.root : topicBase ? topicBase.clone().lerp(new THREE.Color('#fff'), 0.15) : e.customColor ? e.customColor.clone().lerp(new THREE.Color('#fff'), 0.4) : e.node.isFile ? GRAPH_STYLE.fileLabel : e.memory ? GRAPH_STYLE.memoryLabel : e.skills ? GRAPH_STYLE.skillsLabel : e.config ? GRAPH_STYLE.configLabel : GRAPH_STYLE.label
      e.label.material.color.lerp(labelTarget, 0.2)
      e.label.visible = e.labelAlpha > 0.02
      if (e.label.visible) {
        const dist = this.tmp.v.copy(e.pos).applyMatrix4(this.world.matrixWorld).distanceTo(this.camera.position)
        const perPx = 2 * dist * Math.tan(half) / this.height
        const px = this.expanded ? 16 : 13
        e.label.scale.set(px * perPx * e.aspect, px * perPx, 1)
        e.label.position.copy(e.pos).addScaledVector(up, -(e.r * 1.1 + perPx * 2))
      }
    }

    const tkLinks = this.thinkingIntensity
    this.links.forEach(([a, b], k) => {
      a.pos.toArray(this.linePos, k * 6)
      b.pos.toArray(this.linePos, k * 6 + 3)
      let c
      // thinking: links between thinking nodes glow bright
      const aThink = this.thinkingNodes ? this.thinkingNodes.get(a.node.id) : null
      const bThink = this.thinkingNodes ? this.thinkingNodes.get(b.node.id) : null
      if (aThink && bThink && tkLinks > 0.02) {
        const wave = (Math.sin(t / 450 - b.node.depth * 0.9) + 1) / 2
        c = aThink.base.clone().lerp(aThink.hot, wave * tkLinks)
      } else if (hovered) {
        c = a === hovered || b === hovered ? GRAPH_STYLE.linkHot : GRAPH_STYLE.linkDim
      } else if (topicActive && this.topicDim > 0.3) {
        const aColor = this.topicNodeColors.get(a.node.id)
        const bColor = this.topicNodeColors.get(b.node.id)
        c = aColor && bColor ? aColor : GRAPH_STYLE.linkDim
      } else {
        c = b.branch >= 0 ? GRAPH_STYLE.linkMemory : GRAPH_STYLE.link
      }
      c.toArray(this.lineCol, k * 6)
      c.toArray(this.lineCol, k * 6 + 3)
    })
    this.lines.geometry.attributes.position.needsUpdate = true
    this.lines.geometry.attributes.color.needsUpdate = true

    this.renderer.render(this.scene, this.camera)
  }

  on (target, type, fn, opts) {
    target.addEventListener(type, fn, opts)
    this.listeners.push([target, type, fn, opts])
  }

  bind () {
    const toNdc = e => {
      const r = this.canvas.getBoundingClientRect()
      this.pointer.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    }
    this.on(this.canvas, 'pointerdown', e => {
      toNdc(e)
      this.drag = { x: e.clientX, y: e.clientY, moved: 0 }
      this.canvas.setPointerCapture(e.pointerId)
    })
    this.on(this.canvas, 'pointermove', e => {
      toNdc(e)
      if (!this.drag) return
      const dx = e.clientX - this.drag.x
      const dy = e.clientY - this.drag.y
      this.drag.x = e.clientX
      this.drag.y = e.clientY
      this.drag.moved += Math.abs(dx) + Math.abs(dy)
      this.spinY = dx * 0.006
      this.spinX = dy * 0.006
      this.rotY += this.spinY
      this.rotX += this.spinX
    })
    this.on(this.canvas, 'pointerup', () => {
      const click = this.drag && this.drag.moved < 5
      this.drag = null
      const target = click && this.pick()
      if (!target) return
      this.focusTarget.copy(target.pos)
      if (this.graph.toggle(target.node)) this.sync()
      this.onPick?.(target.node, target.node.children.length ? this.graph.isOpen(target.node) : null)
    })
    this.on(this.canvas, 'contextmenu', e => {
      e.preventDefault()
      const target = this.pick()
      if (target && !target.node.isFile) this.onContextMenu?.(e, target.node)
    })
    this.on(this.canvas, 'pointerleave', () => { if (!this.drag) this.pointer.set(-10, -10) })
    this.on(this.canvas, 'wheel', e => {
      e.preventDefault()
      this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(-e.deltaY * 0.0015), 0.4, 5)
    }, { passive: false })
    this.on(this.canvas, 'dblclick', () => { this.zoom = 1; this.focusTarget.set(0, 0, 0) })
  }

  resize () {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.width = w
    this.height = h
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  setExpanded (expanded) {
    this.expanded = expanded
    if (!expanded) { this.spinX = 0; this.spinY = 0 }
    this.resize()
  }

  // Faz a esfera de um nó pulsar (verde, 1.6 s). nodeId = ex: "computer-science/files/notas.md"
  pulse (nodeId) {
    if (this.entries.has(nodeId)) this.pulses.set(nodeId, performance.now())
  }

  applyTheme (isDark) {
    GRAPH_STYLE = getGraphStyle(isDark)
    this.scene.fog.color.setHex(GRAPH_STYLE.fog)
    // reset all entity base colors
    for (const e of this.entries.values()) {
      const base = e.customColor ? e.customColor
        : e.node.isFile ? GRAPH_STYLE.file
        : e.skills ? GRAPH_STYLE.skills.clone()
        : e.config ? GRAPH_STYLE.config.clone()
        : e.node.depth === 0 ? GRAPH_STYLE.root
        : GRAPH_STYLE.node
      e.base = base.clone()
      e.sprite.material.color.copy(e.base)
    }
  }

  dispose () {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    for (const [target, type, fn, opts] of this.listeners) target.removeEventListener(type, fn, opts)
    for (const e of this.entries.values()) this.drop(e)
    this.entries.clear()
    this.lines.geometry.dispose()
    this.lines.material.dispose()
    this.disk.dispose()
    this.ring.dispose()
    this.glow.dispose()
    this.renderer.dispose()
    this.canvas.remove()
  }
}

if (typeof module !== 'undefined') module.exports = Graph3DRenderer
