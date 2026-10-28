const crypto = require("node:crypto");

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
];

const STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processed", "cancelled", "refunded"],
  processed: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "returned", "refunded"],
  delivered: ["returned", "refunded"],
  returned: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

function isAllowedOrderTransition(from, to) {
  return STATUS_TRANSITIONS[from]?.includes(to) || false;
}

function calculateInvoiceAmounts(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce((sum, item) => {
    const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
    const quantity = Number(item.quantity ?? 0);
    if (!Number.isSafeInteger(unitPrice) || !Number.isSafeInteger(quantity)) return sum;
    return sum + unitPrice * quantity;
  }, 0);
  const total = Number(order.total);
  if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(total) || total < subtotal) {
    throw new Error("Order totals are invalid.");
  }

  const paymentConfirmed = ["confirmed", "processed", "shipped", "delivered", "returned", "refunded"]
    .includes(order.status);
  const paidAmount = paymentConfirmed ? Math.min(Number(order.payment_due) || 0, total) : 0;

  return {
    subtotal,
    discount: 0,
    shipping: total - subtotal,
    tax: 0,
    total,
    paidAmount,
    balanceDue: total - paidAmount,
    paymentStatus: paidAmount >= total ? "paid" : paidAmount > 0 ? "partially paid" : "unpaid",
    documentType: paidAmount >= total ? "receipt" : "invoice",
  };
}

function hashShareToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

module.exports = {
  ORDER_STATUSES,
  calculateInvoiceAmounts,
  hashShareToken,
  isAllowedOrderTransition,
};
