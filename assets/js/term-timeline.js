/*
 * The year-at-a-glance timeline (layouts/partials/term-timeline.html; styles in term-timeline.css).
 * Places the "Today" line, shows the lanes of date badges the "Show:" buttons ask for (remembered per visitor),
 * lists those dates under the chart, and shows a badge's details when it is tapped or focused.
 * On /classes/ a tapped term bar sends a 'pcyo:term' event, which assets/js/classes.js listens for.
 */
(function () {
  var svg = document.getElementById('termTimeline');
  var p = svg.dataset.t0.split('-').map(Number);
  var t0 = new Date(p[0], p[1] - 1, p[2]);
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var days = (today - t0) / 864e5;
  var x = Number(svg.dataset.left) + days * Number(svg.dataset.px);
  if (days >= 0 && x <= Number(svg.dataset.right)) {
    var g = document.getElementById('todayMarker');
    g.setAttribute('transform', 'translate(' + x + ',0)');
    g.classList.remove('term-timeline__hidden');
  }

  // Show toggles (icon + text, on/off): remembered per visitor. They only affect this chart; the full calendar always shows everything.
  // When the page offers a single kind, the toggles are hidden: that kind is always on and nothing is remembered,
  // so this page doesn't overwrite what the visitor picked on a page with all the toggles.
  var KEY = 'pcyo-timeline-show';
  var controls = document.getElementById('tlControls');
  var remember = !controls.hidden;
  var pickTerms = svg.dataset.pickTerms === 'true';   // tapping a term bar picks its classes (/classes/ only)
  var boxes = Array.prototype.slice.call(controls.querySelectorAll('[data-show]'));
  function isOn(b) { return b.getAttribute('aria-pressed') === 'true'; }
  if (remember) try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) boxes.forEach(function (b) { b.setAttribute('aria-pressed', saved.indexOf(b.dataset.show) !== -1); });
  } catch (e) {}
  var markers = Array.prototype.slice.call(svg.querySelectorAll('.tl-m'));
  var info = document.getElementById('tlInfo');
  var list = document.getElementById('tlList');
  var LANES = ['off', 'pcyo', 'sco', 'dates'], lane0 = Number(svg.dataset.lane0), GAP = 28, MIN = 23;

  // a badge's text, linked to its event page when it has one
  function linked(m) {
    if (!m.dataset.url) return document.createTextNode(m.dataset.info);
    var a = document.createElement('a');
    a.href = m.dataset.url; a.className = 'link blue underline-hover'; a.textContent = m.dataset.info;
    return a;
  }
  function apply() {
    var show = boxes.filter(isOn).map(function (b) { return b.dataset.show; });
    if (remember) try { localStorage.setItem(KEY, JSON.stringify(show)); } catch (e) {}
    // a picked item whose kind was just switched off: hide its details again (a picked term bar stays)
    if (picked && !picked.classList.contains('tl-term') && show.indexOf(picked.classList.contains('tl-off') ? 'off' : picked.dataset.type) === -1) {
      svg.querySelectorAll('.tl-m.sel').forEach(function (e) { e.classList.remove('sel'); });
      info.textContent = '';
      info.hidden = true;
      allOff = false;
      picked = null;
    }
    svg.querySelectorAll('.tl-off').forEach(function (r) { r.style.display = show.indexOf('off') !== -1 ? '' : 'none'; });
    var on = markers.filter(function (m) { return show.indexOf(m.dataset.type) !== -1; })
      .sort(function (a, b) { return a.dataset.date < b.dataset.date ? -1 : a.dataset.date > b.dataset.date ? 1 : 0; });
    // each lane with something ticked gets its own row
    var y = {}, n = 0;
    LANES.forEach(function (id) {
      var g = svg.querySelector('.tl-lane[data-lane="' + id + '"]');
      var used = on.some(function (m) { return m.dataset.lane === id; });
      g.classList.toggle('term-timeline__hidden', !used);
      if (used) { y[id] = lane0 + n * GAP; g.setAttribute('transform', 'translate(0,' + y[id] + ')'); n++; }
    });
    // place badges; nudge right when two in a lane would overlap
    var lastX = {};
    markers.forEach(function (m) { m.style.display = 'none'; });
    on.forEach(function (m) {
      var id = m.dataset.lane, mx = Number(m.dataset.x);
      if (lastX[id] !== undefined && mx - lastX[id] < MIN) mx = lastX[id] + MIN;
      lastX[id] = mx;
      m.setAttribute('transform', 'translate(' + mx + ',' + y[id] + ')');
      var span = m.querySelector('.span');   // day-off bars stay on their real dates
      if (span) span.setAttribute('x', Number(m.dataset.x0) - mx);
      m.style.display = '';
    });
    // stretch the chart to fit the lanes
    var bottom = n ? lane0 + (n - 1) * GAP + 16 : lane0 - 8;
    svg.querySelectorAll('.tl-grid').forEach(function (l) { l.setAttribute('y2', bottom); });
    document.getElementById('todayLine').setAttribute('y2', bottom + 4);
    document.getElementById('todayText').setAttribute('y', bottom + 16);
    svg.setAttribute('viewBox', '0 0 1080 ' + (bottom + 24));
    // dates list under the chart (days off stay out of it: tap one to see them all).
    // A joint concert is listed once, with each group's icon.
    list.innerHTML = '';
    on.filter(function (m) { return m.dataset.type !== 'off' && !m.dataset.copy; }).forEach(function (m) {
      var q = m.dataset.date.split('-').map(Number), past = new Date(q[0], q[1] - 1, q[2]) < today;
      var li = document.createElement('li');
      li.className = past ? 'moon-gray' : '';
      li.innerHTML = (m.dataset.icos || m.dataset.ico).split(' ').map(function (ico) {
        return '<svg width="16" height="16" viewBox="-11 -11 22 22" aria-hidden="true" class="v-mid"><use href="#ico-' + ico + '" x="-11" y="-11" width="22" height="22"/></svg>';
      }).join('');
      li.appendChild(linked(m));
      list.appendChild(li);
    });
    document.dispatchEvent(new CustomEvent('pcyo:show', { detail: show }));
  }
  boxes.forEach(function (b) { b.addEventListener('click', function () { b.setAttribute('aria-pressed', !isOn(b)); apply(); }); });
  window.pcyoShow = function () { return boxes.filter(isOn).map(function (b) { return b.dataset.show; }); };

  // Tap / click / keyboard for details
  var allOff = false;   // "Show all days off" expanded?
  var picked = null;    // the badge or day-off bar whose details are showing
  var offMarkers = markers.filter(function (m) { return m.dataset.type === 'off'; });
  function offIcon(m) {
    return '<svg width="16" height="16" viewBox="-11 -11 22 22" aria-hidden="true" class="v-mid mr1"><use href="#ico-' + m.dataset.ico + '" x="-11" y="-11" width="22" height="22"/></svg>';
  }
  function pick(el) {
    picked = el;
    svg.querySelectorAll('.tl-m.sel').forEach(function (e) { e.classList.remove('sel'); });
    if (el.classList.contains('tl-m')) el.classList.add('sel');
    info.textContent = '';
    info.appendChild(document.createTextNode(el.dataset.info));
    if (el.dataset.url) {   // concerts with an event page
      var a = document.createElement('a');
      a.href = el.dataset.url; a.className = 'link blue underline ml2'; a.textContent = 'Event details';
      info.appendChild(a);
    }
    info.hidden = false;
    var isOff = el.dataset.type === 'off' || el.classList.contains('tl-off');
    if (!isOff) return;
    // a day off: offer the full list of days off under its details
    var more = document.createElement('div');
    more.className = 'mt2 f6';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pointer bn bg-transparent pa0 blue underline';
    btn.setAttribute('aria-expanded', allOff);
    btn.textContent = allOff ? 'Hide other days off' : 'Show all days off';
    more.appendChild(btn);
    if (allOff) {
      var ul = document.createElement('ul');
      ul.className = 'list pl0 mt2 mb0';
      offMarkers.forEach(function (m) {
        var li = document.createElement('li');
        var q = m.dataset.date.split('-').map(Number);
        li.className = 'pv1' + (m.dataset.info === el.dataset.info ? ' b' : '') + (new Date(q[0], q[1] - 1, q[2]) < today ? ' moon-gray' : '');
        li.innerHTML = offIcon(m);
        li.appendChild(document.createTextNode(m.dataset.info));
        ul.appendChild(li);
      });
      more.appendChild(ul);
    }
    btn.addEventListener('click', function () { allOff = !allOff; pick(el); });
    info.appendChild(more);
  }
  // On /classes/, tapping a term bar shows that term's classes below (classes.js listens for 'pcyo:term').
  // Elsewhere a term bar is a .tl-hit, so tapping it shows its dates in the details box.
  function choose(term) { document.dispatchEvent(new CustomEvent('pcyo:term', { detail: term.dataset.term })); }
  svg.addEventListener('click', function (e) {
    var el = e.target.closest('.tl-hit'); if (el) pick(el);
    var term = e.target.closest('.tl-term'); if (term && pickTerms) choose(term);
  });
  svg.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('.tl-m')) { e.preventDefault(); pick(e.target.closest('.tl-m')); }
    else if (e.target.classList.contains('tl-term')) { e.preventDefault(); if (pickTerms) choose(e.target); else pick(e.target); }
  });
  markers.forEach(function (m) { m.addEventListener('focus', function () { pick(m); }); });
  apply();
})();
