/* tasks.js
   Tick boxes for the task lists, saved in this browser.
   A page opts in by giving <body> a data-store attribute, which names the storage key.
   Every box is a real control: clickable, reachable by Tab, toggled with Space or Enter,
   and carrying aria-checked so a screen reader says which state it is in. */

(function () {
  var KEY = (document.body.dataset.store || location.pathname) + '-tasks-v1';
  var st = {};
  try { st = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { st = {}; }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }

  function paint(b) {
    var on = !!st[b.dataset.k];
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.closest('.task').classList.toggle('done', on);
  }

  document.querySelectorAll('.task .box[data-k]').forEach(function (b) {
    var heading = b.closest('.task').querySelector('.h');
    if (heading) b.setAttribute('aria-label', 'Mark done: ' + heading.textContent);
    paint(b);
    function flip() { st[b.dataset.k] = !st[b.dataset.k]; save(); paint(b); }
    b.addEventListener('click', flip);
    b.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    });
  });

  /* Printing opens every closed toggle, then puts it back as it was. */
  document.addEventListener('beforeprint', function () {
    document.querySelectorAll('details.spec').forEach(function (d) {
      if (!d.open) { d.dataset.wasShut = '1'; d.open = true; }
    });
  });
  document.addEventListener('afterprint', function () {
    document.querySelectorAll('details.spec[data-was-shut]').forEach(function (d) {
      d.open = false; delete d.dataset.wasShut;
    });
  });
})();
