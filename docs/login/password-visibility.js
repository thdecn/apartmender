const groups = [
  { control: "show-login-password", fields: ["password"] },
  { control: "show-new-password", fields: ["invite-password", "invite-password-confirm"] },
];

export function syncPasswordVisibility() {
  for (const group of groups) {
    const control = document.getElementById(group.control);
    if (!control) continue;
    for (const id of group.fields) {
      const field = document.getElementById(id);
      if (field) field.type = control.checked ? "text" : "password";
    }
  }
}

for (const group of groups) {
  document.getElementById(group.control)?.addEventListener("change", syncPasswordVisibility);
}
window.addEventListener("pageshow", syncPasswordVisibility);
syncPasswordVisibility();
