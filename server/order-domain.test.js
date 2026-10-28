const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculateInvoiceAmounts,
  hashShareToken,
  isShareLinkUsable,
  isAllowedOrderTransition,
} = require("./order-domain");

test("order status transitions advance through fulfillment and keep terminal statuses distinct", () => {
  assert.equal(isAllowedOrderTransition("pending", "confirmed"), true);
  assert.equal(isAllowedOrderTransition("confirmed", "processed"), true);
  assert.equal(isAllowedOrderTransition("shipped", "delivered"), true);
  assert.equal(isAllowedOrderTransition("delivered", "returned"), true);
  assert.equal(isAllowedOrderTransition("returned", "refunded"), true);
  assert.equal(isAllowedOrderTransition("delivered", "pending"), false);
  assert.equal(isAllowedOrderTransition("refunded", "shipped"), false);
});

test("invoice amounts use saved order totals and report partial payments accurately", () => {
  const invoice = calculateInvoiceAmounts({
    items: [{ unitPrice: 125, quantity: 2 }],
    total: 300,
    payment_due: 150,
    status: "confirmed",
  });
  assert.deepEqual(invoice, {
    subtotal: 250,
    discount: 0,
    shipping: 50,
    tax: 0,
    total: 300,
    paidAmount: 150,
    balanceDue: 150,
    paymentStatus: "partially paid",
    documentType: "invoice",
  });
});

test("refunded orders report refunded payment state", () => {
  const invoice = calculateInvoiceAmounts({
    items: [{ unitPrice: 100, quantity: 1 }],
    total: 100,
    payment_due: 100,
    status: "refunded",
  });
  assert.equal(invoice.paymentStatus, "refunded");
});

test("cancelled orders retain payments recorded earlier in their history", () => {
  const invoice = calculateInvoiceAmounts({
    items: [{ unitPrice: 100, quantity: 1 }],
    total: 100,
    payment_due: 100,
    status: "cancelled",
    status_history: [{ to_status: "confirmed" }, { to_status: "cancelled" }],
  });
  assert.equal(invoice.paymentStatus, "paid");
});

test("invoice totals reject inconsistent or unsafe order data", () => {
  assert.throws(() => calculateInvoiceAmounts({
    items: [{ unitPrice: 101, quantity: 2 }],
    total: 150,
    status: "pending",
  }), /totals are invalid/i);
  assert.throws(() => calculateInvoiceAmounts({
    items: [{ unitPrice: -1, quantity: 1 }],
    total: 0,
    status: "pending",
  }), /items are invalid/i);
});

test("share tokens are stored as one-way SHA-256 digests", () => {
  assert.equal(hashShareToken("one-time-token"), hashShareToken("one-time-token"));
  assert.notEqual(hashShareToken("one-time-token"), "one-time-token");
  assert.notEqual(hashShareToken("one-time-token"), hashShareToken("another-token"));
});

test("share links reject revoked and expired tokens", () => {
  const now = Date.parse("2026-10-28T00:00:00.000Z");
  assert.equal(isShareLinkUsable({ expires_at: "2026-10-29T00:00:00.000Z" }, now), true);
  assert.equal(isShareLinkUsable({ expires_at: "2026-10-27T23:59:59.000Z" }, now), false);
  assert.equal(isShareLinkUsable({ expires_at: "2026-10-29T00:00:00.000Z", revoked_at: now }, now), false);
});
