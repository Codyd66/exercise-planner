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
- Equipment tags, with "Not in my gym" toggles that hide everything needing that kit
- Favourites (picked more often by the generator) and hidden exercises
- Swap button on any workout entry for a similar exercise
- Tap an exercise in a workout to read its form cues
- Save a workout as a template and start new workouts from it
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

1. **Workout history.** Mark a workout as done and record the weight and reps you hit on each set.
   Then show the last numbers next to each exercise the next time it appears, so you know what to beat.
2. **Rest timer.** A tap-to-start countdown between sets, with a default per role (longer for main
   lifts, shorter for isolation) and a buzz when it ends.
3. **Weekly split planner.** Assign a focus to each day of the week (Monday push, Tuesday pull...)
   and have the app generate or suggest that day's workout with one tap from the home screen.
4. **Exercise images or video links.** A picture or short clip per exercise for anything the text
   cannot make clear.
5. **Warm-up sets.** Suggest two or three lighter ramp-up sets before each main lift based on the
   working weight entered.
