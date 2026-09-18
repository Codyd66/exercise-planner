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
