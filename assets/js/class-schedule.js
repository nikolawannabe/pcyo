/*
 * Town buttons on a class page's "Schedule & joining" section (layouts/partials/class-schedule.html):
 * show only the classes in the town picked. The choice is remembered across class pages.
 */
(function () {
  const section = document.getElementById('schedule');
  if (!section) return;
  const buttons = section.querySelectorAll('.class-schedule__town');
  if (!buttons.length) return;

  const STORAGE_KEY = 'pcyo-town';   // shared by every class page

  function show(town) {
    buttons.forEach(button => button.setAttribute('aria-pressed', button.dataset.town === town));
    section.querySelectorAll('.class-schedule__card').forEach(card => {
      card.hidden = Boolean(town) && card.dataset.town !== town;
    });
    try { localStorage.setItem(STORAGE_KEY, town); } catch (e) { /* private browsing: just don't remember */ }
  }

  buttons.forEach(button => button.addEventListener('click', () => show(button.dataset.town)));

  let saved = '';
  try { saved = localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { /* nothing saved */ }
  if (saved && section.querySelector(`.class-schedule__town[data-town="${saved}"]`)) show(saved);
})();
