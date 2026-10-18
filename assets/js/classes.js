/*
 * The /classes/ page: term panel, filters, class table (phone: cards) and the full-year calendar.
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
 *   7. Full-year calendar
 *   8. Start
 */
document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------------------------------------------------
   * 1. Data and date helpers
   * ------------------------------------------------------------------------------------------- */

  const data = JSON.parse(document.getElementById('pcyo-data').textContent);
  const terms = data.terms;              // visible terms, in date order
  const classes = data.classes;
  const milestones = data.milestones;    // concerts, registration dates, instrument days
  const breaks = data.breaks || [];      // days off
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

  // "Sep 14" or "Nov 23 – Nov 27"
  function dateRange(start, end) {
    return start.getTime() === end.getTime() ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`;
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

  // Can a new student sign up for this class in this term?
  // Returns { key, label, title }: key picks the badge colour (see .badge-* in classes.html).
  // The "join" field in classes.yaml is one of: open, skills, continuing, or a list of term ids.
  function joinStatus(cls, termId) {
    if (cls.join === 'open') {
      return { key: 'open', label: 'Open to all' };
    }
    if (cls.join === 'skills') {
      return { key: 'skills', label: 'Open with skills', title: cls.prereq };
    }
    if (Array.isArray(cls.join)) {
      if (cls.join.includes(termId)) {
        return { key: 'start', label: 'New students start' };
      }
      const when = cls.join.map(termLink).join(' or ');
      return { key: 'cont', label: `Continuing only · new students join in ${when}` };
    }
    // join: continuing. "new_students" can point families to the term where newcomers start.
    if (cls.new_students && termById[cls.new_students]) {
      return { key: 'cont', label: `Continuing only · new students: see ${termLink(cls.new_students)} Term` };
    }
    return { key: 'cont', label: 'Continuing students only' };
  }

  function joinBadge(status) {
    const tooltip = status.title ? ` title="Prerequisite: ${status.title}"` : '';
    return `<span class="badge badge-${status.key}"${tooltip}>${status.label}</span>`;
  }

  // Experience range as families read it: "Any", "None", "New–1 yr", "1–3 yrs", "3+ yrs".
  function experienceLabel(cls) {
    const min = cls.exp_min == null ? 0 : cls.exp_min;
    const max = cls.exp_max;            // missing = no upper limit
    if (min === 0 && max == null) return 'Any';
    if (min === 0 && max === 0) return 'None';
    if (max == null) return `${min}+ yrs`;
    if (min === 0) return `New–${max} ${max === 1 ? 'yr' : 'yrs'}`;
    return `${min}–${max} yrs`;
  }

  function mapLink(location) {
    const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location + ', WA');
    return `<a class="link blue" href="${url}">${location}</a>`;
  }


  /* ---------------------------------------------------------------------------------------------
   * 3. Page state
   * ------------------------------------------------------------------------------------------- */

  const hasClasses = term => classes.some(cls => termsOf(cls).includes(term.id));

  // Start on the term happening now, or the next one with classes.
  const firstTerm = terms.find(term => term.endDate >= today && hasClasses(term))
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
    ageBox.classList.toggle('unset', age === null);   // .unset hides the slider handle
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
    expBox.classList.toggle('unset', years === null);
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
    panel.style.borderLeftColor = term.color;

    const icon = term.icon
      ? `<svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden="true" class="v-mid mr1" style="color:${term.color}">` +
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

    panelNote.innerHTML = length
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
        <td class="pa2">${experienceLabel(cls)}</td>
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
      <div style="color:#555" class="pa3 ba br2 b--black-10 bg-white mb2">
        <a href="${cls.link}" class="db b blue link mb1">${cls.name}</a>
        <div class="mb1">${joinBadge(status)}</div>
        <div class="f6"><b>${cls.town}</b> · Ages ${cls.ages} · Experience: ${experienceLabel(cls)}</div>
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
   * 7. Full-year calendar
   *    One small grid per month, shaded by term, with days off and key dates marked, and a list
   *    of that month's dates under each grid so nothing depends on hovering.
   *    It always shows everything (the chart's Show toggles only affect the chart).
   * ------------------------------------------------------------------------------------------- */

  // How a key date is marked on its day in the grid.
  const MARK_STYLES = {
    pcyo: 'outline:2px solid #7a3fa0;outline-offset:-2px',
    sco: 'outline:2px solid #103742;outline-offset:-2px',
    registration: 'border-radius:50%;box-shadow:inset 0 0 0 2px #1d6b36',
    instrument: 'box-shadow:inset 0 -4px 0 #8a4a14'
  };

  // Concerts are marked by organisation (PCYO or SCO); other dates by type.
  const markKind = milestone =>
    milestone.type === 'concert' ? (milestone.org || 'PCYO').toLowerCase() : milestone.type;
  const markIcon = milestone =>
    milestone.type === 'concert' ? 'concert-' + markKind(milestone) : milestone.type;

  const dayKey = date => date.toDateString();

  const makeupPattern = color => `repeating-linear-gradient(45deg,${color} 0 3px,${color}99 3px 6px)`;

  function iconHtml(id) {
    return `<svg width="14" height="14" viewBox="-11 -11 22 22" aria-hidden="true" class="v-mid mr1 flex-none">` +
           `<use href="#ico-${id}" x="-11" y="-11" width="22" height="22"/></svg>`;
  }

  function swatchHtml(style) {
    return `<span class="dib v-mid mr1 flex-none" style="width:12px;height:12px;${style}"></span>`;
  }

  function dayOffText(dayOff) {
    return dayOff.who === 'all'
      ? `No class: ${dayOff.label}`
      : `No class for ${dayOff.who}'s classes: ${dayOff.label}`;
  }

  function drawYearCalendar() {
    const box = document.getElementById('yearCalendar');
    box.innerHTML = '';

    // Look-ups by day: key dates, and which day off (if any) covers each day.
    const milestonesByDay = {};
    milestones.forEach(milestone => {
      const key = dayKey(toDate(milestone.date));
      (milestonesByDay[key] = milestonesByDay[key] || []).push(milestone);
    });
    const dayOffByDay = {};
    breaks.forEach(dayOff => {
      for (let date = toDate(dayOff.start); date <= toDate(dayOff.end); date.setDate(date.getDate() + 1)) {
        dayOffByDay[dayKey(date)] = dayOff;
      }
    });

    // Every month from the first term (or key date) to the last.
    const allDates = terms.flatMap(term => [term.startDate, term.endDate])
      .concat(milestones.map(milestone => toDate(milestone.date)));
    const first = new Date(Math.min(...allDates));
    const last = new Date(Math.max(...allDates));
    const monthCount = (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth() + 1;

    for (let i = 0; i < monthCount; i++) {
      const month = new Date(first.getFullYear(), first.getMonth() + i, 1);
      const html = monthGrid(month, milestonesByDay, dayOffByDay) + monthNotes(month);
      box.insertAdjacentHTML('beforeend', `<div class="mini-month ma2 pa2 bg-white br2">${html}</div>`);
    }
    box.insertAdjacentHTML('beforeend', calendarLegend());
  }

  // One month as a small table, Sunday to Saturday.
  function monthGrid(month, milestonesByDay, dayOffByDay) {
    const title = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let html = `<div class="b tc f6 mb1">${title}</div><table><tr>`;
    'SMTWTFS'.split('').forEach(letter => { html += `<td class="gray b">${letter}</td>`; });
    html += '</tr><tr>';

    // empty cells before the 1st
    for (let i = 0; i < month.getDay(); i++) html += '<td></td>';

    for (let date = new Date(month); date.getMonth() === month.getMonth(); date.setDate(date.getDate() + 1)) {
      if (date.getDay() === 0 && date.getDate() !== 1) html += '</tr><tr>';   // new week

      const isWeekday = date.getDay() > 0 && date.getDay() < 6;
      const term = isWeekday && terms.find(t => date >= t.startDate && date <= t.endDate);
      const dayOff = dayOffByDay[dayKey(date)];
      const marks = milestonesByDay[dayKey(date)] || [];
      const isMakeup = term && term.makeup &&
        date >= toDate(term.makeup.start) && date <= toDate(term.makeup.end);

      let style = '';
      const tooltip = [];
      if (term && dayOff && dayOff.who === 'all') {
        // a term day nobody has class: crossed out
        style = 'color:#999;text-decoration:line-through';
        tooltip.push(dayOffText(dayOff));
      } else if (term) {
        style = `background:${isMakeup ? makeupPattern(term.color) : term.color};color:#fff`;
        if (dayOff) {
          // one teacher's day off: faded
          style += ';opacity:.45';
          tooltip.push(dayOffText(dayOff));
        }
        tooltip.push(isMakeup ? `${term.name} make-up day` : term.name);
      } else if (dayOff) {
        tooltip.push(dayOffText(dayOff));
      }
      marks.forEach(milestone => {
        style += ';' + MARK_STYLES[markKind(milestone)] + ';font-weight:700';
        tooltip.push(milestone.label);
      });

      html += `<td style="${style}" title="${tooltip.join(' · ')}">${date.getDate()}</td>`;
    }
    return html + '</tr></table>';
  }

  // The list of this month's dates under its grid: term starts and ends, make-up days, days off, key dates.
  function monthNotes(month) {
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const inMonth = (start, end = start) => start <= monthEnd && end >= month;
    const notes = [];   // { date, icon, text }

    terms.forEach(term => {
      const swatch = swatchHtml(`background:${term.color}`);
      if (inMonth(term.startDate)) {
        notes.push({ date: term.startDate, icon: swatch,
          text: `${shortDate(term.startDate)}: ${term.name} starts${term.optional ? ' (optional)' : ''}` });
      }
      if (inMonth(term.endDate)) {
        notes.push({ date: term.endDate, icon: swatch, text: `${shortDate(term.endDate)}: ${term.name} ends` });
      }
      if (term.makeup) {
        const start = toDate(term.makeup.start);
        const end = toDate(term.makeup.end);
        if (inMonth(start, end)) {
          notes.push({ date: start, icon: swatchHtml(`background:${makeupPattern(term.color)}`),
            text: `${dateRange(start, end)}: ${term.name} make-up days` });
        }
      }
    });

    breaks.forEach(dayOff => {
      const start = toDate(dayOff.start);
      const end = toDate(dayOff.end);
      if (inMonth(start, end)) {
        notes.push({ date: start, icon: iconHtml(dayOff.who === 'all' ? 'off-all' : 'off-teacher'),
          text: `${dateRange(start, end)}: ${dayOffText(dayOff)}` });
      }
    });

    milestones.forEach(milestone => {
      const date = toDate(milestone.date);
      if (!inMonth(date)) return;
      // concerts with an event page link to it (url is filled in by classes.html)
      const label = milestone.url
        ? `<a class="link blue underline-hover" href="${milestone.url}">${milestone.label}</a>`
        : milestone.label;
      notes.push({ date, icon: iconHtml(markIcon(milestone)), text: `${shortDate(date)}: ${label}` });
    });

    if (!notes.length) return '';
    notes.sort((a, b) => a.date - b.date);
    const items = notes.map(note => `<li class="flex items-start">${note.icon}<span>${note.text}</span></li>`);
    return `<ul class="cal-notes list pl0 mt2 mb0">${items.join('')}</ul>`;
  }

  // The key under the calendar.
  function calendarLegend() {
    const item = (style, label, sample = '') =>
      `<span class="dib mh2"><span class="dib v-mid mr1 tc" style="width:14px;height:14px;font-size:9px;line-height:14px;${style}">${sample}</span>${label}</span>`;

    const termItems = terms.map(term => item(`background:${term.color}`, term.name + (term.optional ? ' (optional)' : '')));
    const otherItems = [
      item('color:#999;text-decoration:line-through;border:1px solid #ddd', 'No class', '9'),
      item('background:#2f6db5;opacity:.45', 'No class for one teacher'),
      item(`background:${makeupPattern('#2f6db5')}`, 'Make-up days'),
      item(MARK_STYLES.pcyo, 'PCYO concert'),
      item(MARK_STYLES.sco, 'SCO concert / event'),
      item(MARK_STYLES.registration, 'Registration'),
      item(MARK_STYLES.instrument, 'Instrument day')
    ];
    return `<div class="w-100 tc f6 mt2 lh-copy">${termItems.concat(otherItems).join('')}</div>`;
  }


  /* ---------------------------------------------------------------------------------------------
   * 8. Start
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
  drawYearCalendar();
});
