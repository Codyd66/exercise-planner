# Exercise Planner

A small home-screen app for storing and browsing exercises and planning a day's workout.
Plain HTML, CSS and JavaScript. No build step, no accounts, no server: all data lives on the phone.

## Features

- Exercise library with name, form cues and notes
- Three tag dimensions (movement, muscle group, method), editable in Settings
- Combined filters plus text search
- Built-in library of 170+ movements, mostly weightlifting
- Manual workout builder with sets and reps
- Structured generator: main lifts first, then secondary, then isolation
- Backup export and import (merge) via the Settings gear

## Running locally

Any static file server works, for example:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765 in a browser.

## Deploying

The app is published with GitHub Pages from the `main` branch. Push to `main` and the site updates.

When you change any file, bump `CACHE_VERSION` in `sw.js` so phones drop their old offline copy and
pick up the new one. Phones show a "New version ready" toast on their next open.

## Future ideas

Not built yet. Roughly in the order they would be most useful.

1. **Exercise details on the workout page.** Tap an exercise in a workout to open a pop-up with its
   description and notes, so you can check the form cues without leaving the plan.
2. **Equipment tags and filtering.** Tag each exercise with the equipment it needs (barbell, dumbbell,
   cable, machine, body weight) and let each user hide or delete the ones their gym does not have,
   so the generator only picks exercises they can actually do.
3. **Workout history.** Mark a workout as done and record the weight and reps you hit on each set.
   Then show the last numbers next to each exercise the next time it appears, so you know what to beat.
4. **Rest timer.** A tap-to-start countdown between sets, with a default per role (longer for main
   lifts, shorter for isolation) and a buzz when it ends.
5. **Weekly split planner.** Assign a focus to each day of the week (Monday push, Tuesday pull...)
   and have the app generate or suggest that day's workout with one tap from the home screen.
6. **Duplicate and template workouts.** Save a workout you like as a template and copy it to a new
   date, so a good session can be repeated without rebuilding it.
7. **Swap an exercise.** A button on each workout entry that replaces it with a random alternative of
   the same role and muscle group, for when a machine is busy.
8. **Favourites and hidden exercises.** Star the ones you like so the generator prefers them, and hide
   the ones you never want to see without deleting them.
