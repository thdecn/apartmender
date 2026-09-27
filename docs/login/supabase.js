import { createBrowserData } from "./browser-data.js";
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
  storage: availableSessionStorage(),
});

function availableSessionStorage() {
  const probe = "apartmender-storage-probe";
  try {
    window.sessionStorage.setItem(probe, probe);
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    return null;
  }
}
