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
