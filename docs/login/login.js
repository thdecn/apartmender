import {
  describeAccess,
  readAuthHash,
  readSession,
  saveSession,
  signIn,
  updatePassword,
} from "./supabase.js";

const form = document.querySelector("#login-form");
const error = document.querySelector("#login-error");
const inviteAccount = document.querySelector("#invite-account");
const inviteForm = document.querySelector("#invite-form");
const inviteError = document.querySelector("#invite-error");
const inviteContinue = document.querySelector("#invite-continue");
const fromUrl = readAuthHash();

if (fromUrl?.error) {
  error.textContent = "That invite link could not be opened.";
} else if (fromUrl?.accessToken) {
  reviewInvite(fromUrl);
} else if (readSession()) {
  window.location.replace(new URL("practice/", loginDirectory()).href);
}

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
  try {
    const result = await signIn(email, password);
    if (!result.ok) {
      error.textContent = result.invalid
        ? "Email or password is incorrect."
        : "Could not check that login.";
      form.elements.password.focus();
      return;
    }
    saveSession(result.session);
    window.location.assign(new URL("practice/", loginDirectory()).href);
  } catch {
    error.textContent = "Could not check that login.";
  } finally {
    button.disabled = false;
  }
});

async function reviewInvite(pending) {
  form.hidden = true;
  inviteAccount.hidden = false;
  inviteAccount.textContent = "Checking the invite…";
  let described;
  try {
    described = await describeAccess(pending.accessToken);
  } catch {
    described = { status: "invalid" };
  }
  if (described.status === "no_record") {
    inviteAccount.textContent = "No practice record for this account.";
    return;
  }
  if (described.status !== "ok") {
    inviteAccount.textContent = "That invite link could not be opened.";
    return;
  }

  const session = {
    accessToken: pending.accessToken,
    refreshToken: pending.refreshToken,
    mustSetPassword: false,
  };
  inviteAccount.textContent = described.email;

  if (pending.mustSetPassword) {
    inviteForm.hidden = false;
    inviteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = inviteForm.elements.password.value;
      inviteError.textContent = "";
      if (password.length < 8) {
        inviteError.textContent = "Use at least 8 characters.";
        return;
      }
      const button = inviteForm.querySelector("button");
      button.disabled = true;
      try {
        const result = await updatePassword(session, password, { persist: false });
        if (!result.ok) {
          inviteError.textContent = result.signedOut
            ? "That invite link could not be opened."
            : result.message || "Could not save that password.";
          return;
        }
        saveSession(result.session);
        window.location.assign(new URL("practice/", loginDirectory()).href);
      } catch {
        inviteError.textContent = "Could not save that password.";
      } finally {
        button.disabled = false;
      }
    });
    return;
  }

  inviteContinue.hidden = false;
  inviteContinue.textContent = `Continue as ${described.email}`;
  inviteContinue.addEventListener("click", () => {
    saveSession(session);
    window.location.assign(new URL("practice/", loginDirectory()).href);
  });
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
