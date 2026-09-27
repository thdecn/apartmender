const publicEnvironments = Object.freeze({
  local: Object.freeze({
    projectUrl: "http://127.0.0.1:54331",
    publishableKey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  }),
  hosted: Object.freeze({
    projectUrl: "https://jxhxerchsxonsgmqsatd.supabase.co",
    publishableKey: "sb_publishable_EpjtZdFoQ2x4KPLyTLRS-A_2J_vQ5Gv",
  }),
});

export function readPublicSupabaseConfig(location = window.location) {
  const environment = selectEnvironment(location);
  if (!environment) return null;

  const config = publicEnvironments[environment];
  if (!isValidProjectUrl(config.projectUrl) || !isBrowserKey(config.publishableKey)) {
    return null;
  }
  return config;
}

function selectEnvironment(location) {
  if (location.protocol === "http:" && ["127.0.0.1", "localhost"].includes(location.hostname)) {
    return "local";
  }
  if (location.protocol === "https:" && location.hostname === "thdecn.github.io") {
    return "hosted";
  }
  return null;
}

function isValidProjectUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isBrowserKey(value) {
  return (
    typeof value === "string" &&
    value.length > 20 &&
    !value.startsWith("sb_secret_") &&
    !value.toLowerCase().includes("service_role")
  );
}
