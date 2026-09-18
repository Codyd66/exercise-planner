// Step 2: exercises with three tag dimensions, combined filters, editable tag lists.

const $ = id => document.getElementById(id);
const listEl = $('list');
const emptyEl = $('empty');
const noMatchEl = $('no-match');
const countEl = $('count');
const searchEl = $('search');
const filtersEl = $('filters');
const filterToggle = $('filter-toggle');
const filterClear = $('filter-clear');
const sheet = $('sheet');
const form = $('form');
const deleteBtn = $('delete-btn');
const tagsSheet = $('tags-sheet');
const tagsEditor = $('tags-editor');

let exercises = [];
let tags = [];               // all tags across dimensions
let editingId = null;
let formTags = {};           // dimension key -> Set of tag ids (while the form is open)
let formPriority = 2;
const filter = {};           // dimension key -> Set of selected tag ids
DIMENSIONS.forEach(d => { filter[d.key] = new Set(); });

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
}

function newExercise() {
  return {
    id: uid(),
    name: '',
    description: '',
    notes: '',
    movementTypes: [],
    muscleGroups: [],
    methods: [],
    equipment: [],
    priority: 2,
    favourite: false,
    hidden: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const tagById = id => tags.find(t => t.id === id);

// Hidden = hidden by hand, or every piece of equipment it needs is marked "not in my gym".
function isHidden(e) {
  if (e.hidden) return true;
  const eq = e.equipment || [];
  return eq.length > 0 && eq.every(id => (tagById(id) || {}).unavailable);
}
const visibleExercises = () => exercises.filter(e => !isHidden(e));
let showHidden = false;
let favouritesOnly = false;
const tagsFor = dimKey => tags.filter(t => t.dimension === dimKey).sort((a, b) => a.sortOrder - b.sortOrder);

// ---------- Loading ----------

async function load() {
  tags = await DB.all('tags');
  const missingDefaults = defaultTags().filter(t => !tags.some(x => x.dimension === t.dimension));
  if (missingDefaults.length) {
    await DB.putMany('tags', missingDefaults);
    tags = await DB.all('tags');
  }
  exercises = await DB.all('exercises');
  if (await applySeed()) exercises = await DB.all('exercises');
  renderFilters();
  render();
}

// Add built-in exercises that have never been loaded on this device.
// Ones you have deleted stay deleted; ones you have edited are left alone.
async function applySeed(force) {
  const meta = (await DB.get('meta', 'seed')) || { id: 'seed', applied: [] };
  const applied = new Set(force ? [] : meta.applied);
  const existingIds = new Set(exercises.map(e => e.id));
  const existingNames = new Set(exercises.map(e => e.name.toLowerCase()));
  const toAdd = [];
  for (const s of seedExercises()) {
    if (applied.has(s.id)) continue;
    applied.add(s.id);
    if (existingIds.has(s.id) || existingNames.has(s.name.toLowerCase())) continue;
    toAdd.push({ ...s, createdAt: Date.now(), updatedAt: Date.now() });
  }
  if (toAdd.length) await DB.putMany('exercises', toAdd);

  // When the built-in library improves (better descriptions, tags), refresh the
  // built-ins on this device that have never been edited. Edited ones are kept.
  let refreshed = 0;
  if ((meta.seedVersion || 1) < SEED_VERSION) {
    const byId = new Map(exercises.map(e => [e.id, e]));
    const toRefresh = [];
    for (const s of seedExercises()) {
      const mine = byId.get(s.id);
      if (!mine || !mine.builtIn) continue;
      const untouched = Math.abs((mine.updatedAt || 0) - (mine.createdAt || 0)) < 1000;
      if (untouched) {
        toRefresh.push({ ...mine, name: s.name, description: s.description, movementTypes: s.movementTypes,
          muscleGroups: s.muscleGroups, methods: s.methods, equipment: s.equipment, priority: s.priority });
      } else if (!(mine.equipment || []).length && s.equipment.length) {
        toRefresh.push({ ...mine, equipment: s.equipment });
      }
    }
    if (toRefresh.length) await DB.putMany('exercises', toRefresh);
    refreshed = toRefresh.length;
  }

  await DB.put('meta', { id: 'seed', applied: [...applied], seedVersion: SEED_VERSION });
  return toAdd.length + refreshed;
}

async function restoreSeed() {
  if (!confirm('Add back any built-in exercises you have deleted? Your own exercises and edits are kept.')) return;
  const n = await applySeed(true);
  await load();
  renderTagsEditor();
  alert(n ? `Restored ${n} exercise${n === 1 ? '' : 's'}.` : 'Nothing to restore. All built-in exercises are already here.');
}

// ---------- List and filters ----------

function matches(e) {
  if (!showHidden && isHidden(e)) return false;
  if (favouritesOnly && !e.favourite) return false;
  const q = searchEl.value.trim().toLowerCase();
  if (q && !(e.name + ' ' + e.description + ' ' + e.notes).toLowerCase().includes(q)) return false;
  // Within one dimension: match any selected tag. Across dimensions: all must match.
  for (const dim of DIMENSIONS) {
    const wanted = filter[dim.key];
    if (wanted.size === 0) continue;
    const has = (e[dim.field] || []).some(id => wanted.has(id));
    if (!has) return false;
  }
  return true;
}

function activeFilterCount() {
  return DIMENSIONS.reduce((n, d) => n + filter[d.key].size, 0);
}

function render() {
  const shown = exercises.filter(matches).sort((a, b) => a.name.localeCompare(b.name));

  countEl.textContent = exercises.length ? `${shown.length} of ${exercises.length}` : '';
  emptyEl.classList.toggle('hidden', exercises.length > 0);
  noMatchEl.classList.toggle('hidden', !(exercises.length > 0 && shown.length === 0));

  const n = activeFilterCount();
  filterToggle.textContent = n ? `Filters (${n})` : 'Filters';
  filterToggle.classList.toggle('active', n > 0);
  filterClear.classList.toggle('hidden', n === 0 && !favouritesOnly && !showHidden);
  const hiddenCount = exercises.filter(isHidden).length;
  $('fav-toggle').classList.toggle('active', favouritesOnly);
  $('hidden-toggle').textContent = showHidden ? 'Hide hidden' : `Hidden (${hiddenCount})`;
  $('hidden-toggle').classList.toggle('active', showHidden);
  $('hidden-toggle').classList.toggle('hidden', hiddenCount === 0 && !showHidden);

  listEl.innerHTML = '';
  for (const e of shown) {
    const li = document.createElement('li');
    li.className = 'card';
    li.dataset.id = e.id;
    if (isHidden(e)) li.classList.add('is-hidden');
    const head = document.createElement('div'); head.className = 'card-head';
    const name = document.createElement('p'); name.className = 'name'; name.textContent = e.name;
    const star = document.createElement('button');
    star.type = 'button'; star.className = 'star' + (e.favourite ? ' on' : '');
    star.textContent = e.favourite ? '★' : '☆';
    star.setAttribute('aria-label', e.favourite ? 'Remove from favourites' : 'Add to favourites');
    star.addEventListener('click', ev => { ev.stopPropagation(); toggleFavourite(e); });
    head.append(name, star);
    const desc = document.createElement('p'); desc.className = 'desc'; desc.textContent = e.description;
    const tagWrap = document.createElement('div'); tagWrap.className = 'tags';
    for (const dim of DIMENSIONS) {
      for (const id of e[dim.field] || []) {
        const t = tagById(id);
        if (!t) continue;
        const span = document.createElement('span');
        span.className = 'tag ' + dim.key;
        span.textContent = t.label;
        tagWrap.appendChild(span);
      }
    }
    li.append(head);
    if (e.description) li.append(desc);
    if (tagWrap.children.length) li.append(tagWrap);
    listEl.appendChild(li);
  }
}

function chipRow(dimKey, selected, onToggle, scroll) {
  const row = document.createElement('div');
  row.className = 'chips' + (scroll ? ' scroll' : '');
  for (const t of tagsFor(dimKey)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (selected.has(t.id) ? ' on' : '');
    b.textContent = t.label;
    b.addEventListener('click', () => {
      selected.has(t.id) ? selected.delete(t.id) : selected.add(t.id);
      b.classList.toggle('on');
      onToggle();
    });
    row.appendChild(b);
  }
  return row;
}

function renderFilters() {
  filtersEl.innerHTML = '';
  for (const dim of DIMENSIONS) {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('span');
    label.className = 'field-label';
    label.textContent = dim.label;
    field.append(label, chipRow(dim.key, filter[dim.key], render, true));
    filtersEl.appendChild(field);
  }
}

async function toggleFavourite(e) {
  e.favourite = !e.favourite;
  await DB.put('exercises', e);
  render();
}

function clearFilters() {
  DIMENSIONS.forEach(d => filter[d.key].clear());
  favouritesOnly = false;
  showHidden = false;
  renderFilters();
  render();
}

// ---------- Add / edit form ----------

function renderFormTags() {
  const wrap = $('form-tags');
  wrap.innerHTML = '';
  for (const dim of DIMENSIONS) {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('span');
    label.className = 'field-label';
    label.textContent = dim.label;
    field.append(label, chipRow(dim.key, formTags[dim.key], () => {}, false));
    wrap.appendChild(field);
  }

  const pr = $('f-priority');
  pr.innerHTML = '';
  for (const p of PRIORITIES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (formPriority === p.value ? ' on' : '');
    b.textContent = p.label;
    b.title = p.hint;
    b.addEventListener('click', () => {
      formPriority = p.value;
      pr.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
      b.classList.add('on');
    });
    pr.appendChild(b);
  }
}

function openSheet(exercise) {
  editingId = exercise ? exercise.id : null;
  $('sheet-title').textContent = exercise ? 'Edit exercise' : 'New exercise';
  $('f-name').value = exercise ? exercise.name : '';
  $('f-description').value = exercise ? exercise.description : '';
  $('f-notes').value = exercise ? exercise.notes : '';
  formTags = {};
  DIMENSIONS.forEach(d => { formTags[d.key] = new Set(exercise ? exercise[d.field] : []); });
  formPriority = exercise ? exercise.priority : 2;
  $('f-favourite').checked = !!(exercise && exercise.favourite);
  $('f-hidden').checked = !!(exercise && exercise.hidden);
  renderFormTags();
  deleteBtn.classList.toggle('hidden', !exercise);
  sheet.classList.remove('hidden');
  sheet.querySelector('.sheet-panel').scrollTop = 0;
  if (!exercise) setTimeout(() => $('f-name').focus(), 50);
}

function closeSheet() {
  sheet.classList.add('hidden');
  form.reset();
  editingId = null;
}

async function save(ev) {
  ev.preventDefault();
  const name = $('f-name').value.trim();
  if (!name) return;

  const existing = editingId ? exercises.find(e => e.id === editingId) : null;
  const item = { ...(existing || newExercise()) };
  item.name = name;
  item.description = $('f-description').value.trim();
  item.notes = $('f-notes').value.trim();
  DIMENSIONS.forEach(d => { item[d.field] = [...formTags[d.key]]; });
  item.priority = formPriority;
  item.favourite = $('f-favourite').checked;
  item.hidden = $('f-hidden').checked;
  item.updatedAt = Date.now();

  await DB.put('exercises', item);
  closeSheet();
  await load();
  // If a workout is open behind the form, refresh its rows too (names may have changed).
  if (typeof renderWorkoutItems === 'function' && currentWorkoutId && !$('view-workout').classList.contains('hidden')) renderWorkoutItems();
}

async function remove() {
  if (!editingId) return;
  if (!confirm('Delete this exercise?')) return;
  await DB.remove('exercises', editingId);
  closeSheet();
  await load();
}

// ---------- Manage tags ----------

function renderTagsEditor() {
  tagsEditor.innerHTML = '';
  for (const dim of DIMENSIONS) {
    const group = document.createElement('div');
    group.className = 'tag-group';
    const h = document.createElement('h3');
    h.textContent = dim.label;
    group.appendChild(h);

    for (const t of tagsFor(dim.key)) {
      const row = document.createElement('div');
      row.className = 'tag-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = t.label;
      input.addEventListener('change', () => renameTag(t.id, input.value));
      if (dim.key === 'equipment') {
        const avail = document.createElement('button');
        avail.type = 'button';
        avail.className = 'avail' + (t.unavailable ? ' off' : '');
        avail.textContent = t.unavailable ? 'Not in my gym' : 'In my gym';
        avail.addEventListener('click', () => setAvailability(t.id, !t.unavailable));
        row.appendChild(avail);
      }
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'remove';
      rm.textContent = '×';
      rm.setAttribute('aria-label', `Remove ${t.label}`);
      rm.addEventListener('click', () => removeTag(t.id));
      row.append(input, rm);
      group.appendChild(row);
    }

    const addRow = document.createElement('div');
    addRow.className = 'tag-row';
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = `Add ${dim.label.toLowerCase()}`;
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add';
    addBtn.textContent = 'Add';
    const doAdd = () => { if (addInput.value.trim()) addTag(dim.key, addInput.value); };
    addBtn.addEventListener('click', doAdd);
    addInput.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); doAdd(); } });
    addRow.append(addInput, addBtn);
    group.appendChild(addRow);

    tagsEditor.appendChild(group);
  }
}

async function addTag(dimKey, label) {
  label = label.trim();
  const exists = tagsFor(dimKey).some(t => t.label.toLowerCase() === label.toLowerCase());
  if (exists) { alert('That tag already exists.'); return; }
  const sortOrder = tagsFor(dimKey).length;
  // Reuse the built-in id (e.g. "muscle:biceps") when free, so the seed library still matches.
  const preferred = defaultTagId(dimKey, label);
  const id = tagById(preferred) ? uid() : preferred;
  await DB.put('tags', { id, dimension: dimKey, label, sortOrder });
  await load();
  renderTagsEditor();
}

async function setAvailability(id, unavailable) {
  const t = tagById(id);
  if (!t) return;
  await DB.put('tags', { ...t, unavailable });
  await load();
  renderTagsEditor();
}

async function deleteHiddenExercises() {
  const hidden = exercises.filter(isHidden);
  if (!hidden.length) { alert('There are no hidden exercises.'); return; }
  if (!confirm(`Permanently delete ${hidden.length} hidden exercise${hidden.length === 1 ? '' : 's'}? Built-ins can be brought back with Restore.`)) return;
  await Promise.all(hidden.map(e => DB.remove('exercises', e.id)));
  await load();
  renderTagsEditor();
}

async function renameTag(id, label) {
  label = label.trim();
  const t = tagById(id);
  if (!t) return;
  if (!label) { renderTagsEditor(); return; }
  await DB.put('tags', { ...t, label });
  await load();
  renderTagsEditor();
}

async function removeTag(id) {
  const t = tagById(id);
  if (!t) return;
  const dim = DIMENSIONS.find(d => d.key === t.dimension);
  const used = exercises.filter(e => (e[dim.field] || []).includes(id));
  const msg = used.length
    ? `Remove "${t.label}"? It is used by ${used.length} exercise${used.length === 1 ? '' : 's'} and will be removed from them.`
    : `Remove "${t.label}"?`;
  if (!confirm(msg)) return;
  const updated = used.map(e => ({ ...e, [dim.field]: e[dim.field].filter(x => x !== id), updatedAt: Date.now() }));
  if (updated.length) await DB.putMany('exercises', updated);
  await DB.remove('tags', id);
  filter[t.dimension].delete(id);
  await load();
  renderTagsEditor();
}

function openTagsSheet() {
  renderTagsEditor();
  const total = SEED_ROWS.length;
  const present = exercises.filter(e => e.builtIn).length;
  $('library-hint').textContent = `${present} of ${total} built-in exercises are in your library.`;
  tagsSheet.classList.remove('hidden');
}

function closeTagsSheet() {
  tagsSheet.classList.add('hidden');
}

// ---------- Events ----------

form.addEventListener('submit', save);
deleteBtn.addEventListener('click', remove);
searchEl.addEventListener('input', render);
filterToggle.addEventListener('click', () => filtersEl.classList.toggle('hidden'));
filterClear.addEventListener('click', clearFilters);
listEl.addEventListener('click', ev => {
  const card = ev.target.closest('.card');
  if (!card) return;
  const exercise = exercises.find(e => e.id === card.dataset.id);
  // While picking for a workout, a tap adds the exercise instead of editing it.
  if (typeof pickTarget !== 'undefined' && pickTarget) addToWorkout(pickTarget, exercise);
  else openSheet(exercise);
});
sheet.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeSheet));
$('tags-btn').addEventListener('click', openTagsSheet);
$('restore-btn').addEventListener('click', restoreSeed);
$('delete-hidden-btn').addEventListener('click', deleteHiddenExercises);
$('fav-toggle').addEventListener('click', () => { favouritesOnly = !favouritesOnly; render(); });
$('hidden-toggle').addEventListener('click', () => { showHidden = !showHidden; render(); });
tagsSheet.querySelectorAll('[data-close-tags]').forEach(el => el.addEventListener('click', closeTagsSheet));
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  const gen = $('gen-sheet');
  const det = $('details-sheet');
  if (det && !det.classList.contains('hidden')) closeDetails();
  else if (gen && !gen.classList.contains('hidden')) closeGenSheet();
  else if (!tagsSheet.classList.contains('hidden')) closeTagsSheet();
  else if (!sheet.classList.contains('hidden')) closeSheet();
});

load();
