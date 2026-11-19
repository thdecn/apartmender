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
An initialization timeout keeps verification pending and retains the fragment;
Retry verification can observe the eventual recovery event without accepting
an ordinary stored session as proof of recovery.
The event itself saves recovery intent before Retry, so an SDK-cleaned URL can
reload safely while still requiring same-user network validation.
If Auth cannot initialize, retain a supported email-link fragment and offer a
page reload that creates a fresh adapter. Practice hands password setup to Login
without signing out the invitation or recovery session. Revoked tab-storage
access must not prevent uncertain or saved-but-unverified outcomes from exposing sign-in.
While the recovery event is still pending, restore a supported SDK-cleared
fragment so navigation to Login or reload retains a recoverable link.
Practice explicitly requests a Login handoff so accepted invitations also retain
their supported fragment until Login revalidates setup. Volatile fragment copies
are cleared on definitive classification, session discard, or durable recovery intent.
An unavailable invitation-user validation also preserves its supported fragment
until a retry can classify the session, including during Practice handoff.
Accepted invitation setup keeps its supported URL until a password-write outcome
allows cleanup, so reload before Save still revalidates and resumes the form.
The default Login adapter releases its volatile fragment copy after acceptance.
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
Stale operations cannot erase newer progress. Existing markers remain readable
even if storage writes become blocked.
Fresh recovery links resume existing write/cleanup phases before another setup,
and phase transitions/deletion require a matching stored operation and phase.
A rejected write whose setup rollback cannot be saved reports a storage failure
and discards the local session, with storage/fresh-link guidance.
A browser that cannot initially save this
progress is denied recovery setup with actionable storage/fresh-link guidance.
Definitively rejected setup is removed or marked cancelled; if storage prevents
both, local cleanup can be retried without Auth. Cancellation never removes an
earlier write's pending cleanup. Superseded recovery and late storage failures
offer explicit Reload actions, so no stale verification/sign-out retry traps the user.
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
