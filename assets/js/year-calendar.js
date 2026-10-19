/*
 * The full-year calendar: one small grid per month, shaded by term, with days off and key dates marked,
 * and a list of that month's dates under each grid so nothing depends on hovering.
 * Used on /classes/ and /current-students/ through layouts/partials/year-calendar.html, which writes the
 * data into <script id="pcyo-calendar-data"> and the empty <div id="yearCalendar"> this script fills.
 * A page can also show one month at a time (layouts/partials/month-calendar.html, <div id="monthCalendar">):
 * it opens on the current month, worked out in the browser so it is right whenever the page is opened.
 *
 * The data: { terms, milestones, breaks } from data/terms.yaml (terms without "hidden"; concerts carry
 * their event page "url" and "orgs", see layouts/partials/calendar-milestones.html).
 * The badge icons (#ico-off-all, #ico-registration, #ico-concert-pcyo, …) are drawn by
 * layouts/partials/term-timeline.html and concert-icons.html, so the timeline must be on the same page.
 * It always shows everything (the timeline's Show buttons only affect the timeline).
 */
document.addEventListener('DOMContentLoaded', () => {
  const box = document.getElementById('yearCalendar');
  const monthBox = document.getElementById('monthCalendar');
  const source = document.getElementById('pcyo-calendar-data');
  if (!source || !(box || monthBox)) return;

  const data = JSON.parse(source.textContent);
  const terms = data.terms;              // visible terms, in date order
  const milestones = data.milestones || [];
  const breaks = data.breaks || [];      // days off

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

  terms.forEach(term => {
    term.startDate = toDate(term.start);
    term.endDate = toDate(term.end);
  });

  // How a key date is marked on its day in the grid: a class from calendar.css (.cal-mark--pcyo, …).
  const markClass = kind => `cal-mark cal-mark--${kind}`;

  // Concerts are marked by organisation; other dates by type. A concert's "orgs" lists its groups, host first
  // (e.g. ["sco", "pcyo"] for a joint concert; filled in by calendar-milestones.html). Its day in the grid uses the host's style,
  // and its note shows every group's icon.
  const markKinds = milestone => (milestone.type === 'concert' ? milestone.orgs : [milestone.type]);
  const markKind = milestone => markKinds(milestone)[0];
  const markIcons = milestone =>
    markKinds(milestone).map(kind => (milestone.type === 'concert' ? 'concert-' + kind : kind));

  const dayKey = date => date.toDateString();


  function iconHtml(id) {
    return `<svg width="14" height="14" viewBox="-11 -11 22 22" aria-hidden="true" class="v-mid mr1 flex-none">` +
           `<use href="#ico-${id}" x="-11" y="-11" width="22" height="22"/></svg>`;
  }

  // A small square in a term's color, solid or hatched (make-up days, early start): .cal-swatch in calendar.css.
  function swatchHtml(color, hatched = false) {
    return `<span class="cal-swatch dib v-mid mr1 flex-none${hatched ? ' cal-swatch--hatched' : ''}" style="--term: ${color}"></span>`;
  }

  function dayOffText(dayOff) {
    return dayOff.who === 'all'
      ? `No class: ${dayOff.label}`
      : `No class for ${dayOff.who}'s classes: ${dayOff.label}`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
  const nthMonth = i => new Date(first.getFullYear(), first.getMonth() + i, 1);

  function drawYearCalendar() {
    box.innerHTML = '';
    for (let i = 0; i < monthCount; i++) {
      const month = nthMonth(i);
      const html = monthGrid(month, milestonesByDay, dayOffByDay) + monthNotes(month);
      box.insertAdjacentHTML('beforeend', `<div class="mini-month ma2 pa2 bg-white br2">${html}</div>`);
    }
    box.insertAdjacentHTML('beforeend', calendarLegend());
  }

  // One month at a time, with ‹ › to step through the year. Opens on this month; before the school year starts
  // it shows the first month, and after it ends, the last.
  function drawMonthCalendar() {
    const prev = document.getElementById('monthPrev');
    const next = document.getElementById('monthNext');
    const back = document.getElementById('monthToday');
    const sinceFirst = (today.getFullYear() - first.getFullYear()) * 12 + today.getMonth() - first.getMonth();
    const thisMonth = Math.min(monthCount - 1, Math.max(0, sinceFirst));
    let shown = thisMonth;

    function draw() {
      const month = nthMonth(shown);
      monthBox.innerHTML =
        `<div class="mini-month month-now__grid">${monthGrid(month, milestonesByDay, dayOffByDay)}</div>` +
        `<div class="month-now__notes">${monthNotes(month) || '<p class="cal-notes mv0">No key dates this month.</p>'}</div>`;
      if (prev) prev.disabled = shown === 0;
      if (next) next.disabled = shown === monthCount - 1;
      if (back) back.hidden = shown === thisMonth;
    }
    if (prev) prev.addEventListener('click', () => { shown = Math.max(0, shown - 1); draw(); });
    if (next) next.addEventListener('click', () => { shown = Math.min(monthCount - 1, shown + 1); draw(); });
    if (back) back.addEventListener('click', () => { shown = thisMonth; draw(); });
    draw();
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
      // Days before a term when some classes already meet ("early" in terms.yaml) count as that term, hatched.
      const earlyTerm = isWeekday && terms.find(t => t.early && date >= toDate(t.early.start) && date <= toDate(t.early.end));
      const term = (isWeekday && terms.find(t => date >= t.startDate && date <= t.endDate)) || earlyTerm;
      const dayOff = dayOffByDay[dayKey(date)];
      const marks = milestonesByDay[dayKey(date)] || [];
      const isMakeup = term && term.makeup &&
        date >= toDate(term.makeup.start) && date <= toDate(term.makeup.end);
      const isEarly = Boolean(earlyTerm) && term === earlyTerm;

      // How the day looks: classes from calendar.css, plus the term's color as --term
      const classes = [];
      const tooltip = [];
      if (term && dayOff && dayOff.who === 'all') {
        // a term day nobody has class: crossed out
        classes.push('cal-day--off');
        tooltip.push(dayOffText(dayOff));
      } else if (term) {
        classes.push(isMakeup || isEarly ? 'cal-day--hatched' : 'cal-day--term');
        if (dayOff) {
          // one teacher's day off: faded
          classes.push('cal-day--teacher-off');
          tooltip.push(dayOffText(dayOff));
        }
        tooltip.push(isMakeup ? `${term.name} make-up day` : isEarly ? `${term.name}: ${term.early.label}` : term.name);
      } else if (dayOff) {
        tooltip.push(dayOffText(dayOff));
      }
      marks.forEach(milestone => {
        classes.push(markClass(markKind(milestone)));
        tooltip.push(milestone.label);
      });

      // today gets a ring (.cal-today in calendar.css)
      const isToday = date.getTime() === today.getTime();
      if (isToday) tooltip.unshift('Today');
      if (isToday) classes.push('cal-today');
      const termColor = term && !classes.includes('cal-day--off') ? ` style="--term: ${term.color}"` : '';
      html += `<td class="${classes.join(' ')}"${termColor}${isToday ? ' aria-current="date"' : ''} title="${tooltip.join(' · ')}">${date.getDate()}</td>`;
    }
    return html + '</tr></table>';
  }

  // The list of this month's dates under its grid: term starts and ends, make-up days, days off, key dates.
  function monthNotes(month) {
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const inMonth = (start, end = start) => start <= monthEnd && end >= month;
    const notes = [];   // { date, icon, text }

    terms.forEach(term => {
      const swatch = swatchHtml(term.color);
      if (inMonth(term.startDate)) {
        notes.push({ date: term.startDate, icon: swatch,
          text: `${shortDate(term.startDate)}: ${term.name} starts${term.optional ? ' (optional)' : ''}` });
      }
      if (inMonth(term.endDate)) {
        notes.push({ date: term.endDate, icon: swatch, text: `${shortDate(term.endDate)}: ${term.name} ends` });
      }
      if (term.early) {
        const start = toDate(term.early.start);
        const end = toDate(term.early.end);
        if (inMonth(start, end)) {
          notes.push({ date: start, icon: swatchHtml(term.color, true),
            text: `${dateRange(start, end)}: ${term.name}: ${term.early.label}` });
        }
      }
      if (term.makeup) {
        const start = toDate(term.makeup.start);
        const end = toDate(term.makeup.end);
        if (inMonth(start, end)) {
          notes.push({ date: start, icon: swatchHtml(term.color, true),
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
      // concerts with an event page link to it (url is filled in by calendar-milestones.html)
      const label = milestone.url
        ? `<a class="link blue underline-hover" href="${milestone.url}">${milestone.label}</a>`
        : milestone.label;
      notes.push({ date, icon: markIcons(milestone).map(iconHtml).join(''), text: `${shortDate(date)}: ${label}` });
    });

    if (!notes.length) return '';
    notes.sort((a, b) => a.date - b.date);
    const items = notes.map(note => `<li class="flex items-start">${note.icon}<span>${note.text}</span></li>`);
    return `<ul class="cal-notes list pl0 mt2 mb0">${items.join('')}</ul>`;
  }

  // The key under the calendar.
  function calendarLegend() {
    // One key entry: a sample day (.cal-key in calendar.css) styled like the grid, then its meaning.
    // The term-less samples use a neutral color (--term unset falls back to the brand blue in calendar.css).
    const item = (classes, label, { sample = '', color = '' } = {}) =>
      `<span class="dib mh2"><span class="cal-key dib v-mid mr1 tc ${classes}"${color ? ` style="--term: ${color}"` : ''}>${sample}</span>${label}</span>`;

    const termItems = terms.map(term => item('cal-day--term', term.name + (term.optional ? ' (optional)' : ''), { color: term.color }));
    const otherItems = [
      item('cal-day--off cal-key--bordered', 'No class', { sample: '9' }),
      item('cal-day--term cal-day--teacher-off', 'No class for one teacher'),
      item('cal-day--hatched', 'Make-up days or early start'),
      item(markClass('pcyo'), 'PCYO concert'),
      item(markClass('sco'), 'SCO concert / event'),
      item(markClass('registration'), 'Registration'),
      item(markClass('instrument'), 'Instrument day')
    ];
    return `<div class="w-100 tc f6 mt2 lh-copy">${termItems.concat(otherItems).join('')}</div>`;
  }

  if (box) drawYearCalendar();
  if (monthBox) drawMonthCalendar();
});
