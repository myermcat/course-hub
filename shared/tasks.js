/* tasks.js
   Tick boxes, for task cards and for rows in a table.

   A page opts in by giving <body> a data-store attribute, which names the storage key.
   Any element carrying data-k becomes a control: clickable, reachable by Tab, toggled with
   Space or Enter, with aria-checked kept in step. Marking one done adds the class `done` to
   its .task card or its table row, whichever encloses it.

   An element with data-progress="<selector>" shows how many of the boxes inside that selector
   are ticked, and updates as they change.

   THE STORAGE SEAM. Everything that touches storage goes through `store` below. Today it is
   localStorage, which lives in one browser and is lost when site data is cleared. Putting a
   server behind it means replacing the four methods on `store` and calling render() when
   remote state arrives. Nothing else on any page has to change. */

(function () {
  var KEY = (document.body.dataset.store || location.pathname) + '-tasks-v1'

  var store = {
    state: {},
    load: function () {
      try { this.state = JSON.parse(localStorage.getItem(KEY) || '{}') } catch (e) { this.state = {} }
      return this.state
    },
    get: function (k) { return !!this.state[k] },
    set: function (k, v) {
      if (v) this.state[k] = true
      else delete this.state[k]
      try { localStorage.setItem(KEY, JSON.stringify(this.state)) } catch (e) {}
    },
    /* Everything ticked, as a plain object. The export button and any future sync read this. */
    all: function () { return this.state },
  }

  store.load()

  var boxes = [].slice.call(document.querySelectorAll('[data-k][role="checkbox"]'))
  var meters = [].slice.call(document.querySelectorAll('[data-progress]'))

  function holder(b) {
    return b.closest('.task') || b.closest('tr') || b.parentElement
  }

  function paint(b) {
    var on = store.get(b.dataset.k)
    b.setAttribute('aria-checked', on ? 'true' : 'false')
    var h = holder(b)
    if (h) h.classList.toggle('done', on)
  }

  function label(b) {
    var h = holder(b)
    if (!h) return 'Mark done'
    var head = h.querySelector('.h') || h.querySelector('.topic') || h.querySelector('td:nth-child(2)')
    return 'Mark done: ' + ((head && head.textContent.trim()) || b.dataset.k)
  }

  function meter(m) {
    var scope = document.querySelector(m.dataset.progress)
    if (!scope) return
    var inside = scope.querySelectorAll('[data-k][role="checkbox"]')
    var done = 0
    for (var i = 0; i < inside.length; i++) if (store.get(inside[i].dataset.k)) done++
    m.textContent = done + ' of ' + inside.length + ' done'
    m.classList.toggle('all-done', inside.length > 0 && done === inside.length)
  }

  function render() {
    boxes.forEach(paint)
    meters.forEach(meter)
  }

  boxes.forEach(function (b) {
    b.setAttribute('aria-label', label(b))
    function flip() {
      store.set(b.dataset.k, !store.get(b.dataset.k))
      render()
    }
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); flip() })
    b.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip() }
    })
  })

  render()

  /* A second tab, or a future sync writing to the same key, repaints this one. */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { store.load(); render() }
  })

  /* Printing opens every closed toggle, then puts it back as it was. */
  document.addEventListener('beforeprint', function () {
    document.querySelectorAll('details.spec').forEach(function (d) {
      if (!d.open) { d.dataset.wasShut = '1'; d.open = true }
    })
  })
  document.addEventListener('afterprint', function () {
    document.querySelectorAll('details.spec[data-was-shut]').forEach(function (d) {
      d.open = false; delete d.dataset.wasShut
    })
  })
})()
