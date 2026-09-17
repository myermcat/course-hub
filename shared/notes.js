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

   Removing a lecture asks first. The control is the size of the pencil in links.js and sits at
   the right of the summary; pressing it turns that end of the row into a question with two
   answers, and only the second press destroys anything.

   THE EDITOR is the one the PHI2394 reading guide and its lecture notes page use, carried
   across whole: Cmd or Ctrl with B, I and H, the floating bar on a selection, the four
   colours, the markdown-ish shortcuts for lists, headings, quotes and rules, Tab to indent
   inside a list, paste that keeps the shape and throws the rest away, and the rule that a
   fresh empty line drops the formatting of the line above it.

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
  var lastPaint = 'c-y';

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

  /* What is allowed to come back out of storage and into a page. Anything that could run, and
     every attribute that could carry code, is dropped, so a value written by something other
     than this file cannot reach the document. The five colour classes are the only classes
     kept, because they are the only ones the editor writes. */
  function clean(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html == null ? '' : html);
    Array.prototype.forEach.call(d.querySelectorAll('script,style,iframe,object,embed,link'),
      function (n) { n.remove(); });
    Array.prototype.forEach.call(d.querySelectorAll('hr[id]'), function (n) { n.removeAttribute('id'); });
    Array.prototype.forEach.call(d.querySelectorAll('*'), function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || (a.name === 'href' && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
        if (a.name === 'class' && !/^(c-y|c-p|c-g|c-m|c-n)$/.test(a.value)) n.removeAttribute(a.name);
        if (a.name === 'style') n.removeAttribute(a.name);
      });
    });
    return d.innerHTML;
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
        if (!editingIn(id, '.nb')) b.body = clean(raw.body);
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
        return { id: String(b.id), heading: oneLine(b.heading), body: clean(b.body) };
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

  /* ---------- the editor, the one the PHI2394 guide uses ---------- */

  /* Every change goes through execCommand, because the browser's undo stack only records
     those: a raw Range mutation leaves Cmd+Z with nothing to undo. */
  function caretEnd(node) {
    var r = document.createRange();
    r.selectNodeContents(node); r.collapse(false);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function prime(el) {
    if (!el.querySelector('p,div,h3,h4,h5,ul,ol,blockquote,hr')) {
      /* A note saved as bare text, or as bare bold or coloured markup, holds no block element.
         Wrap what the box already has. Replacing the contents throws that note away the moment
         she clicks into it. */
      var had = el.innerHTML.trim();
      el.innerHTML = '<p>' + (had || '<br>') + '</p>';
      if (el === document.activeElement) caretEnd(el.firstElementChild);
    }
  }
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\r?\n/g, '<br>');
  }
  function inColour(el) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    var n = sel.getRangeAt(0).startContainer;
    if (n.nodeType === 3) n = n.parentElement;
    while (n && n !== el && el.contains(n)) {
      if (n.tagName === 'SPAN' && /^c-[ypgm]$/.test(n.className)) return true;
      n = n.parentNode;
    }
    return false;
  }
  /* Keep the shape and the colours of what was copied, and throw the rest away. Pasting a
     whole web page's markup into a note is how a note stops looking like the others. */
  function pasteHtml(html) {
    if (!html) return '';
    var d = document.createElement('div');
    d.innerHTML = String(html);
    Array.prototype.forEach.call(d.querySelectorAll('script,style,meta,link,title,iframe,object,embed'),
      function (n) { n.remove(); });
    // Chrome brackets a copied fragment with comment markers, which arrive as empty nodes.
    var cw = document.createTreeWalker(d, NodeFilter.SHOW_COMMENT, null), cs = [], cn;
    while ((cn = cw.nextNode())) cs.push(cn);
    cs.forEach(function (c) { c.parentNode.removeChild(c); });
    var OK = /^(B|STRONG|I|EM|U|S|BR|P|DIV|UL|OL|LI|H3|H4|H5|BLOCKQUOTE|SPAN)$/;
    var all = Array.prototype.slice.call(d.querySelectorAll('*'));
    for (var i = all.length - 1; i >= 0; i--) {
      var n = all[i], keep = OK.test(n.tagName);
      if (keep && n.tagName === 'SPAN') keep = /^c-[ypgmn]$/.test(n.getAttribute('class') || '');
      if (!keep) {
        var par = n.parentNode;
        if (!par) continue;
        while (n.firstChild) par.insertBefore(n.firstChild, n);
        par.removeChild(n);
        continue;
      }
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        if (a.name !== 'class') n.removeAttribute(a.name);
      });
    }
    return d.textContent.trim() || d.querySelector('br,hr') ? d.innerHTML : '';
  }
  // Is there already a colour on this selection, whether it sits inside one or covers one
  function selColoured(el) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    if (inColour(el)) return true;
    var r = sel.getRangeAt(0), found = false;
    Array.prototype.forEach.call(el.querySelectorAll('.c-y, .c-p, .c-g, .c-m'), function (e) {
      if (!found && r.intersectsNode(e)) found = true;
    });
    return found;
  }
  /* Some apps put nothing but plain text on the clipboard, and a list copied from one of those
     arrives as lines that begin with a dash. Read them back as a list. */
  function plainList(t) {
    var lines = String(t || '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return '';
    var ol = lines.every(function (l) { return /^\s*\d+[.)]\s+\S/.test(l); });
    var ul = lines.every(function (l) { return /^\s*[-*\u2022\u2013]\s+\S/.test(l); });
    if (!ol && !ul) return '';
    var tag = ol ? 'ol' : 'ul';
    return '<' + tag + '>' + lines.map(function (l) {
      return '<li>' + esc(l.replace(/^\s*(?:\d+[.)]|[-*\u2022\u2013])\s+/, '')) + '</li>';
    }).join('') + '</' + tag + '>';
  }
  function unpaint(el) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    var n = sel.getRangeAt(0).startContainer;
    if (n.nodeType === 3) n = n.parentElement;
    /* Only the empty colour spans the caret is actually sitting inside, so nothing already
       written elsewhere in the note is touched. A colour put on bold text goes on the `b`
       element, so the tags that can carry one are all named here. Blocks stay out of it: an
       empty paragraph has to keep being a paragraph. */
    var home = null;
    while (n && n !== el && el.contains(n)) {
      var up = n.parentNode;
      if (/^(SPAN|B|STRONG|I|EM|U|S|STRIKE|FONT)$/.test(n.tagName) && /^c-[ypgm]$/.test(n.className) && !n.textContent) {
        while (n.firstChild) up.insertBefore(n.firstChild, n);
        up.removeChild(n); home = up;
      }
      n = up;
    }
    if (!home) return false;
    if (!home.firstChild) home.appendChild(document.createElement('br'));
    var r = document.createRange();
    r.setStart(home, 0); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
    return true;
  }
  function markEmpty(el) { el.classList.toggle('is-empty', !el.textContent.trim() && !el.querySelector('hr,img')); }
  function blockOf(el, node) {
    var b = node && (node.nodeType === 3 ? node.parentElement : node);
    while (b && b !== el && !/^(P|DIV|H[1-6]|BLOCKQUOTE|LI)$/.test(b.tagName)) b = b.parentElement;
    return b;
  }
  /* Is the caret on a line with nothing written on it yet. Pressing Enter in the middle of a
     bold sentence splits it and leaves text on both sides of the break, so the answer there is
     no and both halves keep their bold. */
  function freshLine(el) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    var n = sel.getRangeAt(0).startContainer;
    var at = n.nodeType === 3 ? n.parentNode : n;
    if (at !== el && !el.contains(at)) return false;
    var blk = blockOf(el, n) || el;
    return !blk.textContent.trim() && !blk.querySelector('hr,img');
  }
  /* Turn off bold, italic, underline and strikethrough at the caret. Each one is tested with
     queryCommandState and toggled only when it is already on, because the same command that
     turns a format off turns it on again. A list item keeps its place: the toggle acts on the
     caret's typing state and leaves the li standing. */
  var CHARFMT = ['bold', 'italic', 'underline', 'strikeThrough'];
  function plainCaret() {
    var did = false;
    // Plain B and I tags, the same markup the toolbar buttons write.
    try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    CHARFMT.forEach(function (c) {
      var on = false;
      try {
        if (document.queryCommandSupported && !document.queryCommandSupported(c)) return;
        on = document.queryCommandState(c);
      } catch (e) { return; }
      if (!on) return;
      try { document.execCommand(c, false, null); did = true; } catch (e) {}
    });
    return did;
  }
  function rich(el, onChange) {
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    markEmpty(el);
    el.addEventListener('focus', function () { prime(el); markEmpty(el); });
    el.addEventListener('input', function () { markEmpty(el); });
    /* Chrome carries inline formatting across a paragraph break, so a line started at the end
       of a coloured run comes out coloured and one started at the end of a bold run comes out
       bold. Enter clears both on a line that is still empty: `plainCaret` turns off the
       character formats, `unpaint` removes the empty colour span, because colour has no plain
       white. `unpaint` goes first because it moves the caret, and moving the caret is what
       throws away the pending state `plainCaret` leaves behind for the next character typed. */
    el.addEventListener('keyup', function (e) {
      if (e.key !== 'Enter') return;
      var changed = unpaint(el);
      if (freshLine(el) && plainCaret()) changed = true;
      if (changed && onChange) onChange();
    });
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      var cd = e.clipboardData || window.clipboardData;
      var safe = pasteHtml(cd.getData('text/html'));
      if (safe) {
        /* Pasting inside a coloured run took that run's colour, because the caret is inside
           its span. Say the colour out loud for anything that arrived without one. */
        if (inColour(el) && !/^<span class="c-[ypgmn]"/.test(safe)) safe = '<span class="c-n">' + safe + '</span>';
        document.execCommand('insertHTML', false, safe);
      } else {
        var t = cd.getData('text/plain'), asList = plainList(t);
        if (asList) document.execCommand('insertHTML', false, asList);
        else if (inColour(el)) document.execCommand('insertHTML', false, '<span class="c-n">' + esc(t) + '</span>');
        else document.execCommand('insertText', false, t);
      }
      markEmpty(el);
      if (onChange) onChange();
    });
    el.addEventListener('keydown', function (e) {
      /* Tab inside a list indents it. Without this it leaves the note for the next control,
         which is right everywhere else on a page and wrong inside a list. */
      if (e.key === 'Tab') {
        var a = window.getSelection() && window.getSelection().anchorNode;
        var b = a && (a.nodeType === 3 ? a.parentElement : a);
        if (b && b.closest && b.closest('li')) {
          e.preventDefault();
          document.execCommand(e.shiftKey ? 'outdent' : 'indent', false, null);
          if (onChange) onChange();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'h' || e.key === 'H')) {
        // One key both ways: colour plain text, and take the colour back off coloured text.
        e.preventDefault();
        paintSel(selColoured(el) ? null : lastPaint);
        if (onChange) onChange();
        return;
      }
      if (e.key !== ' ' && e.key !== 'Enter' && e.key !== '-') return;
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
      var r = sel.getRangeAt(0);
      var blk = blockOf(el, r.startContainer) || el;
      var pre = document.createRange();
      pre.selectNodeContents(blk);
      try { pre.setEnd(r.startContainer, r.startOffset); } catch (err) { return; }
      var head = pre.toString(), cmd = null, arg = null, m;
      var inLi = blk && blk.tagName === 'LI';
      if (e.key === ' ') {
        if (inLi) return;
        if (head.match(/^\s*[-*+]$/)) cmd = 'ul';
        else if (head.match(/^\s*\d+[.)]$/)) cmd = 'ol';
        else if ((m = head.match(/^\s*(#{1,3})$/))) { cmd = 'block'; arg = 'h' + (m[1].length + 2); }
        else if (head.match(/^\s*>$/)) { cmd = 'block'; arg = 'blockquote'; }
        else if (head.match(/^\s*-{2,3}$/)) cmd = 'hr';
      } else if (e.key === '-') {
        if (inLi || !head.match(/^\s*--$/)) return;
        cmd = 'hr';
      } else if (head.match(/^\s*-{2,3}$/)) { cmd = 'hr'; }
      if (!cmd) return;
      e.preventDefault();
      if (cmd === 'block' && blk !== el) {
        // Replace the whole line with the new block, in one undoable step.
        var inner = blk.innerHTML.replace(/^(?:\s|&nbsp;|<br\s*\/?>)*(?:#{1,3}|&gt;|>)/, '') || '<br>';
        var rr = document.createRange();
        rr.selectNode(blk);
        sel.removeAllRanges(); sel.addRange(rr);
        document.execCommand('insertHTML', false, '<' + arg + '>' + inner + '</' + arg + '>');
        var all = el.getElementsByTagName(arg);
        if (all.length) caretEnd(all[all.length - 1]);
      } else {
        sel.removeAllRanges(); sel.addRange(pre);
        document.execCommand('delete', false, null);
        if (cmd === 'ul') document.execCommand('insertUnorderedList', false, null);
        else if (cmd === 'ol') document.execCommand('insertOrderedList', false, null);
        else if (cmd === 'hr') {
          document.execCommand('insertHorizontalRule', false, null);
          /* The caret is left loose after the rule, where typing makes a bare text node that
             no later heading or list command can act on. Give it a paragraph to land in. */
          document.execCommand('insertHTML', false, '<p><br></p>');
          var ps = el.getElementsByTagName('p');
          if (ps.length) {
            var last = ps[ps.length - 1], r2 = document.createRange();
            r2.setStart(last, 0); r2.collapse(true);
            var ss = window.getSelection(); ss.removeAllRanges(); ss.addRange(r2);
          }
        }
        else {
          document.execCommand('insertHTML', false, '<' + arg + '><br></' + arg + '>');
          var a2 = el.getElementsByTagName(arg);
          if (a2.length) caretEnd(a2[a2.length - 1]);
        }
      }
      Array.prototype.forEach.call(el.querySelectorAll('hr[id]'), function (n) { n.removeAttribute('id'); });
      markEmpty(el);
      if (onChange) onChange();
    });
  }
  /* Colour a selection. `foreColor` is the browser's own command, so it leaves headings, list
     items and paragraphs standing where replacing the selection's HTML flattened them. It marks
     the text with a colour nobody would type, which is then swapped for a class so both themes
     stay readable. */
  var CDOT = { 'c-y': '#010201', 'c-p': '#010202', 'c-m': '#010203', 'c-n': '#010204', 'c-g': '#010205' };
  var CBACK = { 'rgb(1,2,1)': 'c-y', 'rgb(1,2,2)': 'c-p', 'rgb(1,2,3)': 'c-m', 'rgb(1,2,4)': 'c-n',
                'rgb(1,2,5)': 'c-g',
                '#010201': 'c-y', '#010202': 'c-p', '#010203': 'c-m', '#010204': 'c-n', '#010205': 'c-g' };
  /* Where a boundary falls, counted in characters from the start of the editor. Comparing
     DOM boundary points directly says a span starts before its own first character, which
     makes a selection of exactly that span's text look like it falls short of covering it. */
  function charPos(host2, node, off) {
    var r = document.createRange();
    try { r.setStart(host2, 0); r.setEnd(node, off); } catch (e) { return -1; }
    return r.toString().length;
  }
  function wholly(r, el, host2) {
    var rs = charPos(host2, r.startContainer, r.startOffset);
    var re = charPos(host2, r.endContainer, r.endOffset);
    var es = charPos(host2, el, 0), ee = es + el.textContent.length;
    if (rs < 0 || re < 0 || es < 0 || ee <= es) return false;
    return es >= rs && ee <= re;
  }
  function paintSel(cls) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    var r = sel.getRangeAt(0), n = r.commonAncestorContainer;
    if (n.nodeType === 3) n = n.parentElement;
    /* Selecting a whole block puts the anchor on the block itself, where a lookup from the
       anchor finds nothing and the colour silently does not apply. */
    var box = n && n.closest ? n.closest('.nb') : null;
    if (!box) {
      var act = document.activeElement;
      if (act && act.classList && act.classList.contains('nb')) box = act;
    }
    if (!box) return;
    if (cls && cls !== 'c-n') lastPaint = cls;
    /* A colour already inside the selection sits deeper than the new one and would win, so
       clear the ones the selection covers whole. One it only overlaps keeps its colour outside. */
    Array.prototype.forEach.call(box.querySelectorAll('.c-y, .c-p, .c-g, .c-m, .c-n'), function (e) {
      if (r.intersectsNode(e) && wholly(r, e, box)) e.removeAttribute('class');
    });
    var want = cls || (inColour(box) ? 'c-n' : null);
    if (want) {
      try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
      document.execCommand('foreColor', false, CDOT[want]);
      Array.prototype.forEach.call(box.querySelectorAll('[style], font[color]'), function (e) {
        var c = ((e.style && e.style.color) || e.getAttribute('color') || '').replace(/\s+/g, '').toLowerCase();
        var k = CBACK[c];
        if (!k) return;
        if (e.style) e.style.color = '';
        e.removeAttribute('color');
        if (!e.getAttribute('style')) e.removeAttribute('style');
        if (e.tagName === 'FONT') {
          var sp = document.createElement('span');
          while (e.firstChild) sp.appendChild(e.firstChild);
          e.parentNode.replaceChild(sp, e);
          e = sp;
        }
        e.className = k;
      });
    }
    var b = owner(box);
    if (b) { b.body = box.innerHTML; touch(box); save(); }
  }

  /* ---------- the floating bar over a selection ---------- */

  var nbbar = null;
  function hideBar() { if (nbbar) nbbar.hidden = true; }
  function wireBar() {
    nbbar = document.createElement('div');
    nbbar.id = 'nb-bar';
    nbbar.hidden = true;
    nbbar.innerHTML = '<button type="button" data-a="bold" title="Bold"><b>B</b></button>' +
      '<button type="button" class="i" data-a="italic" title="Italic">I</button>' +
      '<button type="button" class="l" data-a="insertUnorderedList" title="Bullet list">&bull; list</button>' +
      '<div class="sep"></div>' +
      '<button type="button" class="sw y" data-p="c-y" title="Yellow text"></button>' +
      '<button type="button" class="sw p" data-p="c-p" title="Pink text"></button>' +
      '<button type="button" class="sw g" data-p="c-g" title="Purple text"></button>' +
      '<button type="button" class="sw m" data-p="c-m" title="Grey it out, for an aside"></button>' +
      '<button type="button" class="sw x" data-p="" title="Back to normal">&times;</button>';
    document.body.appendChild(nbbar);
    nbbar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    nbbar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-p')) { paintSel(b.getAttribute('data-p')); hideBar(); return; }
      document.execCommand(b.getAttribute('data-a'), false, null);
      var el = document.activeElement;
      if (el && el.classList && el.classList.contains('nb')) {
        var blk = owner(el);
        if (blk) { blk.body = el.innerHTML; touch(el); save(); }
      }
    });
    function place() {
      var a = document.activeElement, sel = window.getSelection();
      var writing = a && a.classList && a.classList.contains('nb');
      if (!writing || !sel || sel.isCollapsed || !String(sel).trim()) { hideBar(); return; }
      var r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) { hideBar(); return; }
      nbbar.hidden = false;
      nbbar.style.top = (window.scrollY + r.top - nbbar.offsetHeight - 8) + 'px';
      nbbar.style.left = (window.scrollX + r.left) + 'px';
    }
    document.addEventListener('selectionchange', place);
    window.addEventListener('scroll', hideBar, { passive: true });
  }

  /* ---------- the lectures ---------- */

  var listEl = null, none = null, addBtn = null;

  var CROSS = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round"/></svg>';
  var PLUS = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round"/></svg>';

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

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'lecdel';
    del.title = 'Remove this lecture';
    del.setAttribute('aria-label', 'Remove this lecture');
    del.innerHTML = CROSS;

    sum.appendChild(h);
    sum.appendChild(del);

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
    h.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') {
        // One line, so Enter leaves the heading for the notes underneath.
        e.preventDefault();
        d.open = true;
        nb.focus();
        prime(nb);
        caretEnd(nb.lastElementChild || nb);
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
      b.heading = h.textContent;
      h.classList.toggle('is-empty', !h.textContent.trim());
      save();
    });
    h.addEventListener('blur', function () {
      var tidy = oneLine(h.textContent);
      if (h.textContent !== tidy) h.textContent = tidy;
      b.heading = tidy;
      h.classList.toggle('is-empty', !tidy);
      save();
    });

    nb.addEventListener('input', function () { b.body = nb.innerHTML; touch(nb); save(); });
    nb.addEventListener('blur', function () { hideBar(); b.body = nb.innerHTML; touch(nb); save(); });
    rich(nb, function () { b.body = nb.innerHTML; touch(nb); save(); });

    del.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      ask(d, b);
    });

    return d;
  }

  /* Removing destroys something she wrote, so the button asks first. The question takes the
     place of the control that raised it, inside the row it belongs to, and Keep puts the row
     back exactly as it was. */
  function ask(d, b) {
    var sum = d.querySelector('summary');
    if (sum.querySelector('.lecsure')) return;
    var del = sum.querySelector('.lecdel');
    del.hidden = true;

    var g = document.createElement('span');
    g.className = 'lecsure';
    var q = document.createElement('span');
    q.className = 'q';
    q.textContent = 'Remove this lecture and its notes?';
    var yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'yes';
    yes.textContent = 'Remove';
    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'no';
    no.textContent = 'Keep';
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
      var v = clean(b.body || '');
      if (nb.innerHTML !== v) nb.innerHTML = v;
    }
    if (nb) { markEmpty(nb); touch(nb); }
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
      if (!live[id]) have[id].remove();
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
    addBtn.innerHTML = PLUS + '<span>' + esc(ADD) + '</span>';
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
    wireBar();
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
