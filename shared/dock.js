/* dock.js
   The bar pinned to the bottom of the window, and the list of lectures it opens.

   A footer that behaves like the top bar. It holds its place as the page scrolls, so the button
   that adds a lecture, the list of what is already written, the way back to the course hub and
   the way back to the top are all one press away from the middle of a long page.

   A page opts in with two things: `has-dock` on <body>, which gives the document the height the
   bar covers, and the bar itself written at the end of the page.

     <div class="dock">
       <div class="prog"></div>
       <div class="in">
         <button type="button" data-dock-add aria-label="Add a lecture">…</button>
         <button type="button" data-dock-list aria-haspopup="menu" aria-expanded="false"
                 aria-label="Lectures on this page">…<span class="n"></span></button>
         <a href="./" aria-label="The hub, …">…</a>
         <button type="button" data-dock-top class="end" aria-label="Top of the page">…</button>
       </div>
     </div>

   Every control is optional and this file wires the ones it finds.

     data-dock-add    presses the page's own .lecadd button, so the bar and the top of the page
                      both run the one piece of code that adds a lecture. What follows is what
                      always follows: the new lecture opens at the top of the list and the caret
                      goes into its heading, which brings the page up to it from wherever she was.
     data-dock-list   opens the lectures on the page as a menu that jumps to one, and keeps a
                      count of them in its .n span.
     data-dock-top    returns to the top of the page.
     .prog            how far through the page this is, drawn along the bar's top edge.

   THE MENU IS BUILT AT THE END OF THE DOCUMENT and placed in window coordinates, because the bar
   it hangs off is fixed to the window. Escape closes it and puts focus back on the button that
   opened it, Tab does the same, the arrow keys walk it, and a press anywhere else closes it. The
   same keys the three dots menu on a lecture answers to.

   EVERY CONTROL NAMES ITSELF with an aria-label written into the page, because the words beside
   the icons are dropped on a narrow screen and a name taken from them would go with them.

   Nothing here stores anything and nothing here knows which course it is on. */

(function () {
  var dock = document.querySelector('.dock');
  if (!dock) return;

  /* ---------- how far through the page ---------- */

  var prog = dock.querySelector('.prog');
  function bar() {
    if (!prog) return;
    var se = document.scrollingElement || document.documentElement;
    var run = se.scrollHeight - window.innerHeight;
    prog.style.width = (run > 0 ? Math.min(100, Math.max(0, se.scrollTop / run * 100)) : 0) + '%';
  }

  /* ---------- what is on the page ---------- */

  function lectures() {
    return Array.prototype.slice.call(document.querySelectorAll('.leclist > .lec'));
  }
  function headingOf(d) {
    var h = d.querySelector('.lech');
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  var listBtn = dock.querySelector('[data-dock-list]');
  var countEl = listBtn ? listBtn.querySelector('.n') : null;
  var LISTNAME = (listBtn && listBtn.getAttribute('aria-label')) || 'Lectures on this page';

  function recount() {
    if (!listBtn) return;
    var n = lectures().length;
    if (countEl) countEl.textContent = n ? String(n) : '';
    listBtn.setAttribute('aria-label', LISTNAME + ', ' + n);
  }

  /* ---------- the menu ---------- */

  var POPID = 'dockpop-open';
  var pop = null, popBtn = null, items = [];

  function shut(refocus) {
    var b = popBtn;
    if (pop) pop.remove();
    pop = null;
    popBtn = null;
    items = [];
    if (!b) return;
    b.setAttribute('aria-expanded', 'false');
    b.removeAttribute('aria-controls');
    if (refocus && document.contains(b)) b.focus();
  }

  /* Above the button and flush with its left edge, which is where the bar it belongs to is. It
     is pushed back inside the window when it would run off the right, and it stops eight pixels
     under the top of the window when the list is long enough to reach it. */
  function place() {
    if (!pop || !popBtn) return;
    var r = popBtn.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = r.left;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    if (left < 8) left = 8;
    var top = r.top - 6 - h;
    if (top < 8) top = 8;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function moveIn(n) {
    var L = items.length;
    if (!L) return;
    items[((n % L) + L) % L].focus();
  }

  function menuKey(e) {
    e.stopPropagation();
    var i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); shut(true); return; }
    /* Tab hands focus back to the button and closes. The menu is the last thing in the document,
       so letting the browser move on from here would drop her at the end of the page. */
    if (e.key === 'Tab') { e.preventDefault(); shut(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveIn(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveIn(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); moveIn(0); }
    else if (e.key === 'End') { e.preventDefault(); moveIn(items.length - 1); }
  }

  /* A closed lecture opens, because she picked it to read it. Focus goes to the summary before
     the scroll, with the browser's own scroll on focus turned off, so the smooth scroll is the
     only thing that moves the page and a keyboard lands on the lecture it just jumped to. */
  function goTo(d) {
    d.open = true;
    var sum = d.querySelector('summary');
    if (sum) {
      try { sum.focus({ preventScroll: true }); } catch (e) { sum.focus(); }
    }
    try { d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    catch (e) { d.scrollIntoView(true); }
  }

  function openMenu() {
    shut(false);
    var lecs = lectures();

    pop = document.createElement('div');
    pop.className = 'dockpop';
    /* One menu is open at a time, so one id is enough for the button to point at. */
    pop.id = POPID;
    pop.setAttribute('role', 'menu');
    pop.setAttribute('aria-label', LISTNAME);

    if (!lecs.length) {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Nothing written yet. Add a lecture starts the first one.';
      pop.appendChild(p);
    } else {
      lecs.forEach(function (d, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.tabIndex = -1;

        var num = document.createElement('span');
        num.className = 'i';
        num.textContent = String(i + 1);

        var t = document.createElement('span');
        var head = headingOf(d);
        t.className = head ? 't' : 't none';
        t.textContent = head || 'No heading yet';

        b.appendChild(num);
        b.appendChild(t);
        b.setAttribute('aria-label',
          (head || 'Lecture with no heading') + ', ' + (i + 1) + ' of ' + lecs.length);
        b.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          shut(false);
          goTo(d);
        });
        pop.appendChild(b);
      });
    }

    pop.addEventListener('keydown', menuKey);
    /* A press that lands on the menu's own padding, or in the gap between two items, would
       otherwise blur the item and leave focus on the page body with the menu still standing. */
    pop.addEventListener('mousedown', function (e) {
      if (!e.target.closest('[role="menuitem"]')) e.preventDefault();
    });
    document.body.appendChild(pop);

    popBtn = listBtn;
    items = Array.prototype.slice.call(pop.querySelectorAll('[role="menuitem"]'));
    listBtn.setAttribute('aria-expanded', 'true');
    listBtn.setAttribute('aria-controls', POPID);
    place();
    moveIn(0);
  }

  /* A press anywhere else closes it. The button itself is left out, because its own click is
     what closes a menu that is already open. */
  document.addEventListener('mousedown', function (e) {
    if (!pop) return;
    var t = e.target;
    if (t.closest && (t.closest('.dockpop') || t.closest('[data-dock-list]'))) return;
    shut(false);
  });
  /* Escape with the list empty, where focus is still on the button and the menu's own handler
     never sees the key. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && pop) shut(true);
  });

  /* ---------- the controls ---------- */

  function wire() {
    var addBtn = dock.querySelector('[data-dock-add]');
    if (addBtn) addBtn.addEventListener('click', function () {
      shut(false);
      /* Looked up on the press, because the page builds its own button after this file runs. */
      var page = document.querySelector('.lecadd');
      if (page) page.click();
    });

    if (listBtn) listBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (pop) shut(true);
      else openMenu();
    });

    var topBtn = dock.querySelector('[data-dock-top]');
    if (topBtn) topBtn.addEventListener('click', function () {
      shut(false);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (e) { window.scrollTo(0, 0); }
    });
  }

  function start() {
    wire();
    recount();
    /* The count follows the list: a lecture added from either button, one deleted, and one that
       arrived from a second tab. Only the lectures themselves are watched, so a keystroke inside
       a note costs nothing. The headings are read when the menu opens, which is the only moment
       they are drawn. */
    var listEl = document.querySelector('.leclist');
    if (listEl && window.MutationObserver) {
      new MutationObserver(function () {
        recount();
        /* An open menu is now a list of lectures that have moved, so it goes. Focus comes back
           to the button when it was inside the menu, and stays where it is otherwise. */
        if (pop) shut(items.indexOf(document.activeElement) >= 0);
      }).observe(listEl, { childList: true });
    }
    window.addEventListener('scroll', bar, { passive: true });
    window.addEventListener('resize', function () { bar(); place(); });
    bar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
