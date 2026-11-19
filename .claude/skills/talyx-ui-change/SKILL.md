---
name: talyx-ui-change
description: Make a change to a Talyx screen and prove it in the real app before and after. Use when a change touches src/renderer/src/widgets, src/renderer/src/pages or any screen (roster, chat, details, settings, setup), and before opening a PR that does.
---

# Change a Talyx screen

Every PR that touches a screen carries evidence from `control-talyx`: a screenshot and the stored
side effect, not a description. The driver and its rules are the `verify-talyx` skill.

1. Read `.claude/skills/verify-talyx/features/README.md`, then the feature file for the screen.
   Use its names (the words the app shows) in your prompts, commits and PR text. No feature file
   yet: write one in the same shape.
2. Before the change: `control-talyx launch` as the feature file says, run its "Driving it with
   control-talyx" steps, save `before.png` and `before.aria.txt` under
   `/tmp/talyx-verify/evidence/<feature-id>/`, then `control-talyx stop`.
3. Make the change. `npm run lint`, `npm run typecheck` and `npm test` pass.
4. After the change: launch again, run the same steps, save `after.png`, `after.aria.txt` and
   the side effect read back from storage (`control-talyx settings > settings.json`, or the
   engine's own view). Then `control-talyx stop`.
5. If a handle or journey in the feature file changed, update the file;
   `tests/unit/featureMap.test.ts` checks its names against the app's copy.
6. In the PR's "Screen evidence" section, attach the before and after screenshots and the side
   effect, and name the feature id. CI's `UI` job runs `settings-theme` and a seeded fuzz on every
   PR that touches `src/renderer`; it does not replace this evidence.
