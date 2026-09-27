import { browserData } from "./supabase.js";

const form = document.querySelector("#login-form");
const error = document.querySelector("#login-error");
const inviteAccount = document.querySelector("#invite-account");
const inviteForm = document.querySelector("#invite-form");
const inviteError = document.querySelector("#invite-error");

initialize();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  form.elements.email.value = email;
  error.textContent = "";
  if (!email || !password) {
    form.elements.email.focus();
    return;
  }

  const button = form.querySelector("button");
  button.disabled = true;
  const result = await browserData.signIn({ email, password });
  button.disabled = false;

  if (result.outcome === "authenticated") {
    goToPractice();
    return;
  }
  error.textContent =
    result.outcome === "invalid_credentials"
      ? "Email or password is incorrect."
      : messageForUnavailable(result.outcome);
  form.elements.password.focus();
});

async function initialize() {
  const invitation = await browserData.acceptInvitation();
  if (invitation.outcome === "invite_accepted") {
    showPasswordForm();
    return;
  }
  if (invitation.outcome === "invite_invalid_or_expired") {
    error.textContent = "That invite link could not be opened.";
    return;
  }
  if (invitation.outcome === "auth_unavailable" || invitation.outcome === "configuration_error") {
    error.textContent = messageForUnavailable(invitation.outcome);
    return;
  }

  const current = await browserData.validateCurrentUser();
  if (current.outcome === "authenticated") {
    goToPractice();
  } else if (current.outcome !== "unauthenticated") {
    error.textContent = messageForUnavailable(current.outcome);
  }
}

function showPasswordForm() {
  form.hidden = true;
  inviteAccount.hidden = false;
  inviteAccount.textContent = "Invite accepted. Choose a password to continue.";
  inviteForm.hidden = false;
  inviteForm.addEventListener("submit", establishPassword, { once: false });
}

async function establishPassword(event) {
  event.preventDefault();
  const password = inviteForm.elements.password.value;
  inviteError.textContent = "";
  if (password.length < 8) {
    inviteError.textContent = "Use at least 8 characters.";
    return;
  }

  const button = inviteForm.querySelector("button");
  button.disabled = true;
  const result = await browserData.establishPassword({ password });
  button.disabled = false;

  if (result.outcome === "password_established") {
    goToPractice();
    return;
  }
  inviteError.textContent =
    result.outcome === "password_rejected"
      ? "That password was not accepted."
      : result.outcome === "unauthenticated"
        ? "That invite link could not be opened."
        : messageForUnavailable(result.outcome);
}

function messageForUnavailable(outcome) {
  return outcome === "configuration_error"
    ? "Login is not configured for this site."
    : "Could not reach the login service.";
}

function goToPractice() {
  window.location.assign(new URL("practice/", loginDirectory()).href);
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
