import test from "node:test";
import assert from "node:assert/strict";

import { buildStudentHome } from "../docs/login/practice/student-home.js";

test("shared Practice controls keep General Practice separate from recorded Student visits", async () => {
  class ElementStub {
    constructor() {
      this.listeners = new Map();
      this.children = [];
      this.attributes = new Map();
      this.classList = { add() {}, remove() {} };
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    async emit(type) {
      await this.listeners.get(type)?.({ target: this });
    }

    replaceChildren(...children) {
      this.children = children;
    }

    setAttribute(name, value) {
      this.attributes.set(name, value);
    }

    removeAttribute(name) {
      this.attributes.delete(name);
      delete this[name];
    }
  }

  const ids = [
    "home", "practice", "piece-list", "piece-title", "card-meta", "practice-timer",
    "practice-timer-value", "previous-card-btn", "next-card-btn", "card-image", "counter",
    "mistake-btn", "good-btn", "advance-btn", "home-btn", "rotate-hint",
  ];
  const elements = new Map(ids.map((id) => [id, new ElementStub()]));
  elements.get("practice").hidden = true;
  const cardFrame = new ElementStub();
  const normal = Object.assign(new ElementStub(), { value: "normal", checked: true });
  const hard = Object.assign(new ElementStub(), { value: "hard", checked: false });
  const intervals = new Map();
  const stored = new Map();
  let now = 0;
  let nextInterval = 1;

  const names = ["document", "window", "navigator", "localStorage", "performance", "Element"];
  const original = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const install = (name, value) => {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  try {
    install("Element", ElementStub);
    install("document", {
      getElementById: (id) => elements.get(id),
      querySelector: () => cardFrame,
      querySelectorAll: () => [normal, hard],
      createElement: () => new ElementStub(),
      addEventListener() {},
    });
    install("window", {
      setInterval(callback) {
        const id = nextInterval++;
        intervals.set(id, callback);
        return id;
      },
      clearInterval: (id) => intervals.delete(id),
      setTimeout() {},
      matchMedia: () => ({ matches: false }),
      addEventListener() {},
    });
    install("navigator", {});
    install("localStorage", {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    });
    install("performance", { now: () => now });

    const { mountPractice } = await import("../docs/practice-host.js");
    const catalog = [
      { id: "first", label: "First Piece", cards: ["ending.png", "beginning.png"] },
      { id: "second", label: "Second Piece", cards: ["only.png"] },
    ];
    const home = buildStudentHome(
      { piece_1: "first", piece_2: "second", piece_3: "first" },
      catalog,
    );
    mountPractice({ pieces: home.pieces });

    const buttons = elements.get("piece-list").children;
    assert.deepEqual(buttons.map((button) => button.textContent), ["First Piece", "Second Piece"]);

    await buttons[0].emit("click");
    assert.equal(elements.get("home").hidden, true);
    assert.equal(elements.get("practice").hidden, false);
    assert.match(elements.get("card-image").src, /\/cards\/first\/ending\.png$/);
    assert.equal(intervals.size, 1);

    now = 5_000;
    [...intervals.values()][0]();
    assert.equal(elements.get("practice-timer-value").textContent, "0:05");
    for (let attempt = 0; attempt < 3; attempt += 1) await elements.get("good-btn").emit("click");
    await elements.get("advance-btn").emit("click");
    assert.match(elements.get("card-image").src, /\/cards\/first\/beginning\.png$/);
    await elements.get("previous-card-btn").emit("click");
    assert.equal(elements.get("advance-btn").textContent, "Resume");
    await elements.get("advance-btn").emit("click");
    assert.match(elements.get("card-image").src, /\/cards\/first\/beginning\.png$/);

    await elements.get("home-btn").emit("click");
    assert.equal(elements.get("home").hidden, false);
    assert.equal(intervals.size, 0);

    normal.checked = false;
    hard.checked = true;
    await hard.emit("change");
    assert.equal(stored.get("apartmender.practice-mode"), "hard");
    await buttons[1].emit("click");
    assert.equal(elements.get("practice-timer-value").textContent, "0:00");
    for (let attempt = 0; attempt < 3; attempt += 1) await elements.get("good-btn").emit("click");
    await elements.get("advance-btn").emit("click");
    assert.equal(elements.get("home").hidden, false);
    assert.equal(elements.get("practice").hidden, true);
    assert.equal(intervals.size, 0);
    assert.deepEqual([...stored.keys()], ["apartmender.practice-mode"]);

    const visits = [];
    document.visibilityState = "visible";
    window.matchMedia = () => ({ matches: true });
    mountPractice({ pieces: [catalog[1]], lifecycle: {
      async open(piece) { visits.push(["open", piece.id]); return true; },
      async resume() { visits.push(["resume"]); return true; },
      async pause(ms) { visits.push(["pause", ms]); },
      async finish(ms) { visits.push(["finish", ms]); },
    } });
    const studentButton = elements.get("piece-list").children[0];
    await studentButton.emit("click");
    assert.deepEqual(visits, [["open", "second"]]);
    now = 7_000;
    await elements.get("home-btn").emit("click");
    assert.deepEqual(visits.at(-1), ["finish", 2_000]);
    assert.equal(elements.get("home").hidden, false);

    await studentButton.emit("click");
    now = 9_000;
    for (let attempt = 0; attempt < 3; attempt += 1) await elements.get("good-btn").emit("click");
    await elements.get("advance-btn").emit("click");
    assert.deepEqual(visits.at(-1), ["finish", 2_000]);
    assert.equal(visits.filter(([kind]) => kind === "finish").length, 2);

    let cancelled = 0;
    mountPractice({ pieces: [catalog[1]], lifecycle: {
      async open() { return true; },
      canContinue: () => false,
      async cancel() { cancelled += 1; },
    } });
    await elements.get("piece-list").children[0].emit("click");
    assert.equal(cancelled, 1);
    assert.equal(elements.get("home").hidden, false);

    mountPractice({ pieces: [catalog[1]], lifecycle: {
      async open() {
        window.matchMedia = () => ({ matches: false });
        return true;
      },
      async cancel() { cancelled += 1; },
    } });
    window.matchMedia = () => ({ matches: true });
    await elements.get("piece-list").children[0].emit("click");
    assert.equal(cancelled, 2);
    assert.equal(elements.get("practice").hidden, true);
  } finally {
    for (const [name, descriptor] of original) {
      if (descriptor === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
  }
});
