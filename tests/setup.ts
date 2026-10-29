import "@testing-library/jest-dom/vitest";

// jsdom provides DOMParser / XMLSerializer in modern versions
if (typeof globalThis.DOMParser === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
}
