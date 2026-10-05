import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("declared Piece versions bind ordered card metadata and bytes", () => {
  const catalog = JSON.parse(readFileSync(new URL("../docs/pieces.json", import.meta.url)));
  for (const piece of catalog) {
    const cards = piece.cards.map((card) => [card, createHash("sha256")
      .update(readFileSync(new URL(`../docs/cards/${piece.id}/${card}`, import.meta.url)))
      .digest("hex")]);
    const digest = createHash("sha256")
      .update(JSON.stringify({ id: piece.id, label: piece.label, cards }))
      .digest("hex");
    assert.equal(piece.version, `sha256:${digest}`, piece.id);
  }
});
