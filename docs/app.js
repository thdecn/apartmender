import { mountPractice } from "./practice-host.js";
import { generalPracticePieces } from "./piece-catalog.js";
import { createPublicScoreCard } from "./notation/public-score-card.js";

try {
  const responses = await Promise.all(["pieces.json", "general-practice-collection.json"].map(path => fetch(new URL(path, import.meta.url))));
  if (responses.some(response => !response.ok)) throw Error("Catalogue load failed");
  const [catalog, collection] = await Promise.all(responses.map(response => response.json()));
  mountPractice({ pieces: generalPracticePieces(catalog, collection), presentation: createPublicScoreCard() });
} catch {
  const message = document.getElementById("piece-list");
  message.setAttribute("role", "alert");
  message.textContent = "Practice pieces could not be loaded. Reload to try again.";
}
