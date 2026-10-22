const assert = require("node:assert/strict");
const test = require("node:test");
const { customizationFee } = require("./customization");

test("customizationFee charges Le 7 per letter and Le 15 per digit", () => {
  assert.equal(customizationFee("Kamara", "10"), 6 * 7 + 2 * 15);
  assert.equal(customizationFee("", "7"), 15);
  assert.equal(customizationFee("J. O'Neil-X", null), 7 * 7 + 0);
  assert.equal(customizationFee(null, null), 0);
});
