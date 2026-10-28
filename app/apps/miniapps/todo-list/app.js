const DB_NAME = 'harnesshub-miniapps'
const DB_VERSION = 2
const STORE_TASKS = 'tasks'
const STORE_RESEARCH = 'research'
const state = { tasks: [], research: [], editing: null, activeTab: 'tasks' }
const $ = id => document.getElementById(id)

// ===== IndexedDB =====
function openDb () {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = e => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_TASKS)) db.createObjectStore(STORE_TASKS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_RESEARCH)) db.createObjectStore(STORE_RESEARCH, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readAll (store) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function writeItem (store, item) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).put(item)
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
  })
}

async function deleteItem (store, id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).delete(id)
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
  })
}

// ===== Helpers =====
const dateKey = date => date || new Date().toISOString().slice(0, 10)
const dateLabel = key => {
  const today = dateKey()
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toISOString().slice(0, 10)
  const full = new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  if (key === today) return `Hoje — ${full}`
  if (key === tomorrowKey) return `Amanhã — ${full}`
  return full
}
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]))
const timeAgo = ts => {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

// ===== Tabs =====
function switchTab (tab) {
  state.activeTab = tab
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  $('panel-tasks').classList.toggle('hidden', tab !== 'tasks')
  $('panel-research').classList.toggle('hidden', tab !== 'research')
  $('new-item').textContent = tab === 'tasks' ? 'Nova tarefa' : 'Novo assunto'
}

document.querySelector('.tab-bar').addEventListener('click', e => {
  const btn = e.target.closest('.tab')
  if (btn) switchTab(btn.dataset.tab)
})

// ===== Tag filters =====
function collectTags (items) {
  const tags = new Set()
  for (const item of items) for (const tag of (item.tags || [])) tags.add(tag)
  return [...tags].sort()
}

function populateTagFilter (selectId, items) {
  const sel = $(selectId)
  const current = sel.value
  const tags = collectTags(items)
  sel.innerHTML = '<option value="all">Todas as etiquetas</option>'
  for (const tag of tags) {
    const opt = document.createElement('option')
    opt.value = tag
    opt.textContent = '#' + tag
    sel.append(opt)
  }
  sel.value = tags.includes(current) ? current : 'all'
}

// ===== TAREFAS =====
function filteredTasks () {
  const query = $('search').value.trim().toLowerCase()
  const status = $('status-filter').value
  const priority = $('priority-filter').value
  const tag = $('tag-filter').value
  return state.tasks
    .filter(task => !query || `${task.title} ${task.notes} ${task.tags.join(' ')}`.toLowerCase().includes(query))
    .filter(task => status === 'all' || (status === 'done' ? task.done : !task.done))
    .filter(task => priority === 'all' || task.priority === priority)
    .filter(task => tag === 'all' || (task.tags || []).includes(tag))
    .sort((a, b) => {
      const today = dateKey()
      const da = dateKey(a.due), db2 = dateKey(b.due)
      const aFuture = da >= today, bFuture = db2 >= today
      if (aFuture !== bFuture) return aFuture ? -1 : 1
      if (aFuture) return da.localeCompare(db2) || b.createdAt - a.createdAt
      return db2.localeCompare(da) || b.createdAt - a.createdAt
    })
}

function renderTasks () {
  populateTagFilter('tag-filter', state.tasks)
  const root = $('task-groups')
  root.replaceChildren()
  const groups = new Map()
  for (const task of filteredTasks()) {
    const key = dateKey(task.due)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(task)
  }
  $('empty-tasks').classList.toggle('hidden', groups.size > 0)
  for (const [day, tasks] of groups) {
    const section = document.createElement('section')
    section.className = 'day-group'
    section.innerHTML = `<h2 class="day-title">${escapeHtml(dateLabel(day))}</h2>`
    for (const task of tasks) section.insertAdjacentHTML('beforeend', `
      <article class="task ${task.done ? 'done' : ''}">
        <input type="checkbox" ${task.done ? 'checked' : ''} data-action="toggle" data-id="${task.id}" aria-label="Concluir tarefa">
        <div>
          <div class="task-title">${escapeHtml(task.title)}</div>
          ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ''}
          <div class="task-meta">
            <span class="chip priority-${task.priority}">${task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}</span>
            ${task.tags.map(tag => `<span class="chip">#${escapeHtml(tag)}</span>`).join('')}
            ${task.repeat !== 'none' ? `<span class="chip">↻ ${task.repeat}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button data-action="edit" data-id="${task.id}" aria-label="Editar">Editar</button>
          <button data-action="delete" data-id="${task.id}" aria-label="Excluir">Excluir</button>
        </div>
      </article>`)
    root.append(section)
  }
}

function openTaskForm (task = null) {
  state.editing = task?.id || null
  $('dialog-title').textContent = task ? 'Editar tarefa' : 'Nova tarefa'
  $('task-id').value = task?.id || ''
  $('task-title').value = task?.title || ''
  $('task-notes').value = task?.notes || ''
  $('task-priority').value = task?.priority || 'medium'
  $('task-due').value = task?.due || dateKey()
  $('task-tags').value = (task?.tags || []).join(', ')
  $('task-repeat').value = task?.repeat || 'none'
  $('task-dialog').showModal()
  $('task-title').focus()
}

function nextDue (due, repeat) {
  const date = new Date(`${dateKey(due)}T12:00:00`)
  if (repeat === 'daily') date.setDate(date.getDate() + 1)
  if (repeat === 'weekly') date.setDate(date.getDate() + 7)
  if (repeat === 'monthly') date.setMonth(date.getMonth() + 1)
  return date.toISOString().slice(0, 10)
}

// task events
$('cancel-task').onclick = () => $('task-dialog').close()
for (const id of ['search', 'status-filter', 'priority-filter', 'tag-filter']) $(id).oninput = renderTasks
$('task-groups').onclick = async event => {
  const button = event.target.closest('[data-action]')
  if (!button) return
  const task = state.tasks.find(item => item.id === button.dataset.id)
  if (!task) return
  if (button.dataset.action === 'edit') openTaskForm(task)
  if (button.dataset.action === 'delete' && confirm(`Excluir "${task.title}"?`)) {
    await deleteItem(STORE_TASKS, task.id)
    state.tasks = state.tasks.filter(item => item.id !== task.id)
    renderTasks()
  }
}
$('task-groups').onchange = async event => {
  if (event.target.dataset.action !== 'toggle') return
  const task = state.tasks.find(item => item.id === event.target.dataset.id)
  if (!task) return
  task.done = event.target.checked
  task.updatedAt = Date.now()
  if (task.done && task.repeat !== 'none') {
    const next = { ...task, id: crypto.randomUUID(), done: false, due: nextDue(task.due, task.repeat), createdAt: Date.now() }
    await writeItem(STORE_TASKS, next)
    state.tasks.push(next)
  }
  await writeItem(STORE_TASKS, task)
  renderTasks()
}
$('task-form').onsubmit = async event => {
  event.preventDefault()
  const existing = state.tasks.find(task => task.id === state.editing)
  const task = {
    id: existing?.id || crypto.randomUUID(),
    title: $('task-title').value.trim(),
    notes: $('task-notes').value.trim(),
    priority: $('task-priority').value,
    due: $('task-due').value || dateKey(),
    tags: $('task-tags').value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean),
    repeat: $('task-repeat').value,
    done: existing?.done || false,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  }
  await writeItem(STORE_TASKS, task)
  state.tasks = existing ? state.tasks.map(item => item.id === task.id ? task : item) : [...state.tasks, task]
  $('task-dialog').close()
  renderTasks()
}

// ===== PESQUISAR =====
function filteredResearch () {
  const query = $('research-search').value.trim().toLowerCase()
  const status = $('research-status-filter').value
  const tag = $('research-tag-filter').value
  return state.research
    .filter(r => !query || `${r.topic} ${r.notes} ${(r.tags || []).join(' ')}`.toLowerCase().includes(query))
    .filter(r => status === 'all' || (status === 'done' ? r.done : !r.done))
    .filter(r => tag === 'all' || (r.tags || []).includes(tag))
    .sort((a, b) => {
      // pendentes primeiro, depois por data de criação (mais recente primeiro)
      if (a.done !== b.done) return a.done ? 1 : -1
      return b.createdAt - a.createdAt
    })
}

function renderResearch () {
  populateTagFilter('research-tag-filter', state.research)
  const root = $('research-list')
  root.replaceChildren()
  const items = filteredResearch()
  $('empty-research').classList.toggle('hidden', items.length > 0)

  for (const r of items) {
    const article = document.createElement('article')
    article.className = 'research-item' + (r.done ? ' done' : '')
    article.innerHTML = `
      <input type="checkbox" ${r.done ? 'checked' : ''} data-action="toggle-research" data-id="${r.id}" aria-label="Marcar como pesquisado">
      <div>
        <div class="research-topic">${escapeHtml(r.topic)}</div>
        ${r.notes ? `<div class="research-notes">${escapeHtml(r.notes)}</div>` : ''}
        <div class="task-meta">
          ${(r.tags || []).map(tag => `<span class="chip">#${escapeHtml(tag)}</span>`).join('')}
          <span class="chip time-chip">${timeAgo(r.createdAt)}</span>
        </div>
      </div>
      <div class="task-actions">
        <button data-action="edit-research" data-id="${r.id}" aria-label="Editar">Editar</button>
        <button data-action="delete-research" data-id="${r.id}" aria-label="Excluir">Excluir</button>
      </div>
    `
    root.append(article)
  }
}

function openResearchForm (item = null) {
  state.editing = item?.id || null
  $('research-dialog-title').textContent = item ? 'Editar assunto' : 'Novo assunto'
  $('research-id').value = item?.id || ''
  $('research-topic').value = item?.topic || ''
  $('research-notes').value = item?.notes || ''
  $('research-tags').value = (item?.tags || []).join(', ')
  $('research-dialog').showModal()
  $('research-topic').focus()
}

// research events
$('cancel-research').onclick = () => $('research-dialog').close()
for (const id of ['research-search', 'research-status-filter', 'research-tag-filter']) $(id).oninput = renderResearch

$('research-list').onclick = async event => {
  const button = event.target.closest('[data-action]')
  if (!button) return
  const item = state.research.find(r => r.id === button.dataset.id)
  if (!item) return
  if (button.dataset.action === 'edit-research') openResearchForm(item)
  if (button.dataset.action === 'delete-research' && confirm(`Excluir "${item.topic}"?`)) {
    await deleteItem(STORE_RESEARCH, item.id)
    state.research = state.research.filter(r => r.id !== item.id)
    renderResearch()
  }
}

$('research-list').onchange = async event => {
  if (event.target.dataset.action !== 'toggle-research') return
  const item = state.research.find(r => r.id === event.target.dataset.id)
  if (!item) return
  item.done = event.target.checked
  item.updatedAt = Date.now()
  await writeItem(STORE_RESEARCH, item)
  renderResearch()
}

$('research-form').onsubmit = async event => {
  event.preventDefault()
  const existing = state.research.find(r => r.id === state.editing)
  const item = {
    id: existing?.id || crypto.randomUUID(),
    topic: $('research-topic').value.trim(),
    notes: $('research-notes').value.trim(),
    tags: $('research-tags').value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean),
    done: existing?.done || false,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  }
  await writeItem(STORE_RESEARCH, item)
  state.research = existing ? state.research.map(r => r.id === item.id ? item : r) : [...state.research, item]
  $('research-dialog').close()
  renderResearch()
}

// ===== Botão principal (adapta à aba ativa) =====
$('new-item').onclick = () => {
  if (state.activeTab === 'tasks') openTaskForm()
  else openResearchForm()
}

// ===== Init =====
Promise.all([readAll(STORE_TASKS), readAll(STORE_RESEARCH)])
  .then(([tasks, research]) => {
    state.tasks = tasks
    state.research = research
    renderTasks()
    renderResearch()
  })
  .catch(error => {
    $('empty-tasks').textContent = `Não foi possível abrir os dados: ${error.message}`
    $('empty-tasks').classList.remove('hidden')
  })
