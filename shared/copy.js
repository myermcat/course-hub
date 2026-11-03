/* A copy button on every pre.listing.
   Written by script so a control never appears unless it works. The button goes in the
   listing's head row, which is created when the page did not write one. */

(function () {
  function label(btn, text, state) {
    btn.textContent = text;
    if (state) { btn.dataset.state = state; } else { delete btn.dataset.state; }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function wire(pre) {
    var head = pre.previousElementSibling;
    if (!head || !head.classList.contains('listing-head')) {
      head = document.createElement('div');
      head.className = 'listing-head';
      pre.parentNode.insertBefore(head, pre);
    }
    if (head.querySelector('button.copy')) { return; }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy this code');
    btn.setAttribute('aria-live', 'polite');
    head.appendChild(btn);

    var timer = null;
    btn.addEventListener('click', function () {
      var text = (pre.innerText || pre.textContent || '').replace(/\s+$/, '');
      var settle = function (ok) {
        label(btn, ok ? 'Copied' : 'Press ' + (navigator.platform.indexOf('Mac') === 0 ? 'Cmd' : 'Ctrl') + '+C',
              ok ? 'done' : 'failed');
        clearTimeout(timer);
        timer = setTimeout(function () { label(btn, 'Copy', null); }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { settle(true); },
                                                 function () { settle(fallbackCopy(text)); });
      } else {
        settle(fallbackCopy(text));
      }
    });
  }

  function run() {
    var list = document.querySelectorAll('pre.listing');
    for (var i = 0; i < list.length; i++) { wire(list[i]); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
