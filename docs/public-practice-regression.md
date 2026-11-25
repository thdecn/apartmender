# Public Practice regression boundary

Issue [#22](https://github.com/thdecn/apartmender/issues/22) originally requested
a shared Practice refactor before public and authenticated experiences could
evolve independently. An audit of main `61b5807` on 25 November 2026 found that
boundary already shipped:

- `practice-flow.js` owns deterministic progression and elapsed time with
  injected clock/randomness and no route, persistence or network imports.
- `practice-screen.js` and `practice-host.js` supply shared browser presentation.
  The host accepts Pieces and optional lifecycle/completion and presentation
  collaborators. The public `app.js` supplies the independent collection;
  `login/practice/practice.js` supplies authenticated lifecycle and fingerings.
- Existing pure Flow tests verify both modes, browsing, streaks and timing.
  Existing catalogue browser tests verify the six-Piece picker, curation,
  invalid collections and compatibility with the previous entry module.

The remaining #22 scope is public browser regression evidence. No new production
host, copied state machine or replacement lifecycle adapter is needed. The
original wide-refactor size estimate no longer describes the remaining work.

The owner confirmed that existing General Practice at `/apartmender/` is
acceptable. #24's `/general/` relocation is deferred outside the notation
pilot, and is no longer a prerequisite for #61 / `sludge-s16.14`. This decision
supersedes the old route prerequisite for this rollout. Future root/Login and
offline fallback work must reconcile its route assumptions before a cutover.
This change preserves the current public and `/login/` entrypoints.

Run `npm run test:public -- --browser=chromium` and the equivalent `webkit`
command. `e2e/public-practice.spec.js` serves the real static application with
its real eight-card Czerny Piece; it never substitutes the Practice Flow or
host. Deterministic time/randomness, visibility events and haptic/wake-lock
capabilities are controlled at browser boundaries. Assertions cover displayed
cards, streaks, disabled controls, Resume, completion, mode preference, elapsed
time and new-visit behavior. Portrait retains the public overlay while visible
time continues; Student portrait-pause semantics do not leak into this route.
Each scenario rejects private/Auth/transport module requests and page errors.

Reload and same-browser tab closure prove that public time and progression are
not recovered. Crash discard follows the existing memory-only implementation;
these tests do not claim to crash the browser or exercise a physical wake lock.
The original #22 behavior contract is preserved, rather than adding persistent
Practice or changing its UI. #61 still owns renderer-specific integration,
sentinel private-state isolation, failure/retry and reversible pilot behavior.
Fresh manual macOS Safari, iPhone Safari and iPad Firefox usability evidence
remains in #66 / `sludge-s16.19` and Sludge's final acceptance gate.
