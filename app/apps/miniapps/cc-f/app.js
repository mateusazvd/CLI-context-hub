// Painel de Estudos — Faculdade (cronograma + pesquisas) + Gerais (pesquisas)
// Dados salvos em data.json (sincroniza via git push/pull)

const $ = id => document.getElementById(id)
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

const CURRENT_SEMESTER = '5º Semestre'

// ── Dados iniciais do plano de estudos (semestre 2026.3) ──
const DEFAULT_SUBJECTS = [
  {
    semester: CURRENT_SEMESTER,
    name: 'Cálculo Diferencial e Integral', code: 'DGT0119',
    themes: [
      { name: 'Tema 2 — Limite: conceitos, propriedades e exemplos', topics: [
        'O limite de uma função real: noção intuitiva, notação simbólica, definição formal',
        'Continuidade e cálculo de limites: função contínua, propriedades operatórias, teorema do sanduíche',
        'O infinito e o comportamento de funções: limites no infinito, limites infinitos, assíntotas'
      ]},
      { name: 'Tema 3 — Derivadas: conceitos, propriedades e cálculos', topics: [
        'Derivada de uma função real: visão geométrica, abordagem gráfica e analítica',
        'Regras de derivação: cálculo pelo limite, regras, derivada das principais funções',
        'Regra da cadeia: derivada da função composta',
        'Derivação implícita e de ordem superior'
      ]},
      { name: 'Tema 4 — Derivadas: aplicações', topics: [
        'Retas tangentes e normais: derivada como coeficiente angular',
        'Taxas de variação e taxas relacionadas',
        'Estudo de funções: crescimento, concavidade, extremos locais',
        'Pontos críticos, máximos e mínimos globais (otimização)'
      ]},
      { name: 'Tema 5 — Integrais: conceitos, propriedades e técnicas', topics: [
        'Integral indefinida, integral definida e teorema fundamental do cálculo',
        'Integração por substituição de variável',
        'Integração por partes',
        'Integração por frações parciais'
      ]},
      { name: 'Tema 6 — Integrais: aplicações', topics: [
        'Comprimento de arcos de curva e função comprimento de arco',
        'Áreas: de uma função, entre funções, de superfície de revolução',
        'Volumes: sólido de rotação'
      ]}
    ]
  },
  {
    semester: CURRENT_SEMESTER,
    name: 'Análise de Dados', code: 'DGT0229',
    themes: [
      { name: 'Tema 2 — Análise de dados quantitativos', topics: [
        'Ferramentas de análise exploratória: conceitos preliminares, representações gráficas',
        'Medidas de posição: média, mediana, moda, separatrizes',
        'Medidas de dispersão: variância, desvio-padrão'
      ]},
      { name: 'Tema 3 — Probabilidades', topics: [
        'Fundamentos: o que é probabilidade, operações com eventos, partição do espaço amostral',
        'Princípios de contagem e análise combinatória',
        'Regras: adição e multiplicação (independência estatística)',
        'Eventos condicionais: probabilidade condicional, teorema de Bayes'
      ]},
      { name: 'Tema 4 — Variáveis aleatórias discretas', topics: [
        'Variáveis aleatórias, função de probabilidade, esperança matemática',
        'Distribuições de Bernoulli e binomial',
        'Distribuições geométrica e hipergeométrica',
        'Distribuição de Poisson e aproximação da binomial pela Poisson'
      ]},
      { name: 'Tema 5 — Variáveis aleatórias contínuas', topics: [
        'Discreta x contínua, esperança e desvio-padrão',
        'Distribuição uniforme: esperança e variância',
        'Distribuição exponencial: esperança e variância',
        'Distribuição normal (gaussiana) e aplicações'
      ]},
      { name: 'Tema 6 — Testes de hipótese', topics: [
        'Intervalos de confiança: construção, pequenas amostras',
        'Testes de hipótese: introdução, erros, estatística de teste, p-valor'
      ]}
    ]
  },
  {
    semester: CURRENT_SEMESTER,
    name: 'Geometria Analítica e Álgebra Linear', code: 'DGT0228',
    themes: [
      { name: 'Tema 2 — Vetores e espaços vetoriais', topics: [
        'O vetor e operações básicas: espaço vetorial, operações',
        'Vetor no plano e no espaço: vetores 2D e 3D, módulo, versor',
        'Produtos: escalar (interno), vetorial (externo), misto',
        'Ângulo entre vetores: projeção, paralelismo e ortogonalidade'
      ]},
      { name: 'Tema 3 — Retas e planos', topics: [
        'Equações da reta: no plano, reduzida, vetorial, paramétrica',
        'Interação entre retas: posições relativas, interseção, ângulos',
        'Plano: equação geral, vetorial, paramétrica, posições relativas',
        'Distâncias: entre pontos, ponto e plano, ponto e reta'
      ]},
      { name: 'Tema 4 — Seções cônicas', topics: [
        'Parábola: definição, equação reduzida e geral, pontos, interseções',
        'Elipse e circunferência: equação reduzida e geral',
        'Hipérbole: equação reduzida e geral',
        'Equação geral das cônicas'
      ]},
      { name: 'Tema 5 — Matrizes e determinantes', topics: [
        'Matrizes: definição, representação, classificação',
        'Operações: multiplicação por escalar, soma, subtração, multiplicação, transposição',
        'Determinantes: para n < 4, teorema de Laplace, propriedades',
        'Matriz inversa e suas propriedades'
      ]},
      { name: 'Tema 6 — Sistemas de equações e transformações lineares', topics: [
        'Equações lineares: definição e classificação dos sistemas',
        'Métodos de resolução: Gauss-Jordan, regra de Cramer',
        'Transformação linear: definição, transformações no plano, ortogonais',
        'Autovalor e autovetor'
      ]}
    ]
  },
  {
    semester: CURRENT_SEMESTER,
    name: 'Algoritmos e Complexidade', code: 'DGT1348',
    themes: [
      { name: 'Tema 2 — Análise de algoritmo', topics: [
        'Sub-rotinas, decomposição de problemas, parametrização',
        'Estruturas de dados: arranjo unidimensional, registros, ponteiros',
        'Notação O (Big O): eficiência, análise de algoritmos, cota superior',
        'Análise da complexidade: princípios, complexidades pessimistas'
      ]},
      { name: 'Tema 3 — Recursividade', topics: [
        'Definição: sequências, funções, conjuntos',
        'Recursivo x iterativo, as três leis da recursão, tipos de recursividade',
        'Exemplos de funções recursivas'
      ]},
      { name: 'Tema 4 — Algoritmos de ordenação avançados', topics: [
        'Ordenação elementar: bubble sort, insertion sort, selection sort',
        'Merge sort: características, execução, implementação, complexidade',
        'Quick sort: particionamento, execução, implementação, complexidade',
        'Shell sort: características, comparação entre algoritmos'
      ]},
      { name: 'Tema 5 — Árvores binárias e AVL', topics: [
        'Percursos em árvores binárias e algoritmos recursivos de percurso',
        'Árvores binárias de busca: busca, inserção, remoção',
        'Árvore balanceada e algoritmo DSW',
        'Árvores AVL: busca, inserção, remoção, complexidade'
      ]},
      { name: 'Tema 6 — Algoritmos em grafos', topics: [
        'Conceitos básicos: definições, teorema da soma dos graus, tipos especiais',
        'Representações de grafos',
        'Busca em grafos: profundidade e largura',
        'Custo mínimo em grafo ponderado, problema do caixeiro-viajante'
      ]}
    ]
  },
  {
    semester: CURRENT_SEMESTER,
    name: 'Processamento Paralelo e Distribuído em B.D.', code: 'DGT1429',
    themes: [
      { name: 'Tema 2 — Sistemas de banco de dados distribuídos', topics: [
        'Distribuição em sistemas computacionais: fundamentos, virtualização, nuvem',
        'Sistemas de banco de dados: dados e informação, arquitetura e usuários',
        'Banco de dados distribuídos (BDD): características do SBDD, SGBDD',
        'Arquiteturas: centralizado x distribuído'
      ]},
      { name: 'Tema 3 — Projeto de banco de dados distribuídos', topics: [
        'Fundamentos de projeto: descrições de banco de dados, técnicas de projeto',
        'Fragmentação: princípios, horizontal, vertical, híbrida',
        'Replicação: fundamentos, extratos, réplicas',
        'Modelagem e implementação: esquema conceitual global, bancos locais'
      ]},
      { name: 'Tema 4 — Implementação de BDD', topics: [
        'Transação distribuída: fundamentos, controle de transações locais e globais',
        'Controle de concorrência: transações concorrentes',
        'Consultas distribuídas: locais e globais',
        'SQL em consultas distribuídas: dblink no PostgreSQL'
      ]},
      { name: 'Tema 5 — Bancos de dados paralelos', topics: [
        'Paralelismo em sistemas computacionais: processamento paralelo, arquiteturas',
        'Bancos de dados paralelos: paralelismo de E/S, consultas paralelas',
        'Execução de consultas paralelas: intra/interoperações, otimização',
        'Bancos em cluster: cluster e grid, implementação com PostgreSQL'
      ]}
    ]
  }
]

// ── Estado ──
let data = { agenda: [], studyPlan: null, generalTopics: [] }
let editing = null

// ── Persistência ──
async function loadData () {
  try {
    const saved = window.miniappData ? await window.miniappData.load() : null
    if (saved) {
      data = saved
      if (!data.studyPlan) data.studyPlan = buildDefaultPlan()
      if (!data.agenda) data.agenda = []
      if (!data.generalTopics) data.generalTopics = []
    } else {
      data = { agenda: [], studyPlan: buildDefaultPlan(), generalTopics: [] }
    }
  } catch (err) {
    console.error('[cc-f] loadData falhou:', err)
    data = { agenda: [], studyPlan: buildDefaultPlan(), generalTopics: [] }
  }
}

async function saveData () {
  try {
    if (window.miniappData) await window.miniappData.save(data)
  } catch (err) {
    console.error('[cc-f] saveData falhou:', err)
  }
}

function buildDefaultPlan () {
  return DEFAULT_SUBJECTS.map(s => ({
    semester: s.semester, name: s.name, code: s.code,
    themes: s.themes.map(t => ({
      name: t.name,
      topics: t.topics.map(text => ({ text, done: false }))
    }))
  }))
}

// ── Main tabs (Faculdade / Gerais) ──
document.querySelectorAll('.main-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.main-tab').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.main-content').forEach(s => s.classList.add('hidden'))
    btn.classList.add('active')
    $(`main-${btn.dataset.main}`).classList.remove('hidden')
  })
})

// ── Sub tabs (within Faculdade) ──
document.querySelectorAll('.sub-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const parent = btn.closest('.main-content')
    parent.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'))
    parent.querySelectorAll('.sub-content').forEach(s => s.classList.add('hidden'))
    btn.classList.add('active')
    $(`sub-${btn.dataset.sub}`).classList.remove('hidden')
  })
})

// ══════════════════════════════════════════
// SEMESTRES E SELECTS
// ══════════════════════════════════════════

function allSemesters () {
  const set = new Set()
  for (const ev of (data.agenda || [])) if (ev.semester) set.add(ev.semester)
  for (const s of (data.studyPlan || [])) if (s.semester) set.add(s.semester)
  if (!set.size) set.add(CURRENT_SEMESTER)
  return [...set].sort()
}

function subjectsForSemester (semester) {
  const plan = data.studyPlan || []
  const matches = plan.filter(s => s.semester === semester)
  return matches.length ? matches.map(s => s.name) : plan.map(s => s.name)
}

function populateSelects () {
  const semesters = allSemesters()

  // agenda semester filter
  const as = $('agenda-semester')
  const asCur = as.value
  as.innerHTML = '<option value="all">Todos os semestres</option>'
  semesters.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; as.append(o) })
  if (asCur && asCur !== 'all') as.value = asCur

  // plano semester filter
  const ps = $('plano-semester')
  const psCur = ps.value
  ps.innerHTML = '<option value="all">Todos os semestres</option>'
  semesters.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; ps.append(o) })
  if (psCur && psCur !== 'all') ps.value = psCur

  // agenda subject filter
  const af = $('agenda-filter')
  const afCur = af.value
  af.innerHTML = '<option value="all">Todas as matérias</option>'
  const agendaSemester = as.value
  const afSubjects = agendaSemester !== 'all' ? subjectsForSemester(agendaSemester) : (data.studyPlan || []).map(s => s.name)
  afSubjects.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; af.append(o) })
  if (afCur && afCur !== 'all') af.value = afCur

  // plano subject filter
  const pf = $('plano-filter')
  const pfCur = pf.value
  pf.innerHTML = '<option value="all">Todas as matérias</option>'
  const planoSemester = ps.value
  const pfSubjects = planoSemester !== 'all' ? subjectsForSemester(planoSemester) : (data.studyPlan || []).map(s => s.name)
  pfSubjects.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; pf.append(o) })
  if (pfCur && pfCur !== 'all') pf.value = pfCur

  // dialog semester select
  const es = $('event-semester')
  const esCur = es.value
  es.innerHTML = ''
  semesters.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; es.append(o) })
  if (esCur) es.value = esCur

  updateDialogSubjects()
}

function updateDialogSubjects () {
  const semester = $('event-semester').value
  const subjects = subjectsForSemester(semester)
  const cur = $('event-subject').value
  $('event-subject').innerHTML = ''
  subjects.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; $('event-subject').append(o) })
  if (cur) $('event-subject').value = cur
}

$('event-semester').onchange = updateDialogSubjects
$('agenda-semester').onchange = () => { populateSelects(); renderAgenda() }
$('agenda-filter').onchange = renderAgenda
$('plano-semester').onchange = () => { populateSelects(); renderPlano() }
$('plano-filter').onchange = renderPlano

// ── Search debounce ──
let planoSearchTimer = null
$('plano-search').oninput = () => { clearTimeout(planoSearchTimer); planoSearchTimer = setTimeout(renderPlano, 200) }
let genSearchTimer = null
$('gen-search').oninput = () => { clearTimeout(genSearchTimer); genSearchTimer = setTimeout(renderGeneralTopics, 200) }

// ── Tag filter state ──
const activePlanoTags = new Set()
const activeGenTags = new Set()

// ══════════════════════════════════════════
// CRONOGRAMA (AGENDA)
// ══════════════════════════════════════════

function semesterHeader (label) {
  const h = document.createElement('div')
  h.className = 'semester-header'
  h.textContent = label
  return h
}

function renderAgenda () {
  const semFilter = $('agenda-semester').value
  const subjFilter = $('agenda-filter').value
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  let events = [...data.agenda]
  if (semFilter !== 'all') events = events.filter(e => (e.semester || CURRENT_SEMESTER) === semFilter)
  if (subjFilter !== 'all') events = events.filter(e => e.subject === subjFilter)

  const root = $('agenda-cards')
  root.innerHTML = ''
  $('agenda-empty').classList.toggle('hidden', events.length > 0)

  const bySemester = new Map()
  for (const ev of events) {
    const sem = ev.semester || CURRENT_SEMESTER
    if (!bySemester.has(sem)) bySemester.set(sem, [])
    bySemester.get(sem).push(ev)
  }

  const sortedSemesters = [...bySemester.keys()].sort((a, b) => b.localeCompare(a, 'pt-BR', { numeric: true }))

  for (const sem of sortedSemesters) {
    const semEvents = bySemester.get(sem).sort((a, b) => {
      const da = new Date(a.date), db = new Date(b.date)
      const aFuture = da >= now, bFuture = db >= now
      if (aFuture !== bFuture) return aFuture ? -1 : 1
      return aFuture ? da - db : db - da
    })

    root.append(semesterHeader(sem))

    for (const ev of semEvents) {
      const evDate = new Date(ev.date + 'T12:00:00')
      const diffMs = evDate - now
      const diffDays = Math.round(diffMs / 86400000)

      let countdownClass = 'upcoming'
      let daysText = `${diffDays}`
      let daysLabel = diffDays === 1 ? 'dia' : 'dias'
      if (diffDays < 0) { countdownClass = 'overdue'; daysText = `${Math.abs(diffDays)}`; daysLabel = Math.abs(diffDays) === 1 ? 'dia atrás' : 'dias atrás' }
      else if (diffDays === 0) { countdownClass = 'today'; daysText = 'Hoje'; daysLabel = '' }

      const dateStr = evDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
      const timeStr = ev.time || ''

      const card = document.createElement('div')
      card.className = 'event-card'
      card.innerHTML = `
        <div class="event-countdown ${countdownClass}">
          <div class="days">${daysText}</div>
          <div class="label">${daysLabel}</div>
        </div>
        <div class="event-info">
          <div class="event-title">${esc(ev.title)}</div>
          <div class="event-meta">${esc(ev.subject)} · ${dateStr}${timeStr ? ' · ' + timeStr : ''}</div>
          ${ev.notes ? `<div class="event-notes-preview">${esc(ev.notes)}</div>` : ''}
        </div>
        <span class="event-type ${ev.type}">${ev.type}</span>
      `
      card.onclick = () => openEventDialog(ev)
      root.append(card)
    }
  }
}

// ── Event Dialog ──
function openEventDialog (ev) {
  editing = ev || null
  $('event-dialog-title').textContent = ev ? 'Editar evento' : 'Novo evento'
  $('event-id').value = ev ? ev.id : ''
  $('event-title').value = ev ? ev.title : ''
  $('event-semester').value = ev ? (ev.semester || CURRENT_SEMESTER) : CURRENT_SEMESTER
  updateDialogSubjects()
  $('event-subject').value = ev ? ev.subject : ($('event-subject').options[0]?.value || '')
  $('event-type').value = ev ? ev.type : 'prova'
  $('event-date').value = ev ? ev.date : new Date().toISOString().slice(0, 10)
  $('event-time').value = ev ? (ev.time || '') : ''
  $('event-notes').value = ev ? (ev.notes || '') : ''
  $('delete-event').classList.toggle('hidden', !ev)
  $('event-dialog').showModal()
}

$('new-event').onclick = () => openEventDialog(null)
$('cancel-event').onclick = () => $('event-dialog').close()

$('delete-event').onclick = async () => {
  if (!editing) return
  data.agenda = data.agenda.filter(e => e.id !== editing.id)
  await saveData()
  editing = null
  $('event-dialog').close()
  renderAgenda()
}

$('event-form').onsubmit = async (e) => {
  e.preventDefault()
  const ev = {
    id: $('event-id').value || uid(),
    title: $('event-title').value.trim(),
    semester: $('event-semester').value,
    subject: $('event-subject').value,
    type: $('event-type').value,
    date: $('event-date').value,
    time: $('event-time').value || null,
    notes: $('event-notes').value.trim() || null
  }
  const idx = data.agenda.findIndex(x => x.id === ev.id)
  if (idx >= 0) data.agenda[idx] = ev
  else data.agenda.push(ev)
  await saveData()
  editing = null
  $('event-dialog').close()
  populateSelects()
  renderAgenda()
}

// ══════════════════════════════════════════
// PESQUISAS — FACULDADE
// ══════════════════════════════════════════

const expandedDiscs = new Set()

function collectPlanoTags () {
  const tags = new Set()
  for (const s of (data.studyPlan || [])) for (const t of (s.tags || [])) tags.add(t)
  return [...tags].sort()
}

function renderPlanoTagBar () {
  const bar = $('plano-tags')
  bar.innerHTML = ''
  const allTags = collectPlanoTags()
  if (!allTags.length) return
  for (const tag of allTags) {
    const pill = document.createElement('button')
    pill.className = 'tag-pill' + (activePlanoTags.has(tag) ? ' active' : '')
    pill.textContent = tag
    pill.onclick = () => { activePlanoTags.has(tag) ? activePlanoTags.delete(tag) : activePlanoTags.add(tag); renderPlano() }
    bar.append(pill)
  }
}

function renderPlano () {
  const semFilter = $('plano-semester').value
  const subjFilter = $('plano-filter').value
  const searchQuery = ($('plano-search').value || '').trim().toLowerCase()
  const root = $('plano-list')
  root.innerHTML = ''

  let subjects = data.studyPlan || []

  let totalTopics = 0, doneTopics = 0
  for (const s of subjects) {
    for (const t of s.themes) {
      for (const tp of t.topics) { totalTopics++; if (tp.done) doneTopics++ }
    }
  }
  const pct = totalTopics ? Math.round(doneTopics / totalTopics * 100) : 0
  $('plano-progress-text').textContent = `${pct}%`
  $('plano-bar-fill').style.width = `${pct}%`

  if (semFilter !== 'all') subjects = subjects.filter(s => (s.semester || CURRENT_SEMESTER) === semFilter)
  if (subjFilter !== 'all') subjects = subjects.filter(s => s.name === subjFilter)

  // filter by active tags
  if (activePlanoTags.size) {
    subjects = subjects.filter(s => {
      const sTags = s.tags || []
      return [...activePlanoTags].every(t => sTags.includes(t))
    })
  }

  // filter by search query
  if (searchQuery) {
    subjects = subjects.filter(s => {
      if (s.name.toLowerCase().includes(searchQuery)) return true
      if (s.code.toLowerCase().includes(searchQuery)) return true
      for (const t of s.themes) {
        if (t.name.toLowerCase().includes(searchQuery)) return true
        for (const tp of t.topics) if (tp.text.toLowerCase().includes(searchQuery)) return true
      }
      if ((s.tags || []).some(tag => tag.toLowerCase().includes(searchQuery))) return true
      return false
    })
  }

  renderPlanoTagBar()

  const bySemester = new Map()
  for (const s of subjects) {
    const sem = s.semester || CURRENT_SEMESTER
    if (!bySemester.has(sem)) bySemester.set(sem, [])
    bySemester.get(sem).push(s)
  }

  const sortedSemesters = [...bySemester.keys()].sort((a, b) => b.localeCompare(a, 'pt-BR', { numeric: true }))

  for (const sem of sortedSemesters) {
    root.append(semesterHeader(sem))

    for (const subj of bySemester.get(sem)) {
      let sTotal = 0, sDone = 0
      for (const t of subj.themes) for (const tp of t.topics) { sTotal++; if (tp.done) sDone++ }
      const sPct = sTotal ? Math.round(sDone / sTotal * 100) : 0
      const isOpen = expandedDiscs.has(subj.code)

      const tagsHtml = (subj.tags || []).map(t => `<span class="tag-inline">${esc(t)}</span>`).join('')

      const disc = document.createElement('div')
      disc.className = 'discipline'
      disc.innerHTML = `
        <div class="disc-header">
          <span class="disc-arrow ${isOpen ? 'open' : ''}">&#9654;</span>
          <span class="disc-title">${esc(subj.name)}${tagsHtml}</span>
          <button class="disc-tags-btn" title="Editar disciplina">&#9998;</button>
          <span class="disc-code">${esc(subj.code)}</span>
          <span class="disc-progress">${sDone}/${sTotal} (${sPct}%)</span>
        </div>
        <div class="disc-body ${isOpen ? 'open' : ''}"></div>
      `
      const header = disc.querySelector('.disc-header')
      const body = disc.querySelector('.disc-body')
      const arrow = disc.querySelector('.disc-arrow')
      const tagsBtn = disc.querySelector('.disc-tags-btn')

      tagsBtn.onclick = (e) => { e.stopPropagation(); openDiscDialog(subj) }

      header.onclick = (e) => {
        if (e.target.closest('.disc-tags-btn')) return
        const open = body.classList.toggle('open')
        arrow.classList.toggle('open', open)
        if (open) expandedDiscs.add(subj.code); else expandedDiscs.delete(subj.code)
      }

      for (const theme of subj.themes) {
        const section = document.createElement('div')
        section.className = 'theme-section'
        section.innerHTML = `<div class="theme-name">${esc(theme.name)}</div>`

        for (let i = 0; i < theme.topics.length; i++) {
          const tp = theme.topics[i]
          const row = document.createElement('div')
          row.className = `topic-row${tp.done ? ' done' : ''}`
          const cbId = `cb-${subj.code}-${i}`
          row.innerHTML = `
            <input type="checkbox" id="${cbId}" ${tp.done ? 'checked' : ''}>
            <label for="${cbId}">${esc(tp.text)}</label>
          `
          const cb = row.querySelector('input')
          cb.onchange = async () => {
            tp.done = cb.checked
            await saveData()
            renderPlano()
          }
          section.append(row)
        }
        body.append(section)
      }
      root.append(disc)
    }
  }
}

// ── Disc dialog (criar / editar / excluir disciplina) ──

// Serializa temas+topicos para textarea (temas sem indent, topicos com 2 espaços)
function serializeThemes (themes) {
  const lines = []
  for (const t of themes) {
    lines.push(t.name)
    for (const tp of t.topics) lines.push('  ' + tp.text)
  }
  return lines.join('\n')
}

// Parseia textarea: linhas sem indent = tema, com 2+ espaços = topico do tema anterior
function parseThemes (text, oldThemes) {
  const lines = text.split('\n').filter(l => l.trim())
  const themes = []
  let current = null
  // index old topics by theme+text for preserving done state
  const oldMap = new Map()
  if (oldThemes) {
    for (const t of oldThemes) for (const tp of t.topics) oldMap.set(t.name + '||' + tp.text, tp.done)
  }
  for (const line of lines) {
    if (/^ {2,}/.test(line)) {
      const topicText = line.trim()
      if (!current) { current = { name: 'Sem tema', topics: [] }; themes.push(current) }
      const done = oldMap.get(current.name + '||' + topicText) || false
      current.topics.push({ text: topicText, done })
    } else {
      current = { name: line.trim(), topics: [] }
      themes.push(current)
    }
  }
  return themes
}

let editingDisc = null

function openDiscDialog (subj) {
  editingDisc = subj || null
  $('disc-dialog-title').textContent = subj ? 'Editar disciplina' : 'Nova disciplina'
  $('disc-edit-code').value = subj ? subj.code : ''
  $('disc-name').value = subj ? subj.name : ''
  $('disc-code').value = subj ? subj.code : ''
  $('disc-semester').value = subj ? (subj.semester || CURRENT_SEMESTER) : CURRENT_SEMESTER
  $('disc-tags').value = subj ? (subj.tags || []).join(', ') : ''
  $('disc-themes').value = subj ? serializeThemes(subj.themes) : ''
  $('disc-delete').classList.toggle('hidden', !subj)
  $('disc-dialog').showModal()
}

$('new-disc').onclick = () => openDiscDialog(null)
$('disc-cancel').onclick = () => $('disc-dialog').close()

$('disc-delete').onclick = async () => {
  if (!editingDisc) return
  data.studyPlan = (data.studyPlan || []).filter(s => s.code !== editingDisc.code)
  await saveData()
  editingDisc = null
  $('disc-dialog').close()
  populateSelects()
  renderPlano()
}

$('disc-form').onsubmit = async (e) => {
  e.preventDefault()
  const name = $('disc-name').value.trim()
  if (!name) return
  const code = $('disc-code').value.trim() || uid()
  const semester = $('disc-semester').value.trim() || CURRENT_SEMESTER
  const tags = $('disc-tags').value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  const themes = parseThemes($('disc-themes').value, editingDisc ? editingDisc.themes : null)

  const entry = {
    semester, name, code,
    tags: tags.length ? tags : undefined,
    themes
  }

  if (editingDisc) {
    const oldCode = $('disc-edit-code').value
    const idx = (data.studyPlan || []).findIndex(s => s.code === oldCode)
    if (idx >= 0) data.studyPlan[idx] = entry
    else data.studyPlan.push(entry)
  } else {
    if (!data.studyPlan) data.studyPlan = []
    data.studyPlan.push(entry)
  }

  await saveData()
  editingDisc = null
  $('disc-dialog').close()
  populateSelects()
  renderPlano()
}

// ══════════════════════════════════════════
// PESQUISAS — GERAIS
// ══════════════════════════════════════════

const expandedGen = new Set()

function collectGenTags () {
  const tags = new Set()
  for (const t of (data.generalTopics || [])) for (const tag of (t.tags || [])) tags.add(tag)
  return [...tags].sort()
}

function renderGenTagBar () {
  const bar = $('gen-tags')
  bar.innerHTML = ''
  const allTags = collectGenTags()
  if (!allTags.length) return
  for (const tag of allTags) {
    const pill = document.createElement('button')
    pill.className = 'tag-pill' + (activeGenTags.has(tag) ? ' active' : '')
    pill.textContent = tag
    pill.onclick = () => { activeGenTags.has(tag) ? activeGenTags.delete(tag) : activeGenTags.add(tag); renderGeneralTopics() }
    bar.append(pill)
  }
}

function renderGeneralTopics () {
  let topics = data.generalTopics || []
  const searchQuery = ($('gen-search').value || '').trim().toLowerCase()
  const root = $('gen-list')
  root.innerHTML = ''

  // progress (global, before filtering)
  let total = 0, done = 0
  for (const t of topics) for (const item of t.items) { total++; if (item.done) done++ }
  const pct = total ? Math.round(done / total * 100) : 0
  $('gen-progress-text').textContent = `${pct}%`
  $('gen-bar-fill').style.width = `${pct}%`

  // filter by active tags
  if (activeGenTags.size) {
    topics = topics.filter(t => {
      const tTags = t.tags || []
      return [...activeGenTags].every(tag => tTags.includes(tag))
    })
  }

  // filter by search
  if (searchQuery) {
    topics = topics.filter(t => {
      if (t.title.toLowerCase().includes(searchQuery)) return true
      for (const item of t.items) if (item.text.toLowerCase().includes(searchQuery)) return true
      if ((t.tags || []).some(tag => tag.toLowerCase().includes(searchQuery))) return true
      return false
    })
  }

  renderGenTagBar()
  $('gen-empty').classList.toggle('hidden', topics.length > 0)

  for (const topic of topics) {
    let tTotal = 0, tDone = 0
    for (const item of topic.items) { tTotal++; if (item.done) tDone++ }
    const tPct = tTotal ? Math.round(tDone / tTotal * 100) : 0
    const isOpen = expandedGen.has(topic.id)
    const tagsHtml = (topic.tags || []).map(t => `<span class="tag-inline">${esc(t)}</span>`).join('')

    const card = document.createElement('div')
    card.className = 'gen-topic'
    card.innerHTML = `
      <div class="gen-topic-header">
        <span class="disc-arrow ${isOpen ? 'open' : ''}">&#9654;</span>
        <span class="gen-topic-title">${esc(topic.title)}${tagsHtml}</span>
        <span class="gen-topic-progress">${tDone}/${tTotal} (${tPct}%)</span>
        <button class="gen-topic-edit" title="Editar">&#9998;</button>
      </div>
      <div class="gen-topic-body ${isOpen ? 'open' : ''}"></div>
    `

    const header = card.querySelector('.gen-topic-header')
    const body = card.querySelector('.gen-topic-body')
    const arrow = card.querySelector('.disc-arrow')
    const editBtn = card.querySelector('.gen-topic-edit')

    editBtn.onclick = (e) => { e.stopPropagation(); openGenTopicDialog(topic) }

    header.onclick = () => {
      const open = body.classList.toggle('open')
      arrow.classList.toggle('open', open)
      if (open) expandedGen.add(topic.id); else expandedGen.delete(topic.id)
    }

    for (let i = 0; i < topic.items.length; i++) {
      const item = topic.items[i]
      const row = document.createElement('div')
      row.className = `topic-row${item.done ? ' done' : ''}`
      const cbId = `gen-cb-${topic.id}-${i}`
      row.innerHTML = `
        <input type="checkbox" id="${cbId}" ${item.done ? 'checked' : ''}>
        <label for="${cbId}">${esc(item.text)}</label>
      `
      const cb = row.querySelector('input')
      cb.onchange = async () => {
        item.done = cb.checked
        await saveData()
        renderGeneralTopics()
      }
      body.append(row)
    }

    root.append(card)
  }
}

// ── General topic dialog ──
let editingGenTopic = null

function openGenTopicDialog (topic) {
  editingGenTopic = topic || null
  $('gen-topic-dialog-title').textContent = topic ? 'Editar pesquisa' : 'Nova pesquisa'
  $('gen-topic-id').value = topic ? topic.id : ''
  $('gen-topic-title').value = topic ? topic.title : $('gen-new-topic').value.trim()
  $('gen-topic-tags').value = topic ? (topic.tags || []).join(', ') : ''
  $('gen-topic-items').value = topic ? topic.items.map(i => i.text).join('\n') : ''
  $('gen-delete').classList.toggle('hidden', !topic)
  $('gen-topic-dialog').showModal()
}

$('gen-add-topic').onclick = () => openGenTopicDialog(null)

$('gen-cancel').onclick = () => $('gen-topic-dialog').close()

$('gen-delete').onclick = async () => {
  if (!editingGenTopic) return
  data.generalTopics = data.generalTopics.filter(t => t.id !== editingGenTopic.id)
  await saveData()
  editingGenTopic = null
  $('gen-topic-dialog').close()
  renderGeneralTopics()
}

$('gen-topic-form').onsubmit = async (e) => {
  e.preventDefault()
  const title = $('gen-topic-title').value.trim()
  if (!title) return
  const lines = $('gen-topic-items').value.split('\n').map(l => l.trim()).filter(Boolean)
  const id = $('gen-topic-id').value || uid()

  const tags = $('gen-topic-tags').value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)

  if (editingGenTopic) {
    // preserve done state for existing items
    const oldItems = editingGenTopic.items
    const items = lines.map(text => {
      const existing = oldItems.find(i => i.text === text)
      return existing ? { text, done: existing.done } : { text, done: false }
    })
    const idx = data.generalTopics.findIndex(t => t.id === id)
    if (idx >= 0) data.generalTopics[idx] = { id, title, tags: tags.length ? tags : undefined, items }
  } else {
    const items = lines.map(text => ({ text, done: false }))
    data.generalTopics.push({ id, title, tags: tags.length ? tags : undefined, items })
  }

  await saveData()
  editingGenTopic = null
  $('gen-new-topic').value = ''
  $('gen-topic-dialog').close()
  renderGeneralTopics()
}

// also allow Enter on the input to open dialog
$('gen-new-topic').onkeydown = (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('gen-add-topic').click() }
}

// ── Utilitários ──
function esc (s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])) }

// ── Init ──
async function init () {
  await loadData()
  populateSelects()
  renderAgenda()
  renderPlano()
  renderGeneralTopics()
}

init()
