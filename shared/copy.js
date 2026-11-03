/* A copy button on every pre.listing.
   Written by script so a control never appears unless it works. Each listing is wrapped in a
   positioned container and the button sits in the listing's own top right corner, where the
   reader is already looking when she wants the code. */

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
    var wrap = pre.parentNode;
    if (!wrap.classList || !wrap.classList.contains('listing-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'listing-wrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
    }
    if (wrap.querySelector('button.copy')) { return; }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy this code');
    btn.setAttribute('aria-live', 'polite');
    wrap.insertBefore(btn, pre);

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
