import { mountPractice } from "./practice-host.js";

const response = await fetch(new URL("./pieces.json", import.meta.url));
if (!response.ok) throw new Error("Failed to load pieces.json");
mountPractice({ pieces: await response.json() });
