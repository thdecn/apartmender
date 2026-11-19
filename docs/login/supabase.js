import { createBrowserData } from "./browser-data.js?auth=operator-onboarding-v1";
import { readPublicSupabaseConfig } from "./config.js";

let createClient;
try {
  ({ createClient } = await import(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm"
  ));
} catch {
  // The adapter converts a missing client into a stable unavailable outcome.
}

export const browserData = createBrowserData({
  config: readPublicSupabaseConfig(),
  createClient,
  history: window.history,
  location: window.location,
  storage: availableStorage("sessionStorage"),
  completionStorage: availableStorage("localStorage"),
});

function availableStorage(kind) {
  const probe = `apartmender-${kind}-probe`;
  try {
    const storage = window[kind];
    // Existing recovery progress must remain readable when writes are blocked.
    // The progress store verifies its own writes before allowing password setup.
    if (kind === "localStorage") { storage.getItem(probe); return storage; }
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
