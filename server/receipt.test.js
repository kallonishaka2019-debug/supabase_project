const test = require("node:test");
const assert = require("node:assert/strict");
const { buildReceiptHtml, buildReceiptText } = require("./receipt");

const order = {
  id: 42,
  created_at: "2026-01-02T10:00:00Z",
  customer_name: "<script>alert(1)</script>",
  customer_phone: "076000000",
  customer_email: "a@b.co",
  delivery_method: "delivery",
  delivery_address: "12 Main St & <b>Freetown</b>",
  payment_method: "monime",
  payment_plan: "deposit",
  payment_due: 425,
  total: 850,
  items: [
    { club: "Arsenal", kit: "Home", size: "M", quantity: 2, unitPrice: 400, custom: true, customName: "Ali", customNumber: "10" },
  ],
};

test("receipt includes item totals, fee, and balance", () => {
  const text = buildReceiptText(order);
  assert.match(text, /JH-000042/);
  assert.match(text, /= SLE 800/);
  assert.match(text, /Delivery fee: SLE 50/);
  assert.match(text, /Total: SLE 850/);
  assert.match(text, /Balance due: SLE 425/);
});

test("receipt shows delivery address or pickup", () => {
  assert.match(buildReceiptText(order), /Delivery address: 12 Main St/);
  const pickup = { ...order, delivery_method: "pickup", delivery_address: "" };
  assert.match(buildReceiptHtml(pickup), /Pickup/);
});

test("receipt HTML escapes user-provided values", () => {
  const html = buildReceiptHtml(order);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(!html.includes("<b>Freetown</b>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
});
