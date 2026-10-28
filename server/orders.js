const crypto = require("node:crypto");

const ORDER_STATUSES = ["pending", "confirmed", "processing", "fulfilled", "cancelled", "returned"];

// Mirrors public.order_status_transition_allowed() in supabase/migrate_order_tracking.sql.
const STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "fulfilled", "cancelled"],
  processing: ["fulfilled", "cancelled"],
  fulfilled: ["returned"],
  cancelled: [],
  returned: [],
};

const SHARE_DEFAULT_HOURS = 24;
const SHARE_MAX_HOURS = 24 * 30;
const SHARE_MAX_ACTIVE_LINKS = 10;
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const NOTE_MAX_LENGTH = 500;

function canTransition(from, to) {
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

function storeDetails(env = process.env) {
  return {
    name: String(env.STORE_NAME || "JerseyHub SL").trim(),
    address: String(env.STORE_ADDRESS || "30 Mountain Cut, Freetown, Sierra Leone").trim(),
    phone: String(env.STORE_PHONE || "+232 78 952 429").trim(),
    email: String(env.STORE_EMAIL || "").trim(),
  };
}

function nonNegativeInt(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function describeCustomization(item) {
  const name = String(item.customName ?? item.custom_name ?? "").trim();
  const number = String(item.customNumber ?? item.custom_number ?? "").trim();
  return [name, number ? `#${number}` : ""].filter(Boolean).join(" ");
}

// Builds the invoice only from stored order data; nothing here comes from the request.
function computeInvoice(order, invoiceRow, env = process.env) {
  const lines = (Array.isArray(order.items) ? order.items : []).map((item) => {
    const quantity = nonNegativeInt(item.quantity);
    const unitPrice = nonNegativeInt(item.unitPrice ?? item.unit_price);
    const customization = item.custom ? describeCustomization(item) : "";
    return {
      description: [item.club, item.kit].filter(Boolean).join(" ").trim() || "Item",
      size: String(item.size || ""),
      customization,
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discount = nonNegativeInt(order.discount_amount);
  const tax = nonNegativeInt(order.tax_amount);
  const storedTotal = nonNegativeInt(order.total);
  const deliveryFee = order.delivery_fee === null || order.delivery_fee === undefined
    ? Math.max(0, storedTotal - (subtotal - discount + tax))
    : nonNegativeInt(order.delivery_fee);
  const total = Math.max(0, subtotal - discount) + deliveryFee + tax;

  const paymentStatus = String(order.payment_status || "unpaid");
  const amountPaid = Math.min(nonNegativeInt(order.amount_paid), total);
  const balanceDue = paymentStatus === "refunded" || ["cancelled", "returned"].includes(order.status)
    ? 0
    : Math.max(0, total - amountPaid);

  return {
    invoiceNumber: invoiceRow.invoice_number,
    documentType: paymentStatus === "paid" ? "receipt" : "invoice",
    issuedAt: invoiceRow.issued_at,
    paidAt: invoiceRow.paid_at || null,
    orderId: order.id,
    orderDate: order.created_at,
    orderStatus: order.status,
    store: storeDetails(env),
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
    },
    delivery: {
      method: order.delivery_method,
      address: order.delivery_method === "delivery" ? order.delivery_address || "" : "",
      estimatedDelivery: order.estimated_delivery || null,
    },
    lines,
    subtotal,
    discount,
    deliveryFee,
    tax,
    total,
    payment: {
      method: order.payment_method,
      plan: order.payment_plan,
      status: paymentStatus,
      amountPaid,
      balanceDue,
    },
  };
}

function maskName(name) {
  const initials = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(" ");
  return initials || "Customer";
}

// Public share links never include contact details, delivery address, notes or payment identifiers.
function redactInvoiceForShare(invoice) {
  return {
    invoiceNumber: invoice.invoiceNumber,
    documentType: invoice.documentType,
    issuedAt: invoice.issuedAt,
    paidAt: invoice.paidAt,
    orderDate: invoice.orderDate,
    orderStatus: invoice.orderStatus,
    store: { name: invoice.store.name, address: invoice.store.address, phone: invoice.store.phone, email: invoice.store.email },
    customer: { name: maskName(invoice.customer.name), phone: "" },
    delivery: { method: invoice.delivery.method, address: "", estimatedDelivery: invoice.delivery.estimatedDelivery },
    lines: invoice.lines.map((line) => ({ ...line })),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    deliveryFee: invoice.deliveryFee,
    tax: invoice.tax,
    total: invoice.total,
    payment: {
      method: "",
      plan: "",
      status: invoice.payment.status,
      amountPaid: invoice.payment.amountPaid,
      balanceDue: invoice.payment.balanceDue,
    },
  };
}

function generateShareToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashShareToken(token) };
}

function hashShareToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function parseShareHours(value) {
  if (value === undefined || value === null || value === "") return SHARE_DEFAULT_HOURS;
  const hours = Number(value);
  if (!Number.isInteger(hours) || hours < 1 || hours > SHARE_MAX_HOURS) return null;
  return hours;
}

function shareLinkState(link, now = new Date()) {
  if (!link) return "invalid";
  if (link.revoked_at) return "revoked";
  if (new Date(link.expires_at).getTime() <= now.getTime()) return "expired";
  return "active";
}

// Validates admin input for PATCH /api/admin/orders/:id; the database re-validates transitions.
function parseAdminOrderUpdate(body = {}) {
  const update = { status: null, note: null, estimatedDelivery: null, clearEstimate: false, paymentStatus: null };

  if (body.status !== undefined && body.status !== null && body.status !== "") {
    if (!ORDER_STATUSES.includes(body.status)) return { error: "Invalid status" };
    update.status = body.status;
  }
  if (body.note !== undefined && body.note !== null) {
    const note = String(body.note).trim();
    if (note.length > NOTE_MAX_LENGTH) return { error: `Note must be at most ${NOTE_MAX_LENGTH} characters` };
    update.note = note || null;
  }
  if (body.estimatedDelivery !== undefined) {
    if (body.estimatedDelivery === null || body.estimatedDelivery === "") {
      update.clearEstimate = true;
    } else {
      const value = String(body.estimatedDelivery);
      const parsed = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        return { error: "Estimated delivery must be a valid date (YYYY-MM-DD)" };
      }
      update.estimatedDelivery = value;
    }
  }
  if (body.paymentStatus !== undefined && body.paymentStatus !== null && body.paymentStatus !== "") {
    if (!["paid", "refunded"].includes(body.paymentStatus)) return { error: "Invalid payment status" };
    update.paymentStatus = body.paymentStatus;
  }
  if (!update.status && !update.note && !update.estimatedDelivery && !update.clearEstimate && !update.paymentStatus) {
    return { error: "Nothing to update" };
  }
  return { update };
}

module.exports = {
  ORDER_STATUSES,
  STATUS_TRANSITIONS,
  SHARE_DEFAULT_HOURS,
  SHARE_MAX_HOURS,
  SHARE_MAX_ACTIVE_LINKS,
  SHARE_TOKEN_PATTERN,
  canTransition,
  computeInvoice,
  redactInvoiceForShare,
  generateShareToken,
  hashShareToken,
  parseShareHours,
  shareLinkState,
  parseAdminOrderUpdate,
  storeDetails,
};
