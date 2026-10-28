// Árvore de pastas do harness. Só os ramos abertos aparecem no grafo;
// por padrão ficam abertas a raiz e toda a pasta contexts/.
class HarnessGraph {
  constructor (tree) {
    this.nodes = []
    this.expanded = new Set()
    this.root = tree ? this.add(tree, null, 0) : null
    if (!this.root) return
    this.openAll(this.root)
  }

  add (folder, parent, depth) {
    const node = {
      id: parent ? `${parent.id}/${folder.name}` : folder.name,
      name: folder.name,
      path: folder.path,
      depth,
      parent,
      children: [],
      weight: 0,
      isFile: folder.type === 'file'
    }
    this.nodes.push(node)
    for (const child of folder.children || []) {
      const c = this.add(child, node, depth + 1)
      node.children.push(c)
      node.weight += 1 + c.weight
    }
    return node
  }

  openAll (node) {
    this.expanded.add(node.id)
    node.children.forEach(c => this.openAll(c))
  }

  collapseAll () {
    this.expanded.clear()
    if (this.root) this.expanded.add(this.root.id)
  }

  isAllOpen () {
    return this.nodes.every(n => n.isFile || !n.children.length || this.expanded.has(n.id))
  }

  isOpen (node) { return this.expanded.has(node.id) }

  visible () {
    const out = []
    const walk = n => { out.push(n); if (this.isOpen(n)) n.children.forEach(walk) }
    if (this.root) walk(this.root)
    return out
  }

  // A raiz fica sempre aberta; pastas sem subpastas e arquivos não têm o que abrir.
  toggle (node) {
    if (!node.parent || !node.children.length || node.isFile) return false
    if (this.isOpen(node)) this.expanded.delete(node.id)
    else this.expanded.add(node.id)
    return true
  }
}

if (typeof module !== 'undefined') module.exports = HarnessGraph
