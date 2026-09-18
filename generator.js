// Step 5: structured workout generator.
//
// Each focus has a template: a list of "slots". A slot says what role the
// exercise should have (1 main lift, 2 secondary, 3 isolation) and which
// muscle groups it should target. Slots are listed in order of importance,
// so a short workout keeps the essentials and a long one adds finishers.
// The picked exercises are then ordered main -> secondary -> isolation.

const TEMPLATES = [
  { key: 'push', label: 'Push', name: 'Push day', slots: [
    { role: 1, muscles: ['chest'] },
    { role: 2, muscles: ['shoulders'], movement: 'push' },
    { role: 3, muscles: ['triceps'] },
    { role: 2, muscles: ['chest'] },
    { role: 3, muscles: ['shoulders'], movement: 'push' },
    { role: 3, muscles: ['chest'] },
    { role: 3, muscles: ['triceps'] },
    { role: 1, muscles: ['shoulders'], movement: 'push' },
  ]},
  { key: 'pull', label: 'Pull', name: 'Pull day', slots: [
    { role: 1, muscles: ['back'] },
    { role: 2, muscles: ['back'] },
    { role: 3, muscles: ['biceps'] },
    { role: 2, muscles: ['back'] },
    { role: 3, muscles: ['shoulders'], movement: 'pull' },
    { role: 3, muscles: ['biceps'] },
    { role: 3, muscles: ['back'] },
    { role: 2, muscles: ['biceps'] },
  ]},
  { key: 'legs', label: 'Legs', name: 'Leg day', slots: [
    { role: 1, muscles: ['quads'] },
    { role: 1, muscles: ['hamstrings'] },
    { role: 2, muscles: ['quads'] },
    { role: 3, muscles: ['hamstrings'] },
    { role: 3, muscles: ['calves'] },
    { role: 3, muscles: ['quads'] },
    { role: 3, muscles: ['glutes'] },
    { role: 2, muscles: ['glutes'] },
  ]},
  { key: 'upper', label: 'Upper body', name: 'Upper body', slots: [
    { role: 1, muscles: ['chest'] },
    { role: 1, muscles: ['back'] },
    { role: 2, muscles: ['shoulders'], movement: 'push' },
    { role: 2, muscles: ['back'] },
    { role: 3, muscles: ['biceps'] },
    { role: 3, muscles: ['triceps'] },
    { role: 3, muscles: ['shoulders'], movement: 'push' },
    { role: 3, muscles: ['chest'] },
  ]},
  { key: 'full', label: 'Full body', name: 'Full body', slots: [
    { role: 1, muscles: ['quads'] },
    { role: 1, muscles: ['chest'] },
    { role: 1, muscles: ['back'] },
    { role: 2, muscles: ['hamstrings', 'glutes'] },
    { role: 2, muscles: ['shoulders'], movement: 'push' },
    { role: 3, muscles: ['abs'] },
    { role: 3, muscles: ['biceps'] },
    { role: 3, muscles: ['triceps'] },
  ]},
  { key: 'core', label: 'Core', name: 'Core session', slots: [
    { role: 2, muscles: ['abs'] },
    { role: 3, muscles: ['abs'] },
    { role: 3, muscles: ['abs'] },
    { role: 2, muscles: ['abs'] },
    { role: 3, muscles: ['abs'] },
    { role: 3, muscles: ['abs'] },
    { role: 3, muscles: ['abs'] },
    { role: 3, muscles: ['abs'] },
  ]},
];

function weightedPick(items, weightOf) {
  const total = items.reduce((s, it) => s + weightOf(it), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

// Returns an ordered list of exercises for the given focus.
// options: { count: 4..8, methods: ['weightlifting', ...], exclude: Set of exercise ids }
function generateWorkout(focusKey, options, library) {
  const template = TEMPLATES.find(t => t.key === focusKey);
  if (!template) return [];
  const count = Math.max(1, Math.min(template.slots.length, options.count || 6));
  const allowedMethods = new Set((options.methods || ['weightlifting']).map(m => 'method:' + m));
  const used = new Set(options.exclude || []);

  const pool = library.filter(e =>
    (e.methods || []).some(m => allowedMethods.has(m)) && !used.has(e.id));

  const picked = [];
  template.slots.slice(0, count).forEach((slot, index) => {
    const muscleIds = slot.muscles.map(m => 'muscle:' + m);
    const movementId = slot.movement ? 'movement:' + slot.movement : null;

    const fits = e =>
      (e.muscleGroups || []).some(m => muscleIds.includes(m)) &&
      (!movementId || (e.movementTypes || []).includes(movementId)) &&
      !used.has(e.id);

    const isPrimary = e => muscleIds.includes((e.muscleGroups || [])[0]);
    const isDeadlift = e => /deadlift/i.test(e.name);
    const haveDeadlift = picked.some(p => isDeadlift(p.exercise));

    // Try the exact role first, then loosen to neighbouring roles, then anything.
    const rolesToTry = [[slot.role], [slot.role - 1, slot.role + 1], [1, 2, 3]];
    let candidates = [];
    for (const roles of rolesToTry) {
      candidates = pool.filter(e => roles.includes(e.priority) && fits(e));
      if (candidates.length) break;
    }
    if (!candidates.length) return;

    // One deadlift variant per session is plenty.
    if (haveDeadlift && candidates.some(e => !isDeadlift(e))) candidates = candidates.filter(e => !isDeadlift(e));

    // Strongly prefer exercises whose primary (first-listed) muscle is the slot's target.
    const primary = candidates.filter(isPrimary);
    if (primary.length >= 2) candidates = primary;
    const chosen = weightedPick(candidates, e => isPrimary(e) ? 3 : 1);
    used.add(chosen.id);
    picked.push({ exercise: chosen, role: slot.role, index });
  });

  // Order the session: main lifts first, then secondary, then isolation.
  picked.sort((a, b) => a.role - b.role || a.index - b.index);
  return picked.map(p => p.exercise);
}
