const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculateInvoiceAmounts,
  hashShareToken,
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

test("invoice totals reject inconsistent or unsafe order data", () => {
  assert.throws(() => calculateInvoiceAmounts({
    items: [{ unitPrice: 101, quantity: 2 }],
    total: 150,
    status: "pending",
  }), /totals are invalid/i);
});

test("share tokens are stored as one-way SHA-256 digests", () => {
  assert.equal(hashShareToken("one-time-token"), hashShareToken("one-time-token"));
  assert.notEqual(hashShareToken("one-time-token"), "one-time-token");
  assert.notEqual(hashShareToken("one-time-token"), hashShareToken("another-token"));
});
