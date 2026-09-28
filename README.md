# Ledger Lab — Accounting 1

A new, build-free, dark study app for Accounting 1 Chapters 1–2. The current Vercel project is `ledger-lab-accounting`, connected to `mikyewh67/ilck` on `main`.

## Study experience

- Seven topic menus with Learn, Practice, Mistakes, and Challenge.
- 28 visual lesson cards with required multiple-choice checkpoints, swipe navigation, and device-synthesized narration.
- 139 exact skills across account classification, transaction analysis, account roll-forwards, equation manipulation, debit/credit rules, financial statements, and journal entries.
- Fresh names, transaction wording, and amounts; finite practice sessions can be restarted indefinitely.
- First miss: hint and retry. Second miss: worked visual explanation and retry. Each missed question inserts two new questions on the same skill after the current question is resolved.
- Two-part transaction exercises require the exact accounts and directions, then the overall Assets/Liabilities/Equity effect.
- Journal entries mix multiple choice, account/side/amount entry, and drag-and-drop with a tap-to-place alternative for mobile and keyboard use.
- Guided multistep problems at level 2; independent full problems at level 3. All equations remain available below the prompt.
- Mixed sessions contain 10, 15, 20, or 30 core questions and always cover all seven topics. Targeted remediation appears as additional bonus questions. No exam mode.
- Rapid fire allows ten seconds per question; the timer pauses while the page is hidden and stops when leaving the mode.

## Voice

Voice uses the browser/device Speech Synthesis API. It does not call OpenAI or require an API key. Spoken lesson content and practice hints are authored coaching scripts, not live generated explanations. Available voice quality varies by device. Lessons stop at every question. Voice can be toggled; an explicit Verbal Hint action turns voice on. With voice off, timed hints remain visible as text. Automatic hints occur at approximately 10 and 23 seconds of visible question time. Real device sound and iPhone installation should be checked on the device.

## Progress and mastery

Progress is stored on this device and origin under `ledger-lab-v2`; older app data is not erased. This new version starts a separate progress record.

Accuracy is based on first attempts at each question, including bonus questions; retries do not add correct answers. A guided problem is one question across all steps. Each missed skill needs two clean, unassisted answers to count as mastered. Topic mastery combines first-try accuracy, answer volume (25 questions), and breadth (up to eight distinct skills). Topic mastery of 85% triggers a celebration. Level 2 requires eight answers at 65% accuracy; level 3 requires twenty at 80%. Readiness averages mastery across all seven topics and is not a predicted test grade.

## Run

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173`. There is no build or install step. Node is needed only for the generator checks:

```sh
npm test
```

## Files

- `index.html`, `styles.css`: new responsive interface.
- `app.js`: navigation, interaction, narration, grading flows, and local progress.
- `engine.js`: generators and pure answer validation.
- `lessons.js`: lesson cards and checkpoints.
- `sw.js`, `manifest.webmanifest`, `icons/`: offline and home-screen support.
- `tests/engine.test.js`: generated-question invariants, journal balancing, grading, and same-skill repeat checks.

## Deployment and updates

Static Vercel deployment from the repository root. No framework preset or build command is needed. `vercel.json` revalidates resources and prevents service worker caching. The service worker uses a network-first strategy with a four-second offline fallback. Updated workers wait for the user to select Update now, so active work is not unexpectedly reloaded. Cache cleanup is restricted to this app’s `ledger-lab-` prefix. For later edits, change the cache version and module asset version together.

No original course recordings, private API keys, or server credentials are included.
