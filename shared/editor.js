/* editor.js
   The one editor. Every note she writes, in every course, is this file, and a page adds only
   the part that is its own.

   WHAT A PAGE GETS. A contentEditable element handed to Notes.rich() takes Cmd or Ctrl with B,
   I and H, raises a floating bar over any selection, carries the four colours, reads the
   markdown-ish shortcuts for lists, headings, quotes and rules, indents with Tab inside a list,
   keeps the shape of what is pasted and throws the rest away, and clears the formatting of the
   line above when a fresh line is still empty. Typing "->" gives an arrow and typing two
   hyphens gives an em dash.

   WHAT IT KNOWS NOTHING ABOUT. Storage, lectures, highlights, comment cards, the accent edge on
   a well, and every key any page writes. A page keeps all of that and hands this file two
   things: an element, and a function to call once something in it has changed.

   HOW A PAGE USES IT. A plain script tag, and no module loader.

     <script src="../shared/editor.js"></script>

     Notes.bar({
       sel: '.nb',                     what counts as an editor on this page
       accent: 'Purple text',          the title on the swatch painted in the page accent
       save: function (el) { … }       called with the element the bar has just changed
     });
     Notes.rich(el, function () { … });  called after every change this file makes to el

   Notes.bar() runs once, before the first editor is wired, because the colour key inside an
   editor reads the same two settings the bar does. Its three options are all optional: a page
   that has one kind of note block and saves through the callback on rich() can call it with
   nothing.

   WHY THE SWATCH TITLE IS A SETTING. The third swatch is painted in var(--accent), which is a
   different colour in every course: green on PHI2394, purple on GNG2101. The word in the
   tooltip has to follow the page, so the page says it.

   TWO REPOSITORIES, ONE FILE. This is the original. phi-reading-hub carries a copy of it at
   shared/editor.js, because the two repositories are published separately and a page opened
   from disk cannot reach across to the other one. A change is made here and copied over in the
   same edit, the way shared/nav.css already works. */

(function () {
  /* What counts as an editor on this page, and what to do once one has changed. Both are read
     at the moment they are needed, so a page that calls Notes.bar() during its own setup has
     them in place before a reader can select anything. */
  var cfg = {
    sel: '.nb',
    save: null,
    accent: 'Text in the course colour',
  };

  /* The colour the H key reaches for. It follows the last swatch pressed, so the key repeats
     whichever colour she was using. */
  var lastPaint = 'c-y';

  function isEditor(el) {
    return !!(el && el.matches && el.matches(cfg.sel));
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\r?\n/g, '<br>');
  }

  /* What is allowed to come back out of storage and into a page. Anything that could run, and
     every attribute that could carry code, is dropped, so a value written by something other
     than a page of hers cannot reach the document. The five colour classes are the only classes
     kept, because they are the only ones this editor writes. */
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

  /* An empty editor carries a class the stylesheet hangs its placeholder on. A rule or a
     picture counts as something written, because neither one puts any text in the box. */
  function markEmpty(el) {
    el.classList.toggle('is-empty', !el.textContent.trim() && !el.querySelector('hr,img'));
  }

  /* Every change goes through execCommand, because the browser's undo stack only records
     those: a raw Range mutation leaves Cmd+Z with nothing to undo. */
  function caretEnd(node) {
    var r = document.createRange();
    r.selectNodeContents(node); r.collapse(false);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  /* A shortcut typed in front of words already on the line should leave the caret where the
     marker was, which is where her hands already are, and not at the far end of the line. */
  function caretStart(node) {
    var r = document.createRange();
    r.selectNodeContents(node); r.collapse(true);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  /* The line with its first n characters taken off, as markup.

     Reading the marker off the front of innerHTML with a regular expression only worked while
     the line began with a bare text node. A line whose first characters sat inside a bold run
     or a coloured span began with a tag, the expression matched nothing, and the heading came
     out still carrying its "##". Counting characters through a copy of the line finds the
     marker wherever it is, and the copy keeps the copy: the live line is never touched, so the
     single insertHTML that replaces it is still one undoable step. */
  function lineWithout(blk, n) {
    var clone = blk.cloneNode(true);
    var w = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null), node, left = n;
    while (left > 0 && (node = w.nextNode())) {
      var take = Math.min(left, node.nodeValue.length);
      node.nodeValue = node.nodeValue.slice(take);
      left -= take;
    }
    Array.prototype.forEach.call(clone.querySelectorAll('b,strong,i,em,u,s,span,code,sub,sup'), function (x) {
      if (!x.textContent && !x.querySelector('br,img,hr')) x.remove();
    });
    return clone.innerHTML || '<br>';
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

  function blockOf(el, node) {
    var b = node && (node.nodeType === 3 ? node.parentElement : node);
    while (b && b !== el && !/^(P|DIV|H[1-6]|BLOCKQUOTE|LI)$/.test(b.tagName)) b = b.parentElement;
    return b;
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

  // Is there already a colour on this selection, whether it falls inside one or covers one
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

  function unpaint(el) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    var n = sel.getRangeAt(0).startContainer;
    if (n.nodeType === 3) n = n.parentElement;
    /* Only the empty colour spans the caret is actually inside, so nothing already written
       elsewhere in the note is touched. A colour put on bold text goes on the `b` element, so
       the tags that can carry one are all named here. Blocks stay out of it: an empty paragraph
       has to keep being a paragraph. */
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
    // Words, or a break or a rule on its own. Anything else that arrived was markup and no text.
    return (d.textContent.trim() || d.querySelector('br,hr')) ? d.innerHTML : '';
  }

  /* Some apps put nothing but plain text on the clipboard, and a list copied from one of those
     arrives as lines that begin with a dash. Read them back as a list. */
  function plainList(t) {
    var lines = String(t || '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return '';
    var ol = lines.every(function (l) { return /^\s*\d+[.)]\s+\S/.test(l); });
    var ul = lines.every(function (l) { return /^\s*[-*•–]\s+\S/.test(l); });
    if (!ol && !ul) return '';
    var tag = ol ? 'ol' : 'ul';
    return '<' + tag + '>' + lines.map(function (l) {
      return '<li>' + esc(l.replace(/^\s*(?:\d+[.)]|[-*•–])\s+/, '')) + '</li>';
    }).join('') + '</' + tag + '>';
  }

  /* TWO SUBSTITUTIONS SHE ASKED FOR WHILE TYPING.
     "->" becomes an arrow and two hyphens become an em dash, as soon as the second character is
     typed. Only the text immediately before a collapsed caret is read, so nothing already
     written is rewritten behind her, and the caret is put back after the character it
     replaced. */
  var SWAPS = [[/->$/, '→'], [/--$/, '—']];
  /* Everything typed on this line up to the caret. The dash swap has to know whether the two
     hyphens are the only thing on the line, because two hyphens at the start of a line are the
     beginning of a horizontal rule and were being eaten before the rule could fire. Every rule
     shortcut in the file was unreachable: "-- " and "---" and two hyphens then Enter all came
     out as a dash. */
  function lineHead(n, off) {
    var host = n.parentElement && n.parentElement.closest(cfg.sel);
    if (!host) return null;
    var blk = blockOf(host, n) || host;
    var r = document.createRange();
    r.selectNodeContents(blk);
    try { r.setEnd(n, off); } catch (e) { return null; }
    return r.toString();
  }
  function swapAsTyped() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    var r = sel.getRangeAt(0);
    if (!r.collapsed || r.startContainer.nodeType !== 3) return false;
    var n = r.startContainer, off = r.startOffset, before = n.nodeValue.slice(0, off);
    for (var i = 0; i < SWAPS.length; i++) {
      var m = before.match(SWAPS[i][0]);
      if (!m) continue;
      if (m[0] === '--') {
        var lh = lineHead(n, off);
        if (lh !== null && /^\s*--$/.test(lh)) return false;
      }
      var cut = m[0].length, to = SWAPS[i][1];
      n.nodeValue = before.slice(0, off - cut) + to + n.nodeValue.slice(off);
      var put = document.createRange();
      put.setStart(n, off - cut + to.length);
      put.collapse(true);
      sel.removeAllRanges();
      sel.addRange(put);
      return true;
    }
    return false;
  }

  /* ---------- the editor itself ---------- */

  function rich(el, onChange) {
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    markEmpty(el);
    el.addEventListener('focus', function () {
      /* Cmd+B is the browser's own command and reads the same flag, so it is set here
         too, once per visit to an editor. */
      try { document.execCommand('styleWithCSS', false, false); } catch (err) {}
      prime(el); markEmpty(el);
    });
    el.addEventListener('input', function () { swapAsTyped(); markEmpty(el); });
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
        /* The class is dropped on the way through insertHTML and comes out as whatever colour
           the class happened to resolve to, which clean() then strips on the way to storage.
           Send the marker colour instead and put the class back once it has landed. */
        safe = safe.replace(/ class="(c-[ypgmn])"/g, function (all, k) { return ' style="color:' + CDOT[k] + '"'; });
        document.execCommand('insertHTML', false, safe);
        reclass(el);
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
      if ((cmd === 'ul' || cmd === 'ol') && blk !== el && blk.tagName === 'P') {
        /* `insertUnorderedList` builds the list inside the block the caret is in, which leaves
           a <ul> within a <p>. That one nesting the parser will not have: on the next load it
           pulls the list out and leaves an empty paragraph above and below, one more pair every
           time. Replace the whole line instead, the way the heading branch below does, so the
           list stands beside the blocks around it, clear of any one of them. Only a paragraph
           is taken this way. A list nested in a div, a heading, a blockquote or another list
           item survives the parser untouched, and those lines are left to the plain command
           below, which does not disturb whatever block follows them. */
        var tag = cmd === 'ul' ? 'ul' : 'ol';
        var item = lineWithout(blk, head.length);
        var lr = document.createRange();
        lr.selectNode(blk);
        sel.removeAllRanges(); sel.addRange(lr);
        /* Marked so the caret goes into the list just made and not into whichever list happens
           to be last in the note. The mark comes straight back off, before anything is saved. */
        document.execCommand('insertHTML', false,
          '<' + tag + ' data-new="1"><li>' + item + '</li></' + tag + '>');
        var made = el.querySelector('[data-new]');
        if (made) made.removeAttribute('data-new');
        var cell = made && made.querySelector('li');
        if (!cell) { var lis = el.getElementsByTagName('li'); cell = lis.length ? lis[lis.length - 1] : null; }
        if (cell) caretStart(cell);
      } else if (cmd === 'block' && blk !== el) {
        // Replace the whole line with the new block, in one undoable step.
        var inner = lineWithout(blk, head.length);
        var rr = document.createRange();
        rr.selectNode(blk);
        sel.removeAllRanges(); sel.addRange(rr);
        document.execCommand('insertHTML', false, '<' + arg + '>' + inner + '</' + arg + '>');
        var all = el.getElementsByTagName(arg);
        if (all.length) caretStart(all[all.length - 1]);
      } else {
        sel.removeAllRanges(); sel.addRange(pre);
        document.execCommand('delete', false, null);
        if (cmd === 'ul') document.execCommand('insertUnorderedList', false, null);
        else if (cmd === 'ol') document.execCommand('insertOrderedList', false, null);
        else if (cmd === 'hr') {
          document.execCommand('insertHorizontalRule', false, null);
          /* The caret is left loose after the rule, where typing makes a bare text node that
             no later heading or list command can act on. Give it a paragraph to go into. */
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

  /* ---------- the four colours ---------- */

  /* Colour a selection. `foreColor` is the browser's own command, so it leaves headings, list
     items and paragraphs standing where replacing the selection's HTML flattened them. It marks
     the text with a colour nobody would type, which is then swapped for a class so both themes
     stay readable. */
  var CDOT = { 'c-y': '#010201', 'c-p': '#010202', 'c-m': '#010203', 'c-n': '#010204', 'c-g': '#010205' };
  var CBACK = { 'rgb(1,2,1)': 'c-y', 'rgb(1,2,2)': 'c-p', 'rgb(1,2,3)': 'c-m', 'rgb(1,2,4)': 'c-n',
                'rgb(1,2,5)': 'c-g',
                '#010201': 'c-y', '#010202': 'c-p', '#010203': 'c-m', '#010204': 'c-n', '#010205': 'c-g' };

  /* Where a boundary falls, counted in characters from the start of the editor. Comparing DOM
     boundary points directly says a span starts before its own first character, which makes a
     selection of exactly that span's text look like it falls short of covering it. */
  function charPos(root, node, off) {
    var r = document.createRange();
    try { r.setStart(root, 0); r.setEnd(node, off); } catch (e) { return -1; }
    return r.toString().length;
  }
  function wholly(r, el, root) {
    var rs = charPos(root, r.startContainer, r.startOffset);
    var re = charPos(root, r.endContainer, r.endOffset);
    var es = charPos(root, el, 0), ee = es + el.textContent.length;
    if (rs < 0 || re < 0 || es < 0 || ee <= es) return false;
    return es >= rs && ee <= re;
  }

  /* Turn the marker colours back into classes. `foreColor` can only be given a colour, and a
     pasted span's class is rewritten by the browser into an inline style on the way in, so both
     roads end at a colour written on the element. A class is what the page stores, because it
     is the only form that reads correctly in both themes and the only one clean() keeps. */
  function reclass(box) {
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

  function paintSel(cls) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    var r = sel.getRangeAt(0), n = r.commonAncestorContainer;
    if (n.nodeType === 3) n = n.parentElement;
    /* Selecting a whole block puts the anchor on the block itself, where a lookup from the
       anchor finds nothing and the colour silently does not apply. */
    var box = n && n.closest ? n.closest(cfg.sel) : null;
    if (!box && isEditor(document.activeElement)) box = document.activeElement;
    if (!box) return;
    if (cls && cls !== 'c-n') lastPaint = cls;
    /* A colour already inside the selection is deeper in the tree than the new one and would
       win, so clear the ones the selection covers whole. One it only overlaps keeps its colour
       outside. */
    Array.prototype.forEach.call(box.querySelectorAll('.c-y, .c-p, .c-g, .c-m, .c-n'), function (e) {
      if (!r.intersectsNode(e) || !wholly(r, e, box)) return;
      e.removeAttribute('class');
      /* A span that carried nothing but the colour has no job left, and one of them is added
         every time a colour is cleared. */
      if (e.tagName === 'SPAN' && !e.attributes.length) {
        var par = e.parentNode;
        while (e.firstChild) par.insertBefore(e.firstChild, e);
        par.removeChild(e); par.normalize();
      }
    });
    var want = cls || (inColour(box) ? 'c-n' : null);
    if (want) {
      try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
      document.execCommand('foreColor', false, CDOT[want]);
      reclass(box);
      /* foreColor needs styleWithCSS on, and it stays on for whatever comes next. Bold pressed
         after a colour then writes a style attribute, which clean() strips on the way to storage,
         so the bold was there until the next load and then gone. Put it back to writing tags. */
      try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    }
    if (cfg.save) cfg.save(box);
  }

  /* ---------- the floating bar over a selection ---------- */

  var nbbar = null;
  function hideBar() { if (nbbar) nbbar.hidden = true; }

  function bar(opts) {
    if (opts) {
      if (opts.sel) cfg.sel = opts.sel;
      if (opts.save) cfg.save = opts.save;
      if (opts.accent) cfg.accent = opts.accent;
    }
    // One bar serves every editor on the page, so a second call only carries new settings.
    if (nbbar) return;

    nbbar = document.createElement('div');
    nbbar.id = 'nb-bar';
    nbbar.hidden = true;
    nbbar.innerHTML = '<button type="button" data-a="bold" title="Bold"><b>B</b></button>' +
      '<button type="button" class="i" data-a="italic" title="Italic">I</button>' +
      '<button type="button" class="l" data-a="insertUnorderedList" title="Bullet list">&bull; list</button>' +
      '<div class="sep"></div>' +
      '<button type="button" class="sw y" data-p="c-y" title="Yellow text"></button>' +
      '<button type="button" class="sw p" data-p="c-p" title="Pink text"></button>' +
      '<button type="button" class="sw g" data-p="c-g"></button>' +
      '<button type="button" class="sw m" data-p="c-m" title="Grey it out, for an aside"></button>' +
      '<button type="button" class="sw x" data-p="" title="Back to normal">&times;</button>';
    /* The accent swatch is named through the property, so a page can say anything it likes in
       there without the quoting in the markup above having to survive it. */
    var g = nbbar.querySelector('.sw.g');
    if (g) g.title = cfg.accent;
    document.body.appendChild(nbbar);

    nbbar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    nbbar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-p')) { paintSel(b.getAttribute('data-p')); hideBar(); return; }
      /* Tags, never a style attribute. clean() strips style on the way to storage, so a bold
         written as one is on the screen until the next load and gone after it. Asked for here
         rather than trusted, because foreColor turns this on and the browser keeps it on. */
      try { document.execCommand('styleWithCSS', false, false); } catch (err) {}
      document.execCommand(b.getAttribute('data-a'), false, null);
      var el = document.activeElement;
      if (isEditor(el) && cfg.save) cfg.save(el);
    });

    function place() {
      var a = document.activeElement, sel = window.getSelection();
      if (!isEditor(a) || !sel || sel.isCollapsed || !String(sel).trim()) { hideBar(); return; }
      var r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) { hideBar(); return; }
      nbbar.hidden = false;
      nbbar.style.top = (window.scrollY + r.top - nbbar.offsetHeight - 8) + 'px';
      nbbar.style.left = (window.scrollX + r.left) + 'px';
    }
    document.addEventListener('selectionchange', place);
    window.addEventListener('scroll', hideBar, { passive: true });
  }

  /* What a page can reach. Everything else above is the editor's own business: a page that
     needs one of those has found a job for this file to do. */
  window.Notes = {
    rich: rich,
    bar: bar,
    hideBar: hideBar,
    clean: clean,
    esc: esc,
    markEmpty: markEmpty,
    prime: prime,
    caretEnd: caretEnd,
    swapAsTyped: swapAsTyped,
  };
})();
