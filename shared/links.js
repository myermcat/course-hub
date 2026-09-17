/* links.js
   A link the reader fills in herself, for one column of a table.

   A page opts in the way it does for tick boxes, with data-store on <body>, and writes an empty
   span wherever a link belongs:

     <span class="lnk" data-link="ceg-lab-1-submission" data-label="Submission"></span>

   While the key holds nothing, the span shows a small invitation to add an address. Once it
   holds one, the span shows the link itself: the text is data-label, the full address is in the
   title so hovering says where it goes, it opens in a new tab, and a twelve pixel pencil stands
   at its right. The pencil is the only way back to the input, because the filled state is the
   one the reader is in on nearly every visit and it should look finished.

   Three attributes drive a field, one of them optional.

     data-link="<slug>"   required, the storage key for this one field. A slug survives a
                          rewording of the row, and renaming it loses the address saved under
                          the old name.
     data-label="<text>"  the words the link reads as, such as Submission. Defaults to Link.
     data-row="<text>"    what to call the row in the accessible name of the two buttons. Left
                          out, it is read from the row itself: td.topic without its .sub line,
                          then .h, then the second cell.
     data-add="<text>"    the invitation shown while the field is empty. Defaults to Add link.

   Editing. Enter saves, Escape restores what was there, moving focus away saves. Whitespace
   around the address is dropped. Emptying the box and saving removes the link and returns the
   cell to its invitation.

   Addresses are checked before one reaches an href. http:// and https:// are accepted, an
   address typed with no scheme is saved with https:// in front of it, and everything else,
   javascript: and data: among them, is refused in place with a line saying so. A scheme with
   nothing behind it is refused too, because it names no place. The check runs again on the way
   out of storage, so a value written by anything other than this file cannot reach an href
   either.

   THE STORAGE SEAM. Everything that touches storage goes through `store` below, under a key of
   its own that the tick boxes never read or write. Today it is localStorage, which lives in one
   browser and is lost when site data is cleared. Putting a server behind it means replacing the
   three methods on `store` and calling render() when remote state arrives. Nothing else on any
   page has to change. */

(function () {
  var KEY = (document.body.dataset.store || location.pathname) + '-links-v1'

  var store = {
    state: {},
    load: function () {
      try { this.state = JSON.parse(localStorage.getItem(KEY) || '{}') } catch (e) { this.state = {} }
      return this.state
    },
    get: function (k) {
      var v = this.state[k]
      if (typeof v !== 'string') return ''
      return clean(v) || ''
    },
    set: function (k, v) {
      if (v) this.state[k] = v
      else delete this.state[k]
      try { localStorage.setItem(KEY, JSON.stringify(this.state)) } catch (e) {}
    },
  }

  /* WHAT COUNTS AS AN ADDRESS.
     Returns the address to save, '' for an empty box, or null for one that is refused.

     Everything outside the printable range goes first, so a scheme split up with a control
     character cannot arrive disguised. A scheme is a run of letters, digits and +-. before a
     colon, and a candidate carrying a dot is read as a host with a port, which keeps
     example.com:8080/a working. http and https are normalised to two slashes. Every other
     scheme is refused, and that is what stops javascript: and data:, which would run code
     where a page should open.

     The browser's own parser then has the last word on the result, which is a second lock on
     the scheme and the one thing the pattern above cannot see: whether what was typed names a
     place at all. A scheme with nothing behind it used to be taken, and the cell then showed a
     finished-looking link that went nowhere. */
  function clean(raw) {
    var v = String(raw).replace(/[^\x20-\x7e\u00a1-\uffff]/g, '').trim()
    if (!v) return ''
    if (v.slice(0, 2) === '//') v = 'https:' + v
    var m = v.match(/^([a-zA-Z][a-zA-Z0-9+.\-]*):([\s\S]*)$/)
    if (m && m[1].indexOf('.') < 0) {
      var s = m[1].toLowerCase()
      if (s !== 'http' && s !== 'https') return null
      v = s + '://' + m[2].replace(/^\/*/, '')
    } else {
      v = 'https://' + v
    }
    try {
      var u = new URL(v)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
      if (!u.hostname) return null
    } catch (e) { return null }
    return v
  }

  store.load()

  var fields = [].slice.call(document.querySelectorAll('.lnk[data-link]'))
  if (!fields.length) return

  var PENCIL = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path d="M11.3 2.2l2.5 2.5-8 8L2 14l1.3-3.8 8-8z" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'

  function rowName(el) {
    if (el.dataset.row) return el.dataset.row
    var tr = el.closest('tr')
    var cell = tr && (tr.querySelector('td.topic') || tr.querySelector('.h') ||
      tr.querySelector('td:nth-child(2)'))
    if (!cell) return ''
    var copy = cell.cloneNode(true)
    copy.querySelectorAll('.sub').forEach(function (s) { s.parentNode.removeChild(s) })
    return copy.textContent.replace(/\s+/g, ' ').trim()
  }

  /* "Change the submission link for Laboratory 1", so a reader who hears the button and nothing
     around it still knows which row it belongs to. */
  function name(el, verb) {
    var said = verb + ' the ' + (el.dataset.label || 'link').toLowerCase() + ' link'
    var r = rowName(el)
    return r ? said + ' for ' + r : said
  }

  /* A field already showing the right thing is left exactly as it is, elements and all. Saving
     one field repaints every field, and rebuilding a button between the press and the release
     of a mouse click swallows that click, which cost a second click on the next row every time
     she filled one row and moved straight to the one below. */
  function paint(el) {
    if (el.dataset.editing === '1') return
    var url = store.get(el.dataset.link)
    if (el.dataset.drawn === url && el.firstChild) return
    el.dataset.drawn = url
    el.textContent = ''
    el.classList.remove('editing')
    el.classList.toggle('set', !!url)

    if (!url) {
      var add = document.createElement('button')
      add.type = 'button'
      add.className = 'lnk-add'
      add.textContent = el.dataset.add || 'Add link'
      add.setAttribute('aria-label', name(el, 'Add'))
      add.addEventListener('click', function () { edit(el, 'Add') })
      el.appendChild(add)
      return
    }

    var a = document.createElement('a')
    a.className = 'lnk-a'
    a.href = url
    a.title = url
    a.target = '_blank'
    a.rel = 'noopener'
    a.textContent = el.dataset.label || 'Link'

    var pen = document.createElement('button')
    pen.type = 'button'
    pen.className = 'lnk-edit'
    pen.title = 'Change the link'
    pen.setAttribute('aria-label', name(el, 'Change'))
    pen.innerHTML = PENCIL
    pen.addEventListener('click', function () { edit(el, 'Change') })

    el.appendChild(a)
    el.appendChild(pen)
  }

  function edit(el, verb) {
    el.dataset.editing = '1'
    delete el.dataset.drawn
    el.textContent = ''
    el.classList.add('editing')

    var box = document.createElement('input')
    box.type = 'text'
    box.className = 'lnk-in'
    box.value = store.get(el.dataset.link)
    box.placeholder = 'https://'
    box.spellcheck = false
    box.autocomplete = 'off'
    box.setAttribute('inputmode', 'url')
    box.setAttribute('aria-label', name(el, verb))

    var no = document.createElement('span')
    no.className = 'lnk-no'
    no.setAttribute('aria-live', 'polite')
    no.hidden = true

    el.appendChild(box)
    el.appendChild(no)
    box.focus()
    box.select()

    var shut = false

    /* Leaving rebuilds the cell from storage, so Escape restores the address that was there.
       Focus goes back to the button that opened the input, unless focus had already moved off
       on its own, which is what a blur is. The rebuild waits for the mouse, for the reason
       under whenFree below. */
    function leave(refocus) {
      if (shut) return
      shut = true
      whenFree(function () {
        delete el.dataset.editing
        render()
        if (!refocus) return
        var b = el.querySelector('button')
        if (b) b.focus()
      })
    }

    function save(refocus) {
      if (shut) return
      var v = clean(box.value)
      if (v === null) {
        no.textContent = 'A link has to be a whole address, starting with http:// or https://'
        no.hidden = false
        box.classList.add('bad')
        return
      }
      store.set(el.dataset.link, v)
      leave(refocus)
    }

    box.addEventListener('input', function () {
      no.hidden = true
      box.classList.remove('bad')
    })
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); save(true) }
      else if (e.key === 'Escape') { e.preventDefault(); leave(true) }
    })
    /* The save waits a tick, so it never pulls the input out of the document in the middle of
       the browser moving focus somewhere else. */
    box.addEventListener('blur', function () { setTimeout(function () { save(false) }, 0) })
  }

  /* WHY THE REDRAW WAITS FOR THE BUTTON TO COME BACK UP.
     Focus leaves on the press of a mouse, so the save runs while the button is still down. A
     redraw there changes the width of the column and moves every row under it, the release
     lands somewhere else, and the browser throws the click away: her first click on the next
     row, on a tick box or on a handout did nothing at all, and she had to click again. The
     address is written the moment focus leaves and only the redraw waits, so a pointer that
     never comes back up over the page costs nothing that was typed. */
  var held = false
  var waiting = []

  function free() {
    held = false
    if (!waiting.length) return
    setTimeout(function () {
      var due = waiting
      waiting = []
      due.forEach(function (f) { f() })
    }, 0)
  }

  function whenFree(fn) {
    if (held) waiting.push(fn)
    else fn()
  }

  document.addEventListener('pointerdown', function () { held = true }, true)
  document.addEventListener('pointerup', free, true)
  document.addEventListener('pointercancel', free, true)
  window.addEventListener('blur', free)

  function render() { fields.forEach(paint) }

  render()

  /* A second tab, or a future sync writing to the same key, repaints this one. A field with an
     input open is left alone by paint(), so a repaint never takes away what is half typed. */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { store.load(); render() }
  })
})()
