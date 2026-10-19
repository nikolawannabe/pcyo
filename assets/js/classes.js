/*
 * The /classes/ page: term panel, filters and class table (phone: cards).
 * The full-year calendar under them has its own script (assets/js/year-calendar.js).
 *
 * Everything comes from data/terms.yaml and data/classes.yaml. Hugo writes that data into
 * <script id="pcyo-data"> in layouts/partials/classes.html, and this script draws the page from it.
 * Class times arrive ready to show (built by layouts/partials/class-time.html).
 *
 * The timeline chart above the term panel has its own script (layouts/partials/term-timeline.html).
 * When a term bar is tapped there, it sends a 'pcyo:term' event, which this script listens for.
 *
 * Sections below:
 *   1. Data and date helpers
 *   2. Words shown for a class (joining status, experience, links)
 *   3. Page state
 *   4. Filters: age slider, experience slider, search box, town buttons
 *   5. Drawing the term panel and the class list
 *   6. Choosing a term (chart, ‹ › buttons, /classes/#winter links)
 *   7. Start
 */
document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------------------------------------------------
   * 1. Data and date helpers
   * ------------------------------------------------------------------------------------------- */

  const data = JSON.parse(document.getElementById('pcyo-data').textContent);
  const terms = data.terms;              // visible terms, in date order
  const classes = data.classes;
  const termLength = data.termLength;    // e.g. "about 8 weeks, with each class meeting once or twice a week"

  // Classes without a "terms" list meet in the three regular terms.
  const REGULAR_TERMS = ['fall', 'winter', 'spring'];
  const termsOf = cls => cls.terms || REGULAR_TERMS;

  // Dates arrive as "2026-09-21T00:00:00Z". Read just the calendar date, in local time,
  // so a date never shifts by a day because of the time zone.
  function toDate(text) {
    const [year, month, day] = String(text).slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // "Sep 14"
  function shortDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Give each term real Date objects for its first and last day.
  terms.forEach(term => {
    term.startDate = toDate(term.start);
    term.endDate = toDate(term.end);
  });
  const termById = Object.fromEntries(terms.map(term => [term.id, term]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);


  /* ---------------------------------------------------------------------------------------------
   * 2. Words shown for a class
   * ------------------------------------------------------------------------------------------- */

  // A term's name as a link that switches the page to that term: <a href="#winter">Winter</a>
  function termLink(termId) {
    const term = termById[termId];
    if (!term) return termId;
    return `<a class="term-link" href="#${termId}">${term.name.replace(' Term', '')}</a>`;
  }

  // Can a new student sign up for this class in this term? Returns { key, label, title }.
  // The words are worked out by Hugo (layouts/partials/class-join-status.html, the same partial the class pages use)
  // and arrive in cls.status, one entry per term the class meets in; this only turns the term ids into links.
  function joinStatus(cls, termId) {
    const status = cls.status[termId];
    const links = status.links.length ? status.links.map(termLink).join(' or ') + status.after : '';
    return { key: status.key, label: status.text + links, title: status.title };
  }

  // The badge's colours are in class-status.css (.class-status--open, --start, --skills, --cont).
  function joinBadge(status) {
    const tooltip = status.title ? ` title="Prerequisite: ${status.title}"` : '';
    return `<span class="class-status class-status--${status.key}"${tooltip}>${status.label}</span>`;
  }

  // Experience range as families read it ("Any", "New–1 yr", "3+ yrs"): cls.exp_label, from
  // layouts/partials/class-experience.html, so it matches the class pages.

  function mapLink(location) {
    const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location + ', WA');
    return `<a class="link blue" href="${url}">${location}</a>`;
  }


  /* ---------------------------------------------------------------------------------------------
   * 3. Page state
   * ------------------------------------------------------------------------------------------- */

  const hasClasses = term => classes.some(cls => termsOf(cls).includes(term.id));

  // Start on the term happening now, unless it's more than two weeks in: by then it's too late to join,
  // so families see the next term with classes instead. After the last term, show the last one.
  const SHOW_CURRENT_TERM_DAYS = 14;
  const stillShowing = term => {
    const cutoff = new Date(term.startDate);
    cutoff.setDate(cutoff.getDate() + SHOW_CURRENT_TERM_DAYS);
    return today <= cutoff && today <= term.endDate;
  };
  const firstTerm = terms.find(term => hasClasses(term) && (term.startDate > today || stillShowing(term)))
                 || terms.filter(hasClasses).pop();

  const state = {
    term: firstTerm.id,
    town: 'All',     // 'All', 'Sequim' or 'Port Angeles'
    search: '',      // lower-case text from the search box
    age: null,       // null = slider not used yet (show every age)
    experience: null // null = slider not used yet; otherwise years, 0–5 (5 means 5 or more)
  };


  /* ---------------------------------------------------------------------------------------------
   * 4. Filters
   * ------------------------------------------------------------------------------------------- */

  // --- Age slider ---
  // The slider runs 0–999 and is split into equal-width zones, so young ages are easy to pick.
  // Keep these zones in step with the coloured labels in layouts/partials/classes.html.
  const AGE_ZONES = [[0, 2], [3, 7], [8, 12], [13, 99]];
  const AGE_SLIDER_MAX = 1000;

  const ageInput = document.getElementById('ageRange');
  const ageBox = document.getElementById('ageFilter');
  const ageValue = document.getElementById('ageValue');
  const ageClear = document.getElementById('ageClear');

  function sliderToAge(position) {
    const zoneWidth = AGE_SLIDER_MAX / AGE_ZONES.length;
    const zone = Math.min(AGE_ZONES.length - 1, Math.floor(position / zoneWidth));
    const [low, high] = AGE_ZONES[zone];
    const fraction = (position - zone * zoneWidth) / zoneWidth;   // 0–1 within the zone
    return Math.min(high, low + Math.floor(fraction * (high - low + 1)));
  }

  function ageText(age) {
    if (age === null) return 'All ages';
    if (age === 0) return 'Under 1 year old';
    if (age === 1) return '1 year old';
    return `${Math.min(age, 99)} years old`;
  }

  function setAge(age) {
    state.age = age;
    ageBox.classList.toggle('class-finder__filter--unset', age === null);   // hides the slider handle
    ageValue.textContent = ageText(age);
    ageInput.setAttribute('aria-valuetext', ageValue.textContent);
    ageClear.hidden = age === null;
    render();
  }

  // Ages a class suits: age_min / age_max if given, otherwise the numbers in its "ages" text
  // ("3–7" gives 3 to 7, "13+" gives 13 to 99).
  function ageRangeOf(cls) {
    const text = String(cls.ages || '');
    const range = text.match(/(\d+)\s*[–-]\s*(\d+)/);
    const plus = text.match(/(\d+)\s*\+/);
    let min = cls.age_min;
    let max = cls.age_max;
    if (min == null) min = range ? Number(range[1]) : plus ? Number(plus[1]) : 0;
    if (max == null) max = range ? Number(range[2]) : 99;
    return [min, max];
  }

  function fitsAge(cls) {
    if (state.age === null) return true;
    const [min, max] = ageRangeOf(cls);
    return state.age >= min && state.age <= max;
  }

  ageInput.addEventListener('input', () => setAge(sliderToAge(Number(ageInput.value))));
  // Tapping the spot where the (hidden) handle already sits doesn't fire 'input', so catch that too.
  ['pointerup', 'keyup'].forEach(eventName => {
    ageInput.addEventListener(eventName, () => {
      if (state.age === null) setAge(sliderToAge(Number(ageInput.value)));
    });
  });
  ageClear.addEventListener('click', () => {
    ageInput.value = 0;
    setAge(null);
  });

  // --- Experience slider ---
  // Years playing a string instrument: 0 = brand new, 5 = five or more. Classes use exp_min / exp_max.
  const expInput = document.getElementById('expRange');
  const expBox = document.getElementById('expFilter');
  const expValue = document.getElementById('expValue');
  const expClear = document.getElementById('expClear');

  function experienceText(years) {
    if (years === null) return 'Any experience';
    if (years === 0) return 'Brand new';
    if (years >= 5) return '5+ years';
    return years === 1 ? '1 year' : `${years} years`;
  }

  function setExperience(years) {
    state.experience = years;
    expBox.classList.toggle('class-finder__filter--unset', years === null);
    expValue.textContent = experienceText(years);
    expInput.setAttribute('aria-valuetext', expValue.textContent);
    expClear.hidden = years === null;
    render();
  }

  function fitsExperience(cls) {
    if (state.experience === null) return true;
    const min = cls.exp_min == null ? 0 : cls.exp_min;
    const max = cls.exp_max == null ? 99 : cls.exp_max;
    if (state.experience < min) return false;
    // "5+ years" matches any class that goes up to 5 years or beyond.
    return state.experience >= 5 ? max >= 5 : state.experience <= max;
  }

  expInput.addEventListener('input', () => setExperience(Number(expInput.value)));
  ['pointerup', 'keyup'].forEach(eventName => {
    expInput.addEventListener(eventName, () => {
      if (state.experience === null) setExperience(Number(expInput.value));
    });
  });
  expClear.addEventListener('click', () => {
    expInput.value = 0;
    setExperience(null);
  });

  // --- Search box ---
  function fitsSearch(cls) {
    if (!state.search) return true;
    const text = [cls.name, cls.teacher, cls.time, cls.town, cls.ages].join(' ').toLowerCase();
    return text.includes(state.search);
  }

  document.getElementById('filterInput').addEventListener('input', event => {
    state.search = event.target.value.toLowerCase();
    render();
  });

  // --- Town buttons ---
  const townButtons = document.querySelectorAll('#townButtons button');
  townButtons.forEach(button => {
    button.addEventListener('click', () => {
      state.town = button.dataset.town;
      townButtons.forEach(other => {
        other.classList.toggle('bg-light-gray', other === button);
        other.classList.toggle('fw6', other === button);
      });
      render();
    });
  });

  const fitsTown = cls => state.town === 'All' || cls.town === state.town;


  /* ---------------------------------------------------------------------------------------------
   * 5. Drawing the term panel and the class list
   * ------------------------------------------------------------------------------------------- */

  const chart = document.getElementById('termTimeline');
  const panel = document.getElementById('termPanel');
  const panelTitle = document.getElementById('termTitle');
  const panelNote = document.getElementById('termNote');
  const tableBody = document.querySelector('#classTable tbody');
  const cardList = document.getElementById('cardContainer');   // shown instead of the table on phones
  let firstRender = true;

  function render() {
    const term = termById[state.term];
    highlightChartTerm(term);
    drawTermPanel(term);
    drawClassList(term);
    firstRender = false;
  }

  // Outline the chosen term's bar on the chart and keep it in view when the chart scrolls sideways (phones).
  function highlightChartTerm(term) {
    if (!chart) return;
    chart.classList.add('has-sel');
    chart.querySelectorAll('.tl-term').forEach(group => {
      const chosen = group.dataset.term === term.id;
      group.classList.toggle('sel', chosen);
      group.setAttribute('aria-pressed', chosen);
    });

    const bar = chart.querySelector(`.tl-term[data-term="${term.id}"] .tl-bar`);
    const scroller = chart.parentElement;
    if (bar && scroller.scrollWidth > scroller.clientWidth) {
      const barBox = bar.getBoundingClientRect();
      const scrollerBox = scroller.getBoundingClientRect();
      const offset = (barBox.left + barBox.width / 2) - (scrollerBox.left + scrollerBox.width / 2);
      scroller.scrollBy({ left: offset, behavior: firstRender ? 'auto' : 'smooth' });
    }
  }

  // The box under the chart: term name, dates, how long it is, who can join.
  function drawTermPanel(term) {
    panel.style.setProperty('--term', term.color);   // the panel's left edge and icon (class-finder.css)

    const icon = term.icon
      ? `<svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden="true" class="v-mid mr1 class-finder__term-icon">` +
        `<use href="#ico-term-${term.icon}" x="-12" y="-12" width="24" height="24"/></svg>`
      : '';
    const optional = term.optional ? ' <span class="f6 normal">(optional)</span>' : '';
    const dates = `<span class="f5 normal gray">· ${shortDate(term.startDate)} – ${shortDate(term.endDate)}</span>`;
    panelTitle.innerHTML = `${icon}${term.name}${optional} ${dates}`;

    // Optional terms (Holiday Session) have their own note; regular terms share term_length.
    let length = '';
    if (term.optional) {
      if (term.note) length = term.note + '. ';
    } else if (termLength) {
      length = termLength.charAt(0).toUpperCase() + termLength.slice(1) + '. ';
    }

    const newClasses = classes
      .filter(cls => termsOf(cls).includes(term.id) && joinStatus(cls, term.id).key === 'start')
      .map(cls => `${cls.name} (${cls.town})`);

    // Some classes start before the term ("early" in terms.yaml), e.g. "Christine's … start a week early (Mar 22)."
    const early = term.early ? `${term.early.label} (${shortDate(toDate(term.early.start))}). ` : '';

    panelNote.innerHTML = length + early
      + (term.join_note ? term.join_note + ' ' : '')
      + (newClasses.length ? `<b>New this term:</b> ${newClasses.join(', ')}. ` : '')
      + (term.page ? `<a href="${term.page}">Details and registration</a>` : '');
  }

  // The class table (and the same classes as cards on phones), after all the filters.
  function drawClassList(term) {
    const inTerm = classes.filter(cls => termsOf(cls).includes(term.id));
    const shown = inTerm
      .filter(fitsTown)
      .filter(fitsSearch)
      .filter(fitsAge)
      .filter(fitsExperience)
      .sort((a, b) => a.town.localeCompare(b.town));

    tableBody.innerHTML = '';
    cardList.innerHTML = '';

    if (!shown.length) {
      let message = 'No classes match.';
      if (!inTerm.length) {
        message = 'No classes listed yet for this term.';
      } else if (state.age !== null || state.experience !== null) {
        message = 'No classes this term match the age and experience you picked. Try another term, or widen the sliders.';
      }
      tableBody.innerHTML = `<tr><td colspan="6" class="pa3 gray">${message}</td></tr>`;
      cardList.innerHTML = `<p class="gray f5">${message}</p>`;
      return;
    }

    shown.forEach((cls, index) => {
      const status = joinStatus(cls, term.id);
      tableBody.insertAdjacentHTML('beforeend', tableRows(cls, status, index));
      cardList.insertAdjacentHTML('beforeend', phoneCard(cls, status));
    });
  }

  // Two table rows per class: the facts, then the description, prerequisite and location underneath.
  function tableRows(cls, status, index) {
    const shade = index % 2 ? 'bg-near-white' : 'bg-white';
    const prereq = cls.prereq ? ` <i>Prerequisite: ${cls.prereq}</i>` : '';
    const location = cls.location ? `<br>${mapLink(cls.location)}` : '';
    return `
      <tr class="${shade}">
        <td class="pa2">${cls.town}</td>
        <td class="pa2"><a href="${cls.link}" class="link blue">${cls.name}</a></td>
        <td class="pa2">${cls.ages}</td>
        <td class="pa2">${cls.exp_label}</td>
        <td class="pa2">${cls.time}</td>
        <td class="pa2">${joinBadge(status)}</td>
      </tr>
      <tr class="${shade}">
        <td colspan="6" class="pa2 pt0 f6">${cls.description}${prereq}${location}</td>
      </tr>`;
  }

  function phoneCard(cls, status) {
    const location = cls.location ? `<div class="f6 mt1">${cls.location}</div>` : '';
    const prereq = cls.prereq ? `<div class="f6 i">Prerequisite: ${cls.prereq}</div>` : '';
    return `
      <div class="class-finder__card pa3 ba br2 b--black-10 bg-white mb2">
        <a href="${cls.link}" class="db b blue link mb1">${cls.name}</a>
        <div class="mb1">${joinBadge(status)}</div>
        <div class="f6"><b>${cls.town}</b> · Ages ${cls.ages} · Experience: ${cls.exp_label}</div>
        <div class="f6">${cls.time}</div>
        <div class="f6 mt1">${cls.description}</div>
        ${location}
        ${prereq}
      </div>`;
  }


  /* ---------------------------------------------------------------------------------------------
   * 6. Choosing a term
   *    Each term has its own address: /classes/#fall, #holiday, #winter, #spring.
   * ------------------------------------------------------------------------------------------- */

  function showTerm(termId, { scroll = false } = {}) {
    if (!termById[termId]) return;
    state.term = termId;
    render();
    try {
      history.replaceState(null, '', '#' + termId);   // update the address without jumping
    } catch (error) { /* some browsers refuse in previews; not important */ }
    if (scroll) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function stepTerm(direction) {
    const index = terms.findIndex(term => term.id === state.term);
    const next = terms[(index + direction + terms.length) % terms.length];
    showTerm(next.id);
  }

  // A term bar was tapped on the chart.
  document.addEventListener('pcyo:term', event => showTerm(event.detail));

  // The address changed to another #term (back button, a link from another page section).
  window.addEventListener('hashchange', () => showTerm(location.hash.slice(1), { scroll: true }));

  // Links like "new students: see Winter Term" switch term even if the address already says #winter.
  document.addEventListener('click', event => {
    const link = event.target.closest('a.term-link');
    if (!link) return;
    event.preventDefault();
    showTerm(link.getAttribute('href').slice(1), { scroll: true });
  });

  document.getElementById('termPrev').addEventListener('click', () => stepTerm(-1));
  document.getElementById('termNext').addEventListener('click', () => stepTerm(1));


  /* ---------------------------------------------------------------------------------------------
   * 7. Start
   * ------------------------------------------------------------------------------------------- */

  // Opened as /classes/#winter: start on that term and scroll to it.
  const termFromAddress = location.hash.slice(1);
  if (termById[termFromAddress]) {
    state.term = termFromAddress;
    render();
    panel.scrollIntoView({ block: 'start' });
  } else {
    render();
  }
});
