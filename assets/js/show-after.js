/*
 * Reveals anything marked data-show-after="<date>" once that date has passed (layouts/index.html uses it for an
 * event's homepageDate). The site is only rebuilt when someone pushes, so the date is checked in the browser.
 */
document.querySelectorAll('[data-show-after]').forEach(element => {
  if (new Date() >= new Date(element.dataset.showAfter)) element.hidden = false;
});
