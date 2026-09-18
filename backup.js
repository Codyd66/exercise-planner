// Step 6: backup export and import.
// Export writes one JSON file with everything. Import merges a file in:
// - new items are added
// - an item that exists on both sides keeps whichever was edited most recently
// - an exercise with a different id but the same name is treated as already present

const BACKUP_VERSION = 1;

async function exportBackup() {
  const data = {
    app: 'exercise-planner',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tags: await DB.all('tags'),
    exercises: await DB.all('exercises'),
    workouts: await DB.all('workouts'),
  };
  const json = JSON.stringify(data, null, 2);
  const stamp = today();
  const filename = `exercise-planner-backup-${stamp}.json`;
  const file = new File([json], filename, { type: 'application/json' });

  // On phones, the share sheet lets you AirDrop, WhatsApp or save to Files.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Exercise Planner backup' });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user closed the share sheet
    }
  }
  // Otherwise download it.
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function mergeById(existing, incoming, isSame) {
  const byId = new Map(existing.map(x => [x.id, x]));
  const toPut = [];
  let added = 0, updated = 0;
  for (const item of incoming) {
    const mine = byId.get(item.id);
    if (mine) {
      if ((item.updatedAt || 0) > (mine.updatedAt || 0)) { toPut.push(item); updated++; }
    } else if (!isSame || !existing.some(x => isSame(x, item))) {
      toPut.push(item); added++;
    }
  }
  return { toPut, added, updated };
}

async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    alert('That file is not a valid backup.');
    return;
  }
  if (!data || data.app !== 'exercise-planner' || !Array.isArray(data.exercises)) {
    alert('That file is not an Exercise Planner backup.');
    return;
  }

  const tagsNow = await DB.all('tags');
  const exercisesNow = await DB.all('exercises');
  const workoutsNow = await DB.all('workouts');

  const sameLabel = (a, b) => a.dimension === b.dimension && a.label.toLowerCase() === b.label.toLowerCase();
  const sameName = (a, b) => a.name.toLowerCase() === b.name.toLowerCase();

  const t = mergeById(tagsNow, data.tags || [], sameLabel);
  const e = mergeById(exercisesNow, data.exercises || [], sameName);
  const w = mergeById(workoutsNow, data.workouts || []);

  if (t.toPut.length) await DB.putMany('tags', t.toPut);
  if (e.toPut.length) await DB.putMany('exercises', e.toPut);
  if (w.toPut.length) await DB.putMany('workouts', w.toPut);

  // Anything that came in from a backup counts as "seen" so it is not re-added as a built-in later.
  const meta = (await DB.get('meta', 'seed')) || { id: 'seed', applied: [] };
  const applied = new Set(meta.applied);
  (data.exercises || []).forEach(x => { if (x.builtIn) applied.add(x.id); });
  await DB.put('meta', { id: 'seed', applied: [...applied] });

  await load();
  await loadWorkouts();
  renderTagsEditor();
  alert(
    `Import finished.\n` +
    `Exercises: ${e.added} added, ${e.updated} updated.\n` +
    `Tags: ${t.added} added, ${t.updated} updated.\n` +
    `Workouts: ${w.added} added, ${w.updated} updated.`
  );
}

$('export-btn').addEventListener('click', exportBackup);
$('import-btn').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (file) await importBackup(file);
});
