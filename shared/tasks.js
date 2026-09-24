/* tasks.js
   Tick boxes, for task cards and for rows in a table.

   A page opts in by giving <body> a data-store attribute, which names the storage key.
   Any element carrying data-k becomes a control: clickable, reachable by Tab, toggled with
   Space or Enter, with aria-checked kept in step. Marking one done adds the class `done` to
   its .task card or its table row, whichever encloses it.

   An element with data-progress="<selector>" shows how many of the boxes inside that selector
   are ticked, and updates as they change. Adding data-count="<word>" turns it into a plain
   total in that word, such as "4 left" beside a list that holds only what is outstanding.

   A page can also have a done section that ticked items are moved into. See MOVING A TICKED
   ITEM below for the four attributes that drive it.

   THE STORAGE SEAM. Everything that touches storage goes through `store` below. Today it is
   localStorage, which lives in one browser and is lost when site data is cleared. Putting a
   server behind it means replacing the three methods on `store` and calling render() when
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
  }

  store.load()

  /* ADOPTING TICKS FROM THE PAGE AN ITEM MOVED FROM.
     The storage key belongs to the page, so a task that moves from one hub to another leaves
     its tick behind under the old key. A page names the store it inherited items from in
     data-adopt on <body>. On the first load after that, every box on this page whose slug is
     ticked in the old store is ticked here too. It only ever adds a tick, it never clears one,
     the old store is left untouched, and a flag of its own stops it running a second time. */
  function adopt() {
    var from = document.body.dataset.adopt
    if (!from) return
    var flag = KEY + '-adopted-' + from
    try { if (localStorage.getItem(flag)) return } catch (e) { return }
    var old = {}
    try { old = JSON.parse(localStorage.getItem(from + '-tasks-v1') || '{}') } catch (e) { old = {} }
    document.querySelectorAll('[data-k][role="checkbox"]').forEach(function (b) {
      if (old[b.dataset.k] === true && !store.state[b.dataset.k]) store.state[b.dataset.k] = true
    })
    try {
      localStorage.setItem(KEY, JSON.stringify(store.state))
      localStorage.setItem(flag, '1')
    } catch (e) {}
  }

  adopt()

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
    if (m.dataset.count) {
      m.textContent = inside.length + ' ' + m.dataset.count
      return
    }
    var done = 0
    for (var i = 0; i < inside.length; i++) if (store.get(inside[i].dataset.k)) done++
    m.textContent = done + ' of ' + inside.length + ' done'
    m.classList.toggle('all-done', inside.length > 0 && done === inside.length)
  }

  /* MOVING A TICKED ITEM INTO THE DONE SECTION.
     Four attributes in the markup drive this, so a page gets the behaviour by writing them and
     a page without them is left alone.

       data-group="<name>"      on the item, naming the group it belongs to
       data-pos="<number>"      on the item, its place in that group
       data-home="<name>"       on the list the group lives in while it is outstanding
       data-done-group="<name>" on the list inside the done section it is moved to

     Ticking moves the item to the done list for its group, and unticking puts it back in front
     of the first item already home with a higher data-pos, which is where it came from. */

  function shelve(b) {
    var t = holder(b)
    var g = t && t.dataset.group
    if (!g) return
    var to = document.querySelector(
      store.get(b.dataset.k) ? '[data-done-group="' + g + '"]' : '[data-home="' + g + '"]')
    if (!to || t.parentElement === to) return
    var kids = to.children
    var at = null
    for (var i = 0; i < kids.length && !at; i++) {
      if (Number(kids[i].dataset.pos) > Number(t.dataset.pos)) at = kids[i]
    }
    to.insertBefore(t, at)
  }

  /* A group inside the done section shows only while it holds something, and the line saying
     the section is empty shows only while none of them do. */
  function tidy() {
    var any = false
    document.querySelectorAll('[data-done-group]').forEach(function (list) {
      var full = list.children.length > 0
      list.parentElement.hidden = !full
      if (full) any = true
    })
    var none = document.querySelector('[data-done-empty]')
    if (none) none.hidden = any
  }

  function render() {
    boxes.forEach(paint)
    boxes.forEach(shelve)
    tidy()
    meters.forEach(meter)
  }

  boxes.forEach(function (b) {
    b.setAttribute('aria-label', label(b))
    function flip() {
      store.set(b.dataset.k, !store.get(b.dataset.k))
      render()
      /* The item may have just been moved in the DOM, which drops focus at the top of the
         page. Put it back on the box, so a keyboard reader stays with what was ticked. */
      b.focus()
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

  /* Printing opens every closed toggle, then puts it back as it was.
     The whole task card is one kind of toggle, and the preamble block on a page that opens on
     the work is the other. */
  var FOLDS = 'details.task.fold, details.about, details.block'
  /* The browser fires both events at the window, so a listener on document never runs. */
  window.addEventListener('beforeprint', function () {
    document.querySelectorAll(FOLDS).forEach(function (d) {
      if (!d.open) { d.dataset.wasShut = '1'; d.open = true }
    })
  })
  window.addEventListener('afterprint', function () {
    document.querySelectorAll('details[data-was-shut]').forEach(function (d) {
      d.open = false; delete d.dataset.wasShut
    })
  })
})()
