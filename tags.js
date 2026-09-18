// The three tag dimensions and their starting values.
// Each tag is stored as { id, dimension, label, sortOrder }.
// Exercises refer to tags by id, so renaming a tag never breaks anything.
const DIMENSIONS = [
  {
    key: 'movement',
    field: 'movementTypes',
    label: 'Movement',
    defaults: ['Push', 'Pull', 'Legs', 'Core', 'Full body'],
  },
  {
    key: 'muscle',
    field: 'muscleGroups',
    label: 'Muscle group',
    defaults: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs'],
  },
  {
    key: 'method',
    field: 'methods',
    label: 'Method',
    defaults: ['Weightlifting', 'Calisthenics', 'Cardio', 'Mobility'],
  },
  {
    key: 'equipment',
    field: 'equipment',
    label: 'Equipment',
    defaults: ['Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Smith machine', 'Landmine', 'Pull-up / dip bar', 'Bodyweight', 'Band', 'Cardio machine', 'Other'],
  },
];

const PRIORITIES = [
  { value: 1, label: 'Main lift', hint: 'Big compound movement, done first' },
  { value: 2, label: 'Secondary', hint: 'Compound or heavy accessory' },
  { value: 3, label: 'Isolation', hint: 'Single-muscle finisher' },
];

function slug(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function defaultTagId(dimensionKey, label) {
  return `${dimensionKey}:${slug(label)}`;
}

function defaultTags() {
  const out = [];
  for (const dim of DIMENSIONS) {
    dim.defaults.forEach((label, i) => {
      out.push({ id: defaultTagId(dim.key, label), dimension: dim.key, label, sortOrder: i });
    });
  }
  return out;
}
