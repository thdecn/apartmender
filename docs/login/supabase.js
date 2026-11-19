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
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
