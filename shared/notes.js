/* notes.js
   Lecture notes she writes herself. One lecture is one toggle.

   A page opts in the way it does for tick boxes and links, with data-store on <body>, and
   writes one empty container wherever the notes belong:

     <div data-notes></div>

   This file fills it with the button that adds a lecture, then the lectures themselves,
   newest first. Each lecture is a <details> holding two things she writes: a heading in the
   summary, which is whatever she picks for it, and the notes inside.

   Three attributes on the container change the words, and all three are optional.

     data-add="<text>"       the label on the button. Defaults to Add a lecture.
     data-heading="<text>"   the placeholder in an empty heading. Defaults to Date or topic.
     data-body="<text>"      the placeholder in an empty set of notes.

   EVERY TOGGLE IS CLOSED ON EVERY LOAD. Which ones were open is not remembered and not
   written anywhere, because the page is somewhere to write and a screen of open notes is a
   screen she has to scroll past to reach today's lecture. A lecture she has just added opens
   on its own, since she added it to write in it.

   Removing a lecture takes three presses. Three dots sit at the right of the summary, the size of
   the pencil in links.js, and open a menu holding one item, Delete this lecture. Choosing it turns
   that end of the row into a question with two answers, and only the last press destroys anything.
   The menu is built at the end of the document and placed over the page, because a menu nested in
   the summary is cut off by the rounded details around it. Escape closes it and puts focus back on
   the dots, and so does a press anywhere else on the page.

   THE EDITOR is shared/editor.js, the one file every course writes its notes in. The page loads
   it ahead of this one:

     <script src="../shared/editor.js"></script>
     <script src="../shared/notes.js"></script>

   Everything a reader does inside a lecture body belongs to that file: Cmd or Ctrl with B, I and
   H, the floating bar on a selection, the four colours, the markdown-ish shortcuts for lists,
   headings, quotes and rules, Tab to indent inside a list, paste that keeps the shape and throws
   the rest away, and the rule that a fresh empty line drops the formatting of the line above it.
   It is told three things once, in start(), and handed each lecture body with a function to call
   after it has changed one. Everything below is what the editor knows nothing about: the
   lectures, the three dots menu, the accent edge on a well, the save pill and the storage.

   THE STORAGE SEAM. Everything that touches storage goes through `store` below, under a key of
   its own that the tick boxes and the links never read or write. A write reads what is there,
   puts this page's list of lectures back into it, and writes the whole object, so a key this
   file knows nothing about survives and so does a lecture a second tab added a moment ago.
   Today it is localStorage, which lives in one browser and is lost when site data is cleared.
   Putting a server behind it means replacing read and write on `store` and calling render()
   when remote state arrives. Nothing else on any page has to change. */

(function () {
  var host = document.querySelector('[data-notes]');
  if (!host) return;

  var KEY = (document.body.dataset.store || location.pathname) + '-notes-v1';
  var PH_HEAD = host.dataset.heading || 'Date or topic';
  var PH_BODY = host.dataset.body || 'What was said in this lecture…';
  var ADD = host.dataset.add || 'Add a lecture';

  /* ---------- the pill that says whether anything was saved ---------- */

  var pill = null, pillT = null;
  function flag(txt, bad) {
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'save';
      pill.setAttribute('role', 'status');
      document.body.appendChild(pill);
    }
    pill.textContent = txt;
    pill.className = bad ? 'bad' : (txt ? 'on' : '');
    if (pillT) clearTimeout(pillT);
    if (!bad) pillT = setTimeout(function () { pill.className = ''; }, 1400);
  }

  function oneLine(t) {
    return String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  }

  /* Is the caret inside one of this lecture's two editors. A repaint leaves whatever she is
     typing in alone, so a second tab saving cannot take a half written line away from her. */
  function editingIn(id, sel) {
    var a = document.activeElement;
    if (!a || !a.closest) return false;
    var el = a.closest(sel);
    if (!el) return false;
    var d = el.closest('.lec');
    return !!d && d.getAttribute('data-id') === id;
  }

  /* ---------- storage ---------- */

  var store = {
    blocks: [],
    /* Every lecture this tab has ever held, by id, the removed ones included. A lecture found
       in storage that is not in this map was written by a second tab since the last repaint
       here, so it is kept. One that is in the map and gone from this list was removed here,
       which is what stops a write bringing it back. */
    known: {},

    read: function () {
      var v = null;
      try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { v = null; }
      if (Array.isArray(v)) v = { blocks: v };
      if (!v || typeof v !== 'object') v = {};
      if (!Array.isArray(v.blocks)) v.blocks = [];
      return v;
    },

    /* The objects already in memory are kept and filled in, because the handlers on a lecture
       already on the page hold a reference to one of them. Building fresh objects here would
       leave every editor writing into something nothing reads back. */
    load: function () {
      var box = this.read(), out = [], seen = {}, by = {};
      this.blocks.forEach(function (b) { by[b.id] = b; });
      box.blocks.forEach(function (raw) {
        if (!raw || typeof raw !== 'object') return;
        var id = String(raw.id == null ? '' : raw.id);
        if (!id || seen[id]) return;
        seen[id] = 1;
        var b = by[id] || { id: id, heading: '', body: '' };
        if (!editingIn(id, '.lech')) b.heading = oneLine(raw.heading);
        if (!editingIn(id, '.nb')) b.body = Notes.clean(raw.body);
        store.known[id] = 1;
        out.push(b);
      });
      this.blocks = out;
      return out;
    },

    /* Read what is stored, put this list back into it, write the whole object. Keys beside
       `blocks` are carried across untouched, and so is a lecture a second tab wrote while this
       one was not looking. Returns how many of those there were, so the caller can pick them
       up once nothing here is being typed in. */
    write: function () {
      var box = this.read(), mine = {}, self = this;
      this.blocks.forEach(function (b) { mine[b.id] = 1; });
      var foreign = box.blocks.filter(function (b) {
        return b && b.id && !mine[String(b.id)] && !self.known[String(b.id)];
      });
      function plain(b) {
        return { id: String(b.id), heading: oneLine(b.heading), body: Notes.clean(b.body) };
      }
      box.blocks = foreign.map(plain).concat(this.blocks.map(plain));
      try {
        localStorage.setItem(KEY, JSON.stringify(box));
        flag('Saved in this browser', false);
      } catch (e) {
        /* A private window, or site data turned off. Saying nothing here is how somebody
           loses an evening of notes believing they were kept. */
        flag('This browser is not saving. Copy anything you need.', true);
      }
      return foreign.length;
    },
  };

  function save() {
    var arrived = store.write();
    /* A lecture from a second tab is only taken into this page when nothing here is being
       typed in, because pulling an element she has the caret in across the document is how a
       sentence in progress is lost. It stays in storage until then and arrives on the next
       write or the next storage event. */
    if (arrived && !host.contains(document.activeElement)) { store.load(); render(); }
  }

  /* ---------- the lectures ---------- */

  var listEl = null, none = null, addBtn = null;

  var DOTS = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<circle cx="8" cy="2.6" r="1.6" fill="currentColor"/>' +
    '<circle cx="8" cy="8" r="1.6" fill="currentColor"/>' +
    '<circle cx="8" cy="13.4" r="1.6" fill="currentColor"/></svg>';
  var PLUS = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round"/></svg>';

  /* ---------- the menu behind the three dots ---------- */

  /* One menu is open at a time, so the whole thing is one object. It is built on the press and
     thrown away on the close, which is what keeps a menu out of a lecture that has been removed
     under it.

     WHY IT IS APPENDED TO THE BODY. A menu written into the summary is clipped by the rounded
     details it sits in as soon as it is taller than the row. Page coordinates put it over
     everything and let it travel with the lecture as the page scrolls.

     A caller hands over a list of items, each one { label, name, hot, run }, so a second item is
     a line in that list and nothing here changes. */
  var menu = { pop: null, btn: null, items: [] };
  var POPID = 'lecpop-open';

  function shutMenu(refocus) {
    var b = menu.btn;
    if (menu.pop) menu.pop.remove();
    menu.pop = null;
    menu.btn = null;
    menu.items = [];
    if (!b) return;
    b.setAttribute('aria-expanded', 'false');
    b.removeAttribute('aria-controls');
    if (refocus && document.contains(b)) b.focus();
  }

  /* Under the dots and flush with their right edge, because the control stands at the right end
     of the row and a menu hanging off to the right would leave the window. It goes above the row
     when the window has no room under it.

     A page carrying the bar pinned to the bottom has that much less room. The menu draws over the
     bar, since it sits higher in the stack, and reading the bar's height here is what sends the
     menu above the row before it gets that far. */
  function placeMenu() {
    if (!menu.pop || !menu.btn) return;
    var r = menu.btn.getBoundingClientRect();
    var w = menu.pop.offsetWidth, h = menu.pop.offsetHeight;
    var left = r.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - w);
    var dock = document.querySelector('.dock');
    var floor = window.innerHeight - 8 - (dock ? dock.offsetHeight : 0);
    var top = r.bottom + 6;
    if (top + h > floor && r.top - 6 - h > 8) top = r.top - 6 - h;
    menu.pop.style.left = (window.scrollX + left) + 'px';
    menu.pop.style.top = (window.scrollY + top) + 'px';
  }

  function moveIn(n) {
    var L = menu.items.length;
    if (!L) return;
    menu.items[((n % L) + L) % L].focus();
  }

  function menuKey(e) {
    e.stopPropagation();
    var i = menu.items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); shutMenu(true); return; }
    /* Tab hands focus back to the dots and closes. The menu is the last thing in the document, so
       letting the browser move on from here would drop her at the end of the page. */
    if (e.key === 'Tab') { e.preventDefault(); shutMenu(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveIn(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveIn(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); moveIn(0); }
    else if (e.key === 'End') { e.preventDefault(); moveIn(menu.items.length - 1); }
  }

  function openMenu(btn, items, atEnd) {
    shutMenu(false);
    var pop = document.createElement('div');
    pop.className = 'lecpop';
    /* One menu is open at a time, so one id is enough for the button to point at. */
    pop.id = POPID;
    pop.setAttribute('role', 'menu');
    pop.setAttribute('aria-label', btn.getAttribute('aria-label') || 'Lecture actions');
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.tabIndex = -1;
      if (it.hot) b.className = 'hot';
      b.textContent = it.label;
      if (it.name) b.setAttribute('aria-label', it.name);
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        shutMenu(false);
        it.run();
      });
      pop.appendChild(b);
    });
    pop.addEventListener('keydown', menuKey);
    /* A press that lands on the menu's own padding, or in the gap between two items, would
       otherwise blur the item and leave focus on the page body with the menu still standing.
       Cancelling that press keeps the focus where the menu put it. */
    pop.addEventListener('mousedown', function (e) {
      if (!e.target.closest('[role="menuitem"]')) e.preventDefault();
    });
    document.body.appendChild(pop);

    menu.pop = pop;
    menu.btn = btn;
    menu.items = Array.prototype.slice.call(pop.querySelectorAll('[role="menuitem"]'));
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', POPID);
    placeMenu();
    moveIn(atEnd ? menu.items.length - 1 : 0);
  }

  /* A press anywhere else closes it. The dots themselves are left out, so the press that closes
     an open menu is the same press its own click handler reads as a toggle. Touch is listened for
     beside the mouse, because a tap on a phone reaches a plain paragraph as a touch and nothing
     else. */
  function pressOut(e) {
    if (!menu.pop) return;
    if (menu.pop.contains(e.target) || (menu.btn && menu.btn.contains(e.target))) return;
    shutMenu(false);
  }
  document.addEventListener('mousedown', pressOut, true);
  document.addEventListener('touchstart', pressOut, { capture: true, passive: true });
  /* Focus landing anywhere outside closes it too, which covers a screen reader moving on and a
     click that lands on another control. */
  document.addEventListener('focusin', function (e) {
    if (!menu.pop) return;
    if (menu.pop.contains(e.target) || (menu.btn && menu.btn.contains(e.target))) return;
    shutMenu(false);
  });
  /* Escape closes an open menu from anywhere on the page, not only from inside it. menuKey stops
     the keystroke while focus is on an item, so this runs only when focus has landed somewhere
     else and the menu would otherwise have no key that puts it away. */
  document.addEventListener('keydown', function (e) {
    if (!menu.pop || e.key !== 'Escape') return;
    e.preventDefault();
    shutMenu(true);
  });
  window.addEventListener('resize', function () { if (menu.pop) shutMenu(false); });

  function uid() {
    return String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7);
  }

  // Which lecture an editor belongs to, read from the element it sits in.
  function owner(el) {
    var d = el.closest('.lec');
    var id = d && d.getAttribute('data-id');
    if (!id) return null;
    for (var i = 0; i < store.blocks.length; i++) {
      if (store.blocks[i].id === id) return store.blocks[i];
    }
    return null;
  }

  /* The left edge of the well holds the accent once there is something in it, so a page of
     lectures says at a glance which ones have been written up. */
  function touch(nb) {
    var w = nb.closest('.nbwrap');
    if (w) w.classList.toggle('has', !!nb.textContent.trim());
  }

  /* What a control on one lecture is called when it is read out on its own: "Delete the lecture
     23 September" while it has a heading, "Delete this lecture" while it has none. links.js names
     the row a pencil belongs to the same way, and a menu needs it more than a pencil does, because
     the menu is drawn away from the block it acts on. */
  function said(b, verb) {
    var t = oneLine(b.heading);
    return t ? verb + ' the lecture ' + t : verb + ' this lecture';
  }

  function make(b) {
    var d = document.createElement('details');
    d.className = 'lec';
    d.setAttribute('data-id', b.id);

    var sum = document.createElement('summary');

    var h = document.createElement('span');
    h.className = 'lech';
    h.contentEditable = 'true';
    h.setAttribute('role', 'textbox');
    h.setAttribute('data-ph', PH_HEAD);
    h.setAttribute('aria-label', 'Heading for this lecture');

    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'lecmore';
    more.title = 'More for this lecture';
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-label', said(b, 'More for'));
    more.innerHTML = DOTS;

    sum.appendChild(h);
    sum.appendChild(more);

    var inn = document.createElement('div');
    inn.className = 'lecin';
    var wrap = document.createElement('div');
    wrap.className = 'nbwrap';
    var pad = document.createElement('div');
    pad.className = 'nbpad';
    var nb = document.createElement('div');
    nb.className = 'nb';
    nb.contentEditable = 'true';
    nb.setAttribute('data-ph', PH_BODY);
    nb.setAttribute('aria-label', 'Notes for this lecture');
    pad.appendChild(nb);
    wrap.appendChild(pad);
    inn.appendChild(wrap);

    d.appendChild(sum);
    d.appendChild(inn);

    /* A click inside the heading would open and close the lecture, because a summary opens on
       any click that reaches it. The caret is placed on the press of the mouse, which has
       already happened by now, so cancelling the click leaves the caret where she put it and
       takes the toggle away. */
    h.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
    /* THE SPACE BAR IN A HEADING. A summary is a button to the browser, and the space bar presses
       a button: Chrome answers a space typed in here with a click of its own on the summary, so
       every word she typed shut the lecture and the next word opened it again. That click carries
       the summary as its target and never passes through the heading, which is why the handler
       above does not see it. It is cancelled here instead, and only while the caret is in the
       heading: a click made out of a key press carries a detail of 0, and a press on the summary
       itself leaves focus on the summary, so both of those still open the lecture. */
    sum.addEventListener('click', function (e) {
      if (e.detail === 0 && document.activeElement === h) e.preventDefault();
    });
    h.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') {
        // One line, so Enter leaves the heading for the notes underneath.
        e.preventDefault();
        d.open = true;
        nb.focus();
        Notes.prime(nb);
        Notes.caretEnd(nb.lastElementChild || nb);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); h.blur(); }
    });
    h.addEventListener('paste', function (e) {
      // The heading is one line of plain words, so nothing that arrives keeps its markup.
      e.preventDefault();
      var cd = e.clipboardData || window.clipboardData;
      document.execCommand('insertText', false, oneLine(cd.getData('text/plain')));
    });
    h.addEventListener('input', function () {
      Notes.swapAsTyped();
      b.heading = h.textContent;
      h.classList.toggle('is-empty', !h.textContent.trim());
      more.setAttribute('aria-label', said(b, 'More for'));
      save();
    });
    h.addEventListener('blur', function () {
      var tidy = oneLine(h.textContent);
      if (h.textContent !== tidy) h.textContent = tidy;
      b.heading = tidy;
      h.classList.toggle('is-empty', !tidy);
      more.setAttribute('aria-label', said(b, 'More for'));
      save();
    });

    /* The swap runs before the body is read. This listener is registered ahead of the one
       inside Notes.rich(), so reading innerHTML first would store the raw "->" and the next
       render would put it straight back over the arrow. */
    nb.addEventListener('input', function () { Notes.swapAsTyped(); b.body = nb.innerHTML; touch(nb); save(); });
    nb.addEventListener('blur', function () { Notes.hideBar(); b.body = nb.innerHTML; touch(nb); save(); });
    Notes.rich(nb, function () { b.body = nb.innerHTML; touch(nb); save(); });

    /* What the menu holds. One item today, and a second one is another entry in this array. */
    function acts() {
      return [{
        label: 'Delete this lecture',
        name: said(b, 'Delete'),
        hot: true,
        run: function () { ask(d, b); },
      }];
    }

    /* A summary opens on any click that reaches it, so the press is cancelled here the way it is
       on the heading. Pressing the dots a second time closes the menu, which works because the
       document handler above leaves this button alone. */
    more.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (menu.btn === more) { shutMenu(true); return; }
      openMenu(more, acts(), false);
    });
    /* The keyboard opens it too. Enter and the space bar are answered here and their default
       press is cancelled, for two reasons: a button inside a summary lets that press through to
       the lecture, which would open the notes at the same time, and the click a browser makes
       out of the key would then reach the handler above and close what this just opened. Down
       goes to the first item, up to the last, which is what every other menu does. */
    more.addEventListener('keydown', function (e) {
      e.stopPropagation();
      var open = menu.btn === more;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (open) moveIn(e.key === 'ArrowDown' ? 0 : menu.items.length - 1);
        else openMenu(more, acts(), e.key === 'ArrowUp');
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') {
        e.preventDefault();
        if (open) shutMenu(true);
        else openMenu(more, acts(), false);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        shutMenu(true);
      }
    });

    return d;
  }

  /* Removing destroys something she wrote, so the menu item asks first. The question takes the
     place of the control that raised it, inside the row it belongs to, and Keep puts the row
     back exactly as it was. Choosing Delete in the menu is the first of two presses, and the
     second one is the only thing that destroys anything. */
  function ask(d, b) {
    var sum = d.querySelector('summary');
    if (sum.querySelector('.lecsure')) return;
    var del = sum.querySelector('.lecmore');
    del.hidden = true;

    /* The question and its two answers name the lecture, the way the dots and the menu item
       above them do. Read on its own, out of the row it sits in, "Remove" says nothing about
       what is about to go, and this is the press that destroys something she wrote. */
    var g = document.createElement('span');
    g.className = 'lecsure';
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', said(b, 'Remove'));
    var q = document.createElement('span');
    q.className = 'q';
    q.textContent = 'Remove this lecture and its notes?';
    var yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'yes';
    yes.textContent = 'Remove';
    yes.setAttribute('aria-label', said(b, 'Remove'));
    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'no';
    no.textContent = 'Keep';
    no.setAttribute('aria-label', said(b, 'Keep'));
    g.appendChild(q);
    g.appendChild(yes);
    g.appendChild(no);
    sum.appendChild(g);

    function shut(e) {
      e.preventDefault();
      e.stopPropagation();
      g.remove();
      del.hidden = false;
      del.focus();
    }
    yes.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      drop(b.id);
    });
    no.addEventListener('click', shut);
    g.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') shut(e);
    });
    yes.focus();
  }

  function drop(id) {
    store.blocks = store.blocks.filter(function (x) { return x.id !== id; });
    save();
    render();
    if (addBtn) addBtn.focus();
  }

  function add() {
    var b = { id: uid(), heading: '', body: '' };
    store.blocks.unshift(b);
    store.known[b.id] = 1;
    save();
    render();
    var d = listEl.querySelector('.lec[data-id="' + b.id + '"]');
    if (!d) return;
    // She added it to write in it, so this one opens. Nothing about that is remembered.
    d.open = true;
    var h = d.querySelector('.lech');
    if (h) h.focus();
  }

  function paintOne(el, b) {
    var h = el.querySelector('.lech'), nb = el.querySelector('.nb');
    if (h && h !== document.activeElement && h.textContent !== b.heading) h.textContent = b.heading;
    if (h) h.classList.toggle('is-empty', !String(b.heading || '').trim());
    if (nb && nb !== document.activeElement) {
      var v = Notes.clean(b.body || '');
      if (nb.innerHTML !== v) nb.innerHTML = v;
    }
    if (nb) { Notes.markEmpty(nb); touch(nb); }
  }

  /* A lecture already on the page keeps the element it has, so a toggle she opened stays open
     and a caret in it is not thrown away by a repaint. Nothing here sets `open`, which is what
     leaves every lecture closed on a fresh load. */
  function render() {
    var have = {};
    Array.prototype.forEach.call(listEl.children, function (el) {
      var id = el.getAttribute('data-id');
      if (id) have[id] = el;
    });
    var live = {};
    store.blocks.forEach(function (b) { live[b.id] = 1; });
    Object.keys(have).forEach(function (id) {
      if (!live[id]) {
        /* The menu lives at the end of the document, so a lecture removed in a second tab would
           otherwise leave its menu standing over a page it no longer belongs to. */
        if (menu.btn && have[id].contains(menu.btn)) shutMenu(false);
        have[id].remove();
      }
    });
    var prev = null;
    store.blocks.forEach(function (b) {
      var el = have[b.id] || make(b);
      var at = prev ? prev.nextSibling : listEl.firstChild;
      if (el !== at) listEl.insertBefore(el, at);
      paintOne(el, b);
      prev = el;
    });
    none.hidden = store.blocks.length > 0;
  }

  function build() {
    var bar = document.createElement('div');
    bar.className = 'lecbar';
    addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'lecadd';
    addBtn.innerHTML = PLUS + '<span>' + Notes.esc(ADD) + '</span>';
    addBtn.addEventListener('click', add);
    bar.appendChild(addBtn);

    listEl = document.createElement('div');
    listEl.className = 'leclist';

    none = document.createElement('p');
    none.className = 'lecnone';
    none.textContent = 'Nothing written yet. The button above starts a lecture, and the heading on it is yours to name.';

    host.appendChild(bar);
    host.appendChild(listEl);
    host.appendChild(none);
  }

  function start() {
    build();
    /* What the shared editor has to be told about this page. A note here is a lecture body,
       the accent swatch is purple on GNG2101, and a press on the bar writes the lecture it
       changed the same way typing in that lecture does. This runs before render() builds the
       first lecture, because the Cmd or Ctrl + H colour key inside an editor reads the same
       two settings the bar does. */
    Notes.bar({
      sel: '.nb',
      accent: 'Purple text',
      save: function (el) {
        var b = owner(el);
        if (b) { b.body = el.innerHTML; touch(el); save(); }
      },
    });
    store.load();
    render();
    /* A second copy of this page, open in another tab, writes the same key. Pick up what it
       saved, leaving alone whatever is being typed here at the time. */
    window.addEventListener('storage', function (e) {
      if (e.key && e.key !== KEY) return;
      store.load();
      render();
    });
    /* Printing opens every lecture and then puts back the ones that were closed, so a printed
       page carries the notes and the screen goes back to the list of headings. The browser
       fires both events at the window, so a listener on document never runs. */
    window.addEventListener('beforeprint', function () {
      Array.prototype.forEach.call(listEl.querySelectorAll('details.lec'), function (d) {
        if (!d.open) { d.dataset.wasShut = '1'; d.open = true; }
      });
    });
    window.addEventListener('afterprint', function () {
      Array.prototype.forEach.call(listEl.querySelectorAll('details.lec[data-was-shut]'), function (d) {
        d.open = false;
        delete d.dataset.wasShut;
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
