import { browserData } from "./supabase.js?auth=operator-onboarding-v1";

const form = document.querySelector("#login-form");
const error = document.querySelector("#login-error");
const inviteAccount = document.querySelector("#invite-account");
const inviteForm = document.querySelector("#invite-form");
const inviteError = document.querySelector("#invite-error");
const confirmation = ensurePasswordConfirmation();
const signoutRetry = ensureRecoveryRetry();
const validationRetry = ensureRetryButton("auth-validation-retry", "Retry verification");
const workspaceRetry = ensureRetryButton("password-workspace-retry", "Retry workspace");
const minimumPasswordLengths = Object.freeze({ invite: 8, recovery: 12 });
let passwordPurpose = "invite";
let passwordVerified = false;
let passwordSaved = false;
let validationReloadRequired = false;
let workspaceStatus = error;

document.querySelector("#show-login-password")?.addEventListener("change", (event) => {
  form.elements.password.type = event.target.checked ? "text" : "password";
});
document.querySelector("#show-new-password")?.addEventListener("change", (event) => {
  const type = event.target.checked ? "text" : "password";
  inviteForm.elements.password.type = type;
  confirmation.type = type;
});
signoutRetry.addEventListener("click", finishRecovery);
validationRetry.addEventListener("click", () => validationReloadRequired ? window.location.reload() : initialize());
workspaceRetry.addEventListener("click", () => goToWorkspace(workspaceStatus));

initialize();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  if (button.disabled) return;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  form.elements.email.value = email;
  error.textContent = "";
  if (!email || !password) {
    form.elements.email.focus();
    return;
  }

  button.disabled = true;
  const result = await browserData.signIn({ email, password });
  if (result.outcome === "authenticated") {
    form.elements.password.value = "";
    if (await handleAuthFlow(await browserData.resumePasswordRecovery())) { button.disabled = false; return; }
    await goToWorkspace(error);
    button.disabled = false;
    return;
  }
  button.disabled = false;
  error.textContent =
    result.outcome === "invalid_credentials"
      ? "Email or password is incorrect."
      : messageForUnavailable(result.outcome);
  form.elements.password.focus();
});
// The HTML starts disabled so a slow client import cannot submit credentials
// through the browser's default form action before this handler is installed.
form.querySelector("button").disabled = false;

async function initialize() {
  validationReloadRequired = false;
  validationRetry.hidden = true;
  const invitation = await browserData.acceptInvitation();
  if (await handleAuthFlow(invitation)) return;
  if (await handleAuthFlow(await browserData.resumePasswordRecovery())) return;
  const current = await browserData.validateCurrentUser();
  if (current.outcome === "authenticated") {
    await goToWorkspace(error);
  } else if (current.outcome !== "unauthenticated") {
    error.textContent = messageForUnavailable(current.outcome);
    validationRetry.hidden = false;
  }
}

async function handleAuthFlow(invitation) {
  if (invitation.outcome === "recovery_superseded") {
    showReloadAction("A newer reset flow replaced this tab. Reload to continue the latest recovery.");
    return true;
  }
  if (invitation.outcome === "recovery_progress_cleanup_failed") {
    showCleanupRetry("That reset link could not be verified. Allow site storage, then retry cleanup before signing in.");
    return true;
  }
  if (invitation.outcome === "auth_progress_unavailable") {
    error.textContent = messageForUnavailable(invitation.outcome);
    showReloadAction(`${error.textContent} Reload after enabling site storage.`);
    return true;
  }
  if (["invite_accepted", "password_recovery"].includes(invitation.outcome)) {
    showPasswordForm(invitation.outcome === "password_recovery" ? "recovery" : "invite");
    return true;
  }
  if (invitation.outcome === "password_cleanup_pending") {
    passwordSaved = invitation.passwordSaved;
    passwordVerified = false;
    inviteAccount.hidden = false;
    await finishRecovery();
    return true;
  }
  if (invitation.outcome === "invite_invalid_or_expired") {
    form.hidden = false;
    inviteForm.hidden = true;
    inviteAccount.hidden = true;
    error.textContent = "That email link is invalid or expired. Ask the administrator for a fresh link.";
    return true;
  }
  if (["auth_unavailable", "auth_link_validation_pending", "configuration_error"].includes(invitation.outcome)) {
    error.textContent = messageForUnavailable(invitation.outcome);
    validationReloadRequired = invitation.retry === "reload";
    validationRetry.textContent = validationReloadRequired ? "Reload page" : "Retry verification";
    if (validationReloadRequired || invitation.outcome === "auth_link_validation_pending") {
      form.hidden = true;
      inviteAccount.hidden = false;
      inviteAccount.textContent = validationReloadRequired
        ? `${messageForUnavailable(invitation.outcome)} Reload this page to retry your email link.`
        : "Could not verify the reset session. Retry verification to continue.";
    }
    validationRetry.hidden = !validationReloadRequired && invitation.outcome === "configuration_error";
    return true;
  }
  return false;
}

function showReloadAction(message) {
  clearPasswordFields();
  form.hidden = true;
  inviteForm.hidden = true;
  inviteAccount.hidden = false;
  inviteAccount.textContent = message;
  validationReloadRequired = true;
  validationRetry.textContent = "Reload page";
  validationRetry.hidden = false;
  signoutRetry.hidden = true;
  workspaceRetry.hidden = true;
}

function showCleanupRetry(message) {
  form.hidden = true;
  inviteForm.hidden = true;
  inviteAccount.hidden = false;
  inviteAccount.textContent = message;
  signoutRetry.textContent = "Retry cleanup";
  signoutRetry.hidden = false;
  validationRetry.hidden = true;
  workspaceRetry.hidden = true;
}

function showPasswordForm(purpose) {
  passwordPurpose = purpose;
  validationRetry.hidden = true;
  workspaceRetry.hidden = true;
  signoutRetry.hidden = true;
  inviteForm.append(inviteError);
  inviteError.textContent = "";
  const minimum = minimumPasswordLengths[purpose];
  form.hidden = true;
  inviteAccount.hidden = false;
  inviteAccount.textContent = purpose === "recovery"
    ? `Reset link accepted. Choose a new password of at least ${minimum} characters.`
    : `Invite accepted. Choose and confirm a password of at least ${minimum} characters.`;
  for (const input of [inviteForm.elements.password, confirmation]) {
    input.minLength = minimum;
  }
  inviteForm.hidden = false;
  inviteForm.addEventListener("submit", establishPassword, { once: false });
  inviteForm.querySelector("button").disabled = false;
}

async function establishPassword(event) {
  event.preventDefault();
  const button = inviteForm.querySelector("button");
  if (button.disabled) return;
  const password = inviteForm.elements.password.value;
  inviteError.textContent = "";
  const minimum = minimumPasswordLengths[passwordPurpose];
  if (password.length < minimum) {
    inviteError.textContent = `Use at least ${minimum} characters.`;
    return;
  }
  if (password !== confirmation.value) {
    inviteError.textContent = "The passwords do not match. Check both entries.";
    return;
  }

  button.disabled = true;
  inviteError.textContent = "Saving and verifying your password…";
  const result = await browserData.establishPassword({ password });
  button.disabled = false;

  if (result.outcome === "password_established") {
    passwordSaved = true;
    passwordVerified = true;
    clearPasswordFields();
    if (passwordPurpose === "recovery") { await finishRecovery(); return; }
    inviteForm.after(inviteError);
    inviteForm.hidden = true;
    inviteAccount.textContent = "Password saved and verified.";
    await goToWorkspace(inviteError);
    return;
  }
  if (result.outcome === "password_saved_signin_failed") {
    passwordSaved = true;
    clearPasswordFields();
    passwordVerified = false;
    if (passwordPurpose === "recovery") { await finishRecovery(); return; }
    inviteForm.hidden = true;
    form.hidden = false;
    inviteAccount.textContent = "Your password was saved. Sign in with your new password to continue.";
    error.textContent = messageForUnavailable(result.reason);
    return;
  }
  if (result.outcome === "password_change_uncertain") {
    passwordSaved = false;
    passwordVerified = false;
    clearPasswordFields();
    if (passwordPurpose === "recovery") { await finishRecovery(); return; }
    inviteForm.hidden = true;
    form.hidden = false;
    inviteAccount.textContent = "Could not confirm the password change. Try signing in with the password you just chose. If it does not work, ask the administrator for a fresh link.";
    error.textContent = "";
    form.elements.email.focus();
    return;
  }
  if (result.outcome === "auth_progress_unavailable") {
    inviteError.textContent = messageForUnavailable(result.outcome);
    return;
  }
  if (result.outcome === "auth_rate_limited") {
    inviteError.textContent = "Too many password-change attempts. Wait a few minutes, then retry Save password.";
    return;
  }
  inviteError.textContent =
    result.outcome === "password_rejected"
      ? "That password was not accepted."
      : result.outcome === "unauthenticated"
        ? "That email link could not be verified. Ask the administrator for a fresh link."
        : "Could not confirm the password change. Try signing in with the password you just chose before trying again.";
}

function clearPasswordFields() {
  inviteForm.elements.password.value = "";
  confirmation.value = "";
  inviteForm.elements.password.type = "password";
  confirmation.type = "password";
  const visibility = document.querySelector("#show-new-password");
  if (visibility) visibility.checked = false;
}

// A cached pre-release HTML page can load refreshed modules. Add required
// controls before initialization instead of leaving its Continue button disabled.
function ensurePasswordConfirmation() {
  if (inviteForm.elements.passwordConfirmation) return inviteForm.elements.passwordConfirmation;
  const label = document.createElement("label");
  label.htmlFor = "invite-password-confirm"; label.textContent = "Confirm new password";
  const input = document.createElement("input");
  Object.assign(input, { id: label.htmlFor, name: "passwordConfirmation", type: "password",
    autocomplete: "new-password", required: true });
  const submit = inviteForm.querySelector('button[type="submit"]');
  inviteForm.insertBefore(label, submit); inviteForm.insertBefore(input, submit);
  return input;
}

function ensureRecoveryRetry() {
  return ensureRetryButton("recovery-signout-retry", "Retry sign-out");
}

function ensureRetryButton(id, label) {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const button = document.createElement("button");
  Object.assign(button, { id, type: "button", className: "btn", textContent: label, hidden: true });
  inviteForm.after(button);
  return button;
}

async function finishRecovery() {
  inviteForm.hidden = true;
  form.hidden = true;
  signoutRetry.hidden = true;
  const result = await browserData.completePasswordRecovery();
  if (["invite_invalid_or_expired", "recovery_superseded"].includes(result.outcome)) {
    await handleAuthFlow(result);
    return;
  }
  if (result.outcome === "auth_progress_unavailable") {
    showReloadAction("Could not save recovery cleanup or finish signing out all sessions. This tab was signed out. Allow site storage and ask the administrator for a fresh reset link to finish recovery.");
    return;
  }
  if (result.outcome === "recovery_progress_cleanup_failed") {
    showCleanupRetry("Sessions were signed out, but this browser could not clear recovery progress. Allow site storage, then retry cleanup.");
    return;
  }
  if (result.outcome === "unauthenticated") {
    form.hidden = false;
    inviteAccount.textContent = "Sign in with your chosen password to finish recovery cleanup.";
    return;
  }
  if (result.outcome !== "signed_out") {
    inviteAccount.textContent = `${passwordSaved ? "Your password was saved." : "Could not confirm the password change."} Could not finish signing out; retry to complete the reset.`;
    signoutRetry.hidden = false;
    return;
  }
  form.hidden = false;
  form.elements.password.value = "";
  inviteAccount.textContent = !passwordSaved
    ? "Recovery session closed. Try signing in with the password you just chose; the change could not be confirmed."
    : passwordVerified
    ? "Password reset complete. Sign in with your new password."
    : "Your password was saved. Sign in with your new password to finish verification.";
  error.textContent = "";
  form.elements.email.focus();
}

function messageForUnavailable(outcome) {
  if (outcome === "auth_progress_unavailable") return "Could not save recovery progress. Allow site storage and ask the administrator for a fresh reset link.";
  if (outcome === "auth_configuration_error") return "Email sign-in is not configured. Please contact the administrator.";
  if (outcome === "auth_rate_limited") return "Too many sign-in attempts. Wait a few minutes and try again.";
  return outcome === "configuration_error"
    ? "Login is not configured for this site."
    : "Could not reach the login service.";
}

async function goToWorkspace(status) {
  workspaceStatus = status;
  workspaceRetry.hidden = true;
  workspaceRetry.disabled = true;
  const result = await browserData.resolveWorkspace();
  if (result.outcome === "workspace") {
    window.location.assign(new URL(result.workspace === "teacher" ? "teacher/" : "practice/", loginDirectory()).href);
    return;
  }
  workspaceRetry.hidden = false;
  workspaceRetry.disabled = false;
  status.textContent = result.outcome === "account_denied"
    ? `${status === inviteError ? "Password saved and verified. " : ""}This account has no active workspace. Please contact the administrator.`
    : result.outcome === "practice_not_ready"
      ? "Practice data is not ready. Please try again later."
      : "Could not check account access. Please try again.";
}

function loginDirectory() {
  const url = new URL(window.location.href);
  if (url.pathname.endsWith("/index.html")) {
    url.pathname = url.pathname.slice(0, -"index.html".length);
  } else if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }
  url.search = "";
  url.hash = "";
  return url;
}
