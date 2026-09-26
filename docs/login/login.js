import { adoptInviteFromUrl, readSession, saveSession, signIn } from "./supabase.js";

const form = document.querySelector("#login-form");
const error = document.querySelector("#login-error");
const adopted = adoptInviteFromUrl();

if (adopted?.error) {
  error.textContent = "That invite link could not be opened.";
} else if (adopted?.session || readSession()) {
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
