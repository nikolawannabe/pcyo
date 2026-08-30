document.addEventListener('DOMContentLoaded', () => {
  const DATA = [
    // Sequim
    {loc:"Sequim", teacher:"Christine Faught", name:"Sound Sprouts", age:"0–6", time:"Mondays 11am", link:"/classes/sprouts/#sound-sprouts", description: "Early music education with fun movement and songs for parent and child.  Preparation for eventual study of an instrument or other music study."},
    {loc:"Sequim", teacher:"Christine Faught", name:"Suzuki Sprouts (NEW) - Cancelled", age:"3–7", time:"Mondays 11am", link:"/classes/sprouts/#suzuki-sprouts", description: "Violin study for young children, with early music education and lots of movement to keep the kids interested."},
    {loc:"Sequim", teacher:"Christine Faught", name:"Suzuki Sprouts (CONTINUING)", age:"3–7", time:"Mondays 3:15–4:05", link:"/classes/sprouts/#suzuki-sprouts", description: "The continuation class for Suzuki Sprouts students who started January 2026."},
    {loc:"Sequim", teacher:"Amber Roskamp", name:"Beginner Strings", age:"6+", time:"Mon & Wed 4:30–5:15", link:"/classes/6-plus-classes/", description: "Welcoming young students to the study of violin, viola, cello, and bass. No experience required."},
    {loc:"Sequim", teacher:"Amber Roskamp", name:"Intermediate Strings", age:"7+", time:"Mon & Wed 3:30–4:15", link:"/classes/6-plus-classes/", description: "For students who have completed 1 or 2 years of string study."},
    {loc:"Sequim", teacher:"Christine Faught", name:"Youth Orchestra", age:"8–13", time:"Mondays 4:30–5:45", link:"/classes/youth-orchestra/", description: "For students who have mastered the basics of their instrument. Typically students enter with 3-6years of prior study, but this depends somewhat on age and focus."},
    {loc:"Sequim", teacher:"Anne Burns", name:"Adult Viola Lab", age:"13+", time:"Tuesday 5:45–6:30pm", link:"/classes/adult-strings/", description: "For adult students of the viola with roughly 16 weeks of study. For our students who began in March of 2026."},

    // Port Angeles
    {loc:"Port Angeles", teacher:"Christine Faught", name:"Sound Sprouts", age:"0–6", time:"Friday 11am", link:"/classes/sprouts/#sound-sprouts", description: "Early music education with fun movement and songs for parent and child.  Preparation for eventual study of an instrument or other music study."},
    {loc:"Port Angeles", teacher:"Christine Faught", name:"Suzuki Sprouts (NEW) - Postponed until Winter", age:"3–7", time:"<a href='https://forms.gle/hnGVEE7q9Xocyqak8'>Friday 2:30 or 3pm</a>", link:"/classes/sprouts/#suzuki-sprouts",  description: "Violin study for young children, with early music education and lots of movement to keep the kids interested."},
    {loc:"Port Angeles", teacher:"Christine Faught", name:"Suzuki Sprouts (CONTINUING)", age:"3–7", time:"Friday 2:30–4:05", link:"/classes/sprouts/#suzuki-sprouts", description: "The continuation class for Suzuki Sprouts students who started January 2026."},
    {loc:"Port Angeles", teacher:"Jesse Ahmann", name:"Beginner Strings", age:"6+", time:"Mon & Wed 3:30–4:15", link:"/classes/6-plus-classes/", description: "Welcoming young students to the study of violin, viola, cello, and bass. No experience required."},
    {loc:"Port Angeles", teacher:"Jesse Ahmann", name:"Intermediate Strings", age:"7+", time:"Mon & Wed 4:30–5:15", link:"/classes/6-plus-classes/", description: "For students who have mastered the basics of their instrument. Typically students enter with 3-6years of prior study, but this depends somewhat on age and focus."},
    {loc:"Port Angeles", teacher:"Jesse Ahmann", name:"Youth Orchestra", age:"8–13", time:"Fridays 3:30–4:45", link:"/classes/youth-orchestra/", description: "For students who have mastered the basics of their instrument. Typically students enter with 3-6years of prior study, but this depends somewhat on age and focus."},
    {loc:"Port Angeles", teacher:"Christine Faught", name:"Adult Violin Lab", age:"13+", time:"Fridays 1:30–2:20", link:"/classes/adult-strings/",  description: "For adult students of the violin with roughly 16 weeks of study. For our students who began in January of 2026."}
  ];

  let currentTown = "All";
  let currentSearch = "";
  let currentSort = "loc";

  const tableBody = document.querySelector('#classTable');
  const cardContainer = document.getElementById('cardContainer');

  function applyFilters() {
    return DATA.filter(d => {
      const matchesTown = currentTown === "All" || d.loc === currentTown;

      const v = currentSearch;
      const matchesSearch =
        !v ||
        d.name.toLowerCase().includes(v) ||
        d.teacher.toLowerCase().includes(v) ||
        d.time.toLowerCase().includes(v) ||
        d.loc.toLowerCase().includes(v) ||
        d.age.toLowerCase().includes(v);

      return matchesTown && matchesSearch;
    });
  }

  function applySort(arr) {
    return arr.sort((a, b) =>
      (a[currentSort] || '').localeCompare(b[currentSort] || '')
    );
  }

  function render() {
    let filtered = applyFilters();
    filtered = applySort(filtered);

    tableBody.innerHTML = '';
    cardContainer.innerHTML = '';

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr><td colspan="5" class="pa3 gray">No classes match your search.</td></tr>
      `;
      return;
    }

    filtered.forEach((d, i) => {
      const tr = document.createElement('tr');
      let bg = '';
      if (i % 2) { bg = 'bg-near-white'; } else { bg = 'bg-white'; }
      tr.className = bg;

      tr.innerHTML = `
        <td class="pa2">${d.loc}</td>
        <td class="pa2">
          ${d.link ? `<a href="${d.link}" class="link blue">${d.name}</a>` : d.name}
        </td>
        <td class="pa2">${d.age}</td>
        <td class="pa2">${d.time}</td>
      `;
      
      tableBody.appendChild(tr);
      const descRow = document.createElement('tr');
      descRow.className = bg;
      descRow.innerHTML = `<td colspan="4" class="pa2">${d.description}</td>`;
      tableBody.appendChild(descRow);

      const card = document.createElement('div');
      card.className = 'class-card pa3 ba br2 b--light-blue pointer mb2';
      card.dataset.url = d.link;

      card.innerHTML = `
        <div class="b mb1">${d.name}</div>
        <div class="f6"><b>Ages</b>: ${d.age}</div>
        <div class="f6"><b>Days</b>: ${d.time}</div>
	<div class="f6"><b>Location</b>: ${d.loc}</div>
	<div class="f6"><b>Description</b>: ${d.description}</div>
      `;
      cardContainer.appendChild(card);
    });
  }

  // Search
  document.getElementById('filterInput').addEventListener('input', e => {
    currentSearch = e.target.value.toLowerCase();
    render();
  });

  // Segmented buttons
  document.querySelectorAll('#townButtons button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTown = btn.dataset.town;

      document.querySelectorAll('#townButtons button').forEach(b => {
        b.classList.remove('bg-light-gray', 'fw6');
        b.classList.add('bg-white');
      });

      btn.classList.add('bg-light-gray', 'fw6');
      btn.classList.remove('bg-white');

      render();
    });
  });

  // Sort dropdown
  document.getElementById('sortSelect').addEventListener('change', e => {
    currentSort = e.target.value;
    render();
  });

  // Clickable headers
  document.querySelectorAll('[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      currentSort = th.dataset.sort;
      render();
    });
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;

    const card = e.target.closest('.class-card');
    if (!card) return;

    const url = card.dataset.url;
    if (url) {
      window.location.href = url;
    }
  });

  render();
});
