# Operator-led invitation and recovery completion

The Login page supports invitation links and operator-issued password-recovery
links. Role provisioning and activation remain protected Sludge operator steps.
There is no self-service recovery-request form or automatic role activation in
this change. Sludge's browser contract owns the shared interface.

Both password forms require confirmation and allow users to show the entries.
After a password write, the adapter verifies the submitted password through
Supabase password sign-in for the same user before reporting success. A failed
verification after a successful write is reported as saved but unverified,
without asking the user to overwrite the password again. Pending accounts
remain denied protected application access until operator activation.

Recovery requires a matching `PASSWORD_RECOVERY` Auth event and network-backed
current-user validation. It must tolerate `INITIAL_SESSION` arriving before the
recovery event. After password replacement, global sign-out returns the user to
Login. A failed sign-out can be retried without repeating the password write.
Ordinary Logout remains scoped to the current tab. Roles, assignments, and
practice data are unaffected by recovery.

Verification, workspace loading and recovery sign-out have separate retry
actions. Workspace retry never repeats the password write. A saved but
unverified invitation password clears the invitation session before Login,
including when server-aware sign-out fails.
An invitation write with a lost response also clears its session and exposes
normal sign-in, without claiming that the password was saved or repeating the write.

Recovery keeps only a per-user operation identifier and phase in localStorage;
passwords and Auth tokens remain excluded. This intent is never authorization:
resumption network-validates the same identity. A validation outage can resume
after URL cleanup and reload. Pending global cleanup survives reload or closing
the tab and resumes after authenticated return, before any workspace entry.
An uncertain write resumes cleanup without claiming that the password was saved.
Stale operations cannot erase newer progress. A browser that cannot save this
progress is denied recovery setup with actionable storage/fresh-link guidance.
No-fragment invitation inspection stays network-free for ordinary offline
Student entry; Login explicitly asks to resume recovery. After confirmed global
sign-out, failed progress deletion can record a completed phase instead of
repeating global logout. If both storage actions fail, a separate cleanup retry
remains available without another server sign-out.
If progress disappears during an in-page recovery, its validated in-memory
identity still permits global sign-out. Restore a missing marker when possible
so a failed sign-out can resume; never overwrite a newer operation.

Setup is bound to the identity validated from the email link and rechecked
before writing a password. A restored form after an account switch cannot
change the newly signed-in user's password. The Login entrypoint and its Auth
module chain use a shared release query version so cached older scripts cannot
silently omit the new behavior; refreshed modules also tolerate cached older
HTML by adding required confirmation and sign-out-retry controls.

Sign-in distinguishes incorrect credentials, disabled email-provider
configuration, throttling, and unavailable service without revealing whether
an arbitrary email belongs to an account. Passwords and Auth tokens stay out of
logs and application-owned durable storage.

## Verification

Run the unit suite and browser regressions:

```sh
npm test
npm run test:onboarding -- --browser=webkit
npm run test:teacher -- --browser=webkit
```

For the real-local regression, start the Sludge stack with email sign-in enabled,
public signup disabled, and all migrations applied. Complete the disposable
local Assignment cutover first. The test requires port 8080 for the configured
local Auth redirect and uses only the localhost API on 54331 and database on
54332. Set the checkout and CLI paths for your environment:

```sh
SLUDGE_REPO=/path/to/Sludge \
SUPABASE_CLI=/path/to/Sludge/node_modules/.bin/supabase \
npm run test:onboarding:local -- --browser=webkit
```

The regression uses real Auth-generated invitation/recovery links and real
password grants; it does not mock tokens or send email. It creates synthetic
`.invalid` accounts, checks pending access denial, activates only the fixture
Teacher, verifies its assigned Student, replaces the password through recovery,
rejects the old password, and verifies normal sign-in afterward. Fixture
identities and associated application rows are removed in cleanup. The initial
diagnostic attempt separately exercised actual local invitation delivery through
Mailpit. No test may point at a hosted project.

Before hosted rollout, verify the public email provider is enabled, public
registration remains disabled, the production redirect is allowlisted, and SMTP
delivery is available. Deploy browser support before issuing recovery links,
then verify one real recipient's replacement-password sign-in. Production
deployment and email delivery require the established operator rollout.
