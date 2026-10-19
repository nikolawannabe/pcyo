/*
 * On the 404 page (layouts/404.html): if the missing address is an old family document, go to its newest version.
 * The old → new addresses come from <script id="pcyo-moves">, written from data/parent-docs.yaml.
 */
(function () {
  // Compare addresses decoded, so "/Instrument%20Care.pdf" and "/Instrument Care.pdf" both match.
  function clean(path) { try { return decodeURIComponent(path); } catch (e) { return path; } }
  var moves = JSON.parse(document.getElementById('pcyo-moves').textContent);
  var here = clean(location.pathname);
  var to = null;
  Object.keys(moves).forEach(function (from) { if (clean(from) === here) to = moves[from]; });
  if (!to) return;
  document.getElementById('notFoundTitle').textContent = 'This document has moved';
  document.getElementById('notFoundLink').href = to;
  document.getElementById('notFoundMoved').hidden = false;
  location.replace(to);
})();
