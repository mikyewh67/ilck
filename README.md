# Ledger Lab — Accounting 1 Coach

A mobile-first PWA built around the 7 Chapter 1–2 topics in this study plan:

1. Financial Statement Basics
2. Transaction Analysis
3. Account Operations
4. Accounting Equation Manipulation
5. Debits & Credits
6. Financial Statements
7. Recording Transactions

## Included

- Duolingo-style learning path plus free topic selection
- Learn / Practice / Mistakes / Challenge modes per topic
- Visual lessons with device voice narration and frequent check-ins
- Automatic spoken hint after 10 seconds, then a stronger hint if the learner stays stuck
- On-demand verbal hint button
- Equation guides shown directly under roll-forward and equation-manipulation questions
- Infinite randomized practice generators
- Two immediate similar follow-up questions after a miss
- Visual explanation after the second miss
- Debit/Credit rapid-fire mode
- Journal-entry builder plus multiple-choice journal questions
- Mixed tests with 10 / 15 / 20 / 30 questions
- Local progress tracking: accuracy, mastery, streak, weak skills, mistakes mastered, readiness
- Confetti and level unlocks for strong challenge scores
- Installable PWA with offline caching

## Run locally

Any static server works. Example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy

The app is static and can be deployed directly to Vercel, Netlify, GitHub Pages, or any HTTPS static host. No build step is required.

## Voice

The current version uses the browser/device Speech Synthesis API, so no API key is required and no key is exposed in client-side code.
