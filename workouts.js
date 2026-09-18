// Step 4: workouts. A workout is an ordered list of exercises for one day,
// each with sets and reps. Everything auto-saves as you change it.

let workouts = [];
let currentWorkoutId = null;
let pickTarget = null;      // workout id while choosing exercises from the library
let activeTab = 'exercises';

const workoutListEl = $('workout-list');
const workoutItemsEl = $('workout-items');

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// Sensible starting sets and reps based on the exercise's role and method.
function defaultPrescription(exercise) {
  const method = (exercise.methods || [])[0];
  if (method === 'method:cardio') return { sets: 1, reps: '15 min' };
  if (method === 'method:mobility') return { sets: 2, reps: '30 sec' };
  if (exercise.priority === 1) return { sets: 4, reps: '5' };
  if (exercise.priority === 2) return { sets: 3, reps: '8-10' };
  return { sets: 3, reps: '12-15' };
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 1200);
}

// ---------- Navigation ----------

function showView(name) {
  ['exercises', 'workouts', 'workout'].forEach(v => $('view-' + v).classList.toggle('hidden', v !== name));
  $('add-btn').classList.toggle('hidden', name === 'workout');
  window.scrollTo(0, 0);
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'exercises') {
    showView('exercises');
  } else if (currentWorkoutId) {
    openWorkout(currentWorkoutId);
  } else {
    showView('workouts');
    renderWorkouts();
  }
}

// ---------- Workout list ----------

async function loadWorkouts() {
  workouts = await DB.all('workouts');
  workouts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
}

function workoutCard(w) {
  const li = document.createElement('li');
  li.className = 'card workout-card' + (w.template ? ' template' : '');
  li.dataset.id = w.id;
  const name = document.createElement('p'); name.className = 'name'; name.textContent = w.name || 'Untitled workout';
  const meta = document.createElement('p'); meta.className = 'meta';
  const count = `${w.items.length} exercise${w.items.length === 1 ? '' : 's'}`;
  meta.textContent = w.template ? `Template · ${count}` : `${formatDate(w.date)} · ${count}`;
  const preview = document.createElement('p'); preview.className = 'preview';
  const names = w.items.map(it => (exercises.find(e => e.id === it.exerciseId) || {}).name).filter(Boolean);
  preview.textContent = names.slice(0, 4).join(' · ') + (names.length > 4 ? ` · +${names.length - 4} more` : '');
  li.append(name, meta);
  if (names.length) li.append(preview);
  if (w.template) {
    const actions = document.createElement('div'); actions.className = 'actions';
    const use = document.createElement('button');
    use.type = 'button'; use.className = 'pill accent'; use.textContent = 'Start from this';
    use.addEventListener('click', ev => { ev.stopPropagation(); copyWorkout(w.id); });
    actions.appendChild(use);
    li.appendChild(actions);
  }
  return li;
}

function renderWorkouts() {
  const templates = workouts.filter(w => w.template);
  const plain = workouts.filter(w => !w.template);
  workoutListEl.innerHTML = '';
  $('template-list').innerHTML = '';
  $('templates-wrap').classList.toggle('hidden', templates.length === 0);
  $('workout-count').textContent = plain.length ? String(plain.length) : '';
  $('workouts-empty').classList.toggle('hidden', workouts.length > 0);
  templates.forEach(w => $('template-list').appendChild(workoutCard(w)));
  plain.forEach(w => workoutListEl.appendChild(workoutCard(w)));
}

// Make a fresh copy of a workout (or template) dated today and open it.
async function copyWorkout(id) {
  const src = workouts.find(w => w.id === id);
  if (!src) return;
  const copy = {
    id: uid(),
    name: src.name,
    date: today(),
    template: false,
    items: src.items.map(it => ({ ...it })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await DB.put('workouts', copy);
  await loadWorkouts();
  openWorkout(copy.id);
  toast('Copied to today');
}

async function toggleTemplate() {
  const w = currentWorkout();
  if (!w) return;
  w.template = !w.template;
  await saveWorkout(w);
  openWorkout(w.id);
  toast(w.template ? 'Saved as template' : 'No longer a template');
}

async function newWorkout() {
  const w = { id: uid(), name: '', date: today(), items: [], createdAt: Date.now(), updatedAt: Date.now() };
  await DB.put('workouts', w);
  await loadWorkouts();
  openWorkout(w.id);
  setTimeout(() => $('w-name').focus(), 50);
}

// ---------- Single workout ----------

const currentWorkout = () => workouts.find(w => w.id === currentWorkoutId);

async function saveWorkout(w) {
  w.updatedAt = Date.now();
  await DB.put('workouts', w);
}

function openWorkout(id) {
  currentWorkoutId = id;
  const w = currentWorkout();
  if (!w) { showView('workouts'); renderWorkouts(); return; }
  $('w-name').value = w.name;
  $('w-date').value = w.date;
  $('w-date').classList.toggle('hidden', !!w.template);
  $('w-template-note').classList.toggle('hidden', !w.template);
  $('w-template').textContent = w.template ? 'Remove from templates' : 'Save as template';
  renderWorkoutItems();
  showView('workout');
}

function renderWorkoutItems() {
  const w = currentWorkout();
  workoutItemsEl.innerHTML = '';
  $('workout-empty').classList.toggle('hidden', w.items.length > 0);
  w.items.forEach((it, i) => {
    const ex = exercises.find(e => e.id === it.exerciseId);
    const li = document.createElement('li');
    li.className = 'item' + (ex ? '' : ' missing');

    const main = document.createElement('div'); main.className = 'item-main';
    const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = i + 1;
    const text = document.createElement('div');
    const name = document.createElement('p'); name.className = 'name';
    name.textContent = ex ? ex.name : 'Deleted exercise';
    if (ex) name.addEventListener('click', () => openDetails(ex));
    const sub = document.createElement('p'); sub.className = 'sub';
    if (ex) {
      const labels = [...(ex.muscleGroups || []).map(id => (tagById(id) || {}).label)].filter(Boolean);
      const role = (PRIORITIES.find(p => p.value === ex.priority) || {}).label;
      sub.textContent = [role, labels.join(', ')].filter(Boolean).join(' · ');
    }
    text.append(name, sub);
    main.append(pos, text);

    const controls = document.createElement('div'); controls.className = 'item-controls';
    const sets = numberField('Sets', it.sets, v => { it.sets = Math.max(1, parseInt(v, 10) || 1); saveWorkout(w); });
    const reps = textField('Reps', it.reps, v => { it.reps = v.trim(); saveWorkout(w); });
    const spacer = document.createElement('span'); spacer.className = 'spacer';
    const swap = miniBtn('⇄', 'Swap for a similar exercise', () => swapItem(i)); swap.classList.add('swap'); swap.disabled = !ex;
    const up = miniBtn('▲', 'Move up', () => moveItem(i, -1)); up.disabled = i === 0;
    const down = miniBtn('▼', 'Move down', () => moveItem(i, 1)); down.disabled = i === w.items.length - 1;
    const rm = miniBtn('×', 'Remove', () => removeItem(i)); rm.classList.add('remove');
    controls.append(sets, reps, spacer, swap, up, down, rm);

    li.append(main, controls);
    workoutItemsEl.appendChild(li);
  });
}

function numberField(label, value, onChange) {
  const l = document.createElement('label');
  const span = document.createElement('span'); span.textContent = label;
  const input = document.createElement('input');
  input.type = 'number'; input.min = '1'; input.inputMode = 'numeric'; input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  l.append(span, input);
  return l;
}

function textField(label, value, onChange) {
  const l = document.createElement('label');
  const span = document.createElement('span'); span.textContent = label;
  const input = document.createElement('input');
  input.type = 'text'; input.value = value; input.autocomplete = 'off';
  input.addEventListener('change', () => onChange(input.value));
  l.append(span, input);
  return l;
}

function miniBtn(text, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'mini'; b.textContent = text; b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

async function moveItem(i, dir) {
  const w = currentWorkout();
  const j = i + dir;
  if (j < 0 || j >= w.items.length) return;
  [w.items[i], w.items[j]] = [w.items[j], w.items[i]];
  await saveWorkout(w);
  renderWorkoutItems();
}

async function swapItem(i) {
  const w = currentWorkout();
  const it = w.items[i];
  const ex = exercises.find(e => e.id === it.exerciseId);
  if (!ex) return;
  const alt = findAlternative(ex, w.items.map(x => x.exerciseId), visibleExercises());
  if (!alt) { toast('No similar exercise available'); return; }
  w.items[i] = { ...it, exerciseId: alt.id };
  await saveWorkout(w);
  renderWorkoutItems();
  toast(`Swapped for ${alt.name}`);
}

// ---------- Exercise details ----------

let detailsExercise = null;

function openDetails(ex) {
  detailsExercise = ex;
  $('d-name').textContent = ex.name;
  const tagWrap = $('d-tags');
  tagWrap.innerHTML = '';
  for (const dim of DIMENSIONS) {
    for (const id of ex[dim.field] || []) {
      const t = tagById(id);
      if (!t) continue;
      const span = document.createElement('span');
      span.className = 'tag ' + dim.key;
      span.textContent = t.label;
      tagWrap.appendChild(span);
    }
  }
  const role = PRIORITIES.find(p => p.value === ex.priority);
  $('d-role').textContent = role ? `${role.label}: ${role.hint}` : '';
  $('d-description').textContent = ex.description || 'No description yet.';
  $('d-notes').textContent = ex.notes;
  $('d-notes-wrap').classList.toggle('hidden', !ex.notes);
  $('details-sheet').classList.remove('hidden');
  $('details-sheet').querySelector('.sheet-panel').scrollTop = 0;
}

function closeDetails() {
  $('details-sheet').classList.add('hidden');
  detailsExercise = null;
}

async function removeItem(i) {
  const w = currentWorkout();
  w.items.splice(i, 1);
  await saveWorkout(w);
  renderWorkoutItems();
}

async function addToWorkout(workoutId, exercise) {
  const w = workouts.find(x => x.id === workoutId);
  if (!w || !exercise) return;
  if (w.items.some(it => it.exerciseId === exercise.id)) { toast('Already in this workout'); return; }
  w.items.push({ exerciseId: exercise.id, ...defaultPrescription(exercise) });
  await saveWorkout(w);
  toast(`Added ${exercise.name}`);
}

function startPicking() {
  const w = currentWorkout();
  pickTarget = w.id;
  $('pick-text').textContent = `Tap to add to "${w.name || 'Untitled workout'}"`;
  $('pick-banner').classList.remove('hidden');
  showView('exercises');
  $('add-btn').classList.add('hidden');
}

function stopPicking() {
  pickTarget = null;
  $('pick-banner').classList.add('hidden');
  openWorkout(currentWorkoutId);
}

// ---------- Generator ----------

const genState = { focus: 'push', count: 6, methods: new Set(['weightlifting']) };
const GEN_METHODS = [['weightlifting', 'Weightlifting'], ['calisthenics', 'Calisthenics']];

function renderGenSheet() {
  const w = currentWorkout();
  const focusEl = $('gen-focus');
  focusEl.innerHTML = '';
  for (const t of TEMPLATES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (genState.focus === t.key ? ' on' : '');
    b.textContent = t.label;
    b.addEventListener('click', () => { genState.focus = t.key; renderGenSheet(); });
    focusEl.appendChild(b);
  }
  const countEl = $('gen-count');
  countEl.innerHTML = '';
  for (let n = 4; n <= 8; n++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (genState.count === n ? ' on' : '');
    b.textContent = n;
    b.addEventListener('click', () => { genState.count = n; renderGenSheet(); });
    countEl.appendChild(b);
  }
  const methodsEl = $('gen-methods');
  methodsEl.innerHTML = '';
  for (const [key, label] of GEN_METHODS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (genState.methods.has(key) ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      if (genState.methods.has(key)) { if (genState.methods.size > 1) genState.methods.delete(key); }
      else genState.methods.add(key);
      renderGenSheet();
    });
    methodsEl.appendChild(b);
  }
  const hasItems = w && w.items.length > 0;
  $('gen-replace').textContent = hasItems ? 'Replace exercises' : 'Generate';
  $('gen-append').classList.toggle('hidden', !hasItems);
}

function openGenSheet() {
  renderGenSheet();
  $('gen-sheet').classList.remove('hidden');
}

function closeGenSheet() {
  $('gen-sheet').classList.add('hidden');
}

async function runGenerator(mode) {
  const w = currentWorkout();
  if (!w) return;
  const exclude = mode === 'append' ? w.items.map(it => it.exerciseId) : [];
  const picked = generateWorkout(genState.focus, { count: genState.count, methods: [...genState.methods], exclude }, visibleExercises());
  if (!picked.length) { alert('No matching exercises found. Try a different focus or allow more methods.'); return; }

  const newItems = picked.map(ex => ({ exerciseId: ex.id, ...defaultPrescription(ex) }));
  w.items = mode === 'append' ? [...w.items, ...newItems] : newItems;
  if (!w.name.trim()) {
    w.name = TEMPLATES.find(t => t.key === genState.focus).name;
    $('w-name').value = w.name;
  }
  await saveWorkout(w);
  closeGenSheet();
  renderWorkoutItems();
  toast(`${mode === 'append' ? 'Added' : 'Generated'} ${picked.length} exercise${picked.length === 1 ? '' : 's'}`);
}

async function deleteWorkout() {
  const w = currentWorkout();
  if (!w) return;
  if (!confirm(`Delete "${w.name || 'Untitled workout'}"?`)) return;
  await DB.remove('workouts', w.id);
  currentWorkoutId = null;
  await loadWorkouts();
  showView('workouts');
  renderWorkouts();
}

// ---------- Events ----------

document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  if (pickTarget) stopPicking();
  if (b.dataset.tab === 'workouts' && activeTab === 'workouts' && currentWorkoutId) {
    // Tapping the Workouts tab again from inside a workout goes back to the list.
    currentWorkoutId = null;
  }
  switchTab(b.dataset.tab);
}));

$('add-btn').addEventListener('click', () => {
  if (activeTab === 'exercises') openSheet(null);
  else newWorkout();
});

$('workout-back').addEventListener('click', async () => {
  currentWorkoutId = null;
  await loadWorkouts();
  showView('workouts');
  renderWorkouts();
});
$('workout-delete').addEventListener('click', deleteWorkout);
$('w-add').addEventListener('click', startPicking);
$('w-copy').addEventListener('click', () => currentWorkoutId && copyWorkout(currentWorkoutId));
$('w-template').addEventListener('click', toggleTemplate);
document.querySelectorAll('[data-close-details]').forEach(el => el.addEventListener('click', closeDetails));
$('d-edit').addEventListener('click', () => {
  const ex = detailsExercise;
  closeDetails();
  if (ex) openSheet(ex);
});
$('w-generate').addEventListener('click', openGenSheet);
$('gen-replace').addEventListener('click', () => runGenerator('replace'));
$('gen-append').addEventListener('click', () => runGenerator('append'));
document.querySelectorAll('[data-close-gen]').forEach(el => el.addEventListener('click', closeGenSheet));
$('pick-done').addEventListener('click', stopPicking);
$('w-name').addEventListener('input', () => { const w = currentWorkout(); if (w) { w.name = $('w-name').value; saveWorkout(w); } });
$('w-date').addEventListener('change', () => { const w = currentWorkout(); if (w) { w.date = $('w-date').value; saveWorkout(w); } });
workoutListEl.addEventListener('click', ev => {
  const card = ev.target.closest('.card');
  if (card) openWorkout(card.dataset.id);
});

loadWorkouts();
