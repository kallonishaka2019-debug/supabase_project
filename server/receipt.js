const nodemailer = require("nodemailer");

const BUSINESS_NAME = "JerseyHub";
const CURRENCY = "SLE";
const PLAN_LABELS = { full: "Paid in full", deposit: "50% deposit", pickup: "Pay on pickup" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

function receiptNumber(order) {
  return `JH-${String(order.id ?? 0).padStart(6, "0")}`;
}

function receiptData(order) {
  const items = (Array.isArray(order.items) ? order.items : []).map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice ?? item.unit_price) || 0;
    const customName = item.customName ?? item.custom_name;
    const customNumber = item.customNumber ?? item.custom_number;
    return {
      club: String(item.club || ""),
      kit: String(item.kit || ""),
      size: String(item.size || ""),
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
      custom: item.custom ? [customName, customNumber ? `#${customNumber}` : ""].filter(Boolean).join(" ") : "",
    };
  });
  const total = Number(order.total) || 0;
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = Math.max(0, total - subtotal);
  const isDelivery = order.delivery_method === "delivery";
  const paid = Math.min(total, Number(order.payment_due) || 0);
  return {
    items,
    total,
    deliveryFee,
    isDelivery,
    paid,
    balance: total - paid,
    plan: PLAN_LABELS[order.payment_plan] || String(order.payment_plan || ""),
    date: new Date(order.created_at || Date.now()).toISOString().slice(0, 10),
    address: isDelivery ? String(order.delivery_address || "") : "Pickup",
  };
}

function buildReceiptHtml(order) {
  const d = receiptData(order);
  const rows = d.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.club)} ${item.kit ? `(${escapeHtml(item.kit)})` : ""}${item.custom ? `<br><small>Custom: ${escapeHtml(item.custom)}</small>` : ""}</td>
        <td>${escapeHtml(item.size)}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:right">${CURRENCY} ${item.unitPrice}</td>
        <td style="text-align:right">${CURRENCY} ${item.lineTotal}</td>
      </tr>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${BUSINESS_NAME} receipt ${escapeHtml(receiptNumber(order))}</title></head>
<body style="font-family:Arial,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px">
  <h1 style="margin:0">${BUSINESS_NAME}</h1>
  <h2 style="margin:4px 0 16px">Purchase receipt ${escapeHtml(receiptNumber(order))}</h2>
  <p>Date: ${escapeHtml(d.date)}<br>
  Customer: ${escapeHtml(order.customer_name)}<br>
  Phone: ${escapeHtml(order.customer_phone)}<br>
  Email: ${escapeHtml(order.customer_email || "—")}</p>
  <table style="width:100%;border-collapse:collapse" border="1" cellpadding="6">
    <thead><tr><th align="left">Item</th><th align="left">Size</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead>
    <tbody>${rows}
      <tr><td colspan="4">Delivery fee</td><td style="text-align:right">${CURRENCY} ${d.deliveryFee}</td></tr>
      <tr><td colspan="4"><strong>Total</strong></td><td style="text-align:right"><strong>${CURRENCY} ${d.total}</strong></td></tr>
    </tbody>
  </table>
  <p>Payment method: ${escapeHtml(order.payment_method)} (${escapeHtml(d.plan)})<br>
  Amount paid: ${CURRENCY} ${d.paid}<br>
  Balance due: ${CURRENCY} ${d.balance}</p>
  <p>Delivery method: ${d.isDelivery ? "Delivery" : "Pickup"}<br>
  ${d.isDelivery ? `Delivery address: <span style="white-space:pre-line">${escapeHtml(d.address)}</span>` : ""}</p>
  <p>Thank you for shopping with ${BUSINESS_NAME}!</p>
</body></html>`;
}

function buildReceiptText(order) {
  const d = receiptData(order);
  const lines = [
    `${BUSINESS_NAME} - Purchase receipt ${receiptNumber(order)}`,
    `Date: ${d.date}`,
    `Customer: ${order.customer_name}`,
    `Phone: ${order.customer_phone}`,
    `Email: ${order.customer_email || "-"}`,
    "",
    ...d.items.map((item) => `${item.club} (${item.kit}) size ${item.size} x ${item.quantity} @ ${CURRENCY} ${item.unitPrice} = ${CURRENCY} ${item.lineTotal}${item.custom ? ` [Custom: ${item.custom}]` : ""}`),
    `Delivery fee: ${CURRENCY} ${d.deliveryFee}`,
    `Total: ${CURRENCY} ${d.total}`,
    `Amount paid: ${CURRENCY} ${d.paid}`,
    `Balance due: ${CURRENCY} ${d.balance}`,
    `Payment method: ${order.payment_method} (${d.plan})`,
    d.isDelivery ? `Delivery address: ${d.address}` : "Delivery: Pickup",
    "",
    `Thank you for shopping with ${BUSINESS_NAME}!`,
  ];
  return lines.join("\n");
}

// Returns true when an email was sent, false when skipped (not configured / no recipient).
async function sendReceiptEmail(order) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.warn("SMTP is not configured; skipping receipt email for order", order?.id);
    return false;
  }
  if (!order?.customer_email) {
    console.warn("Order has no customer email; skipping receipt for order", order?.id);
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || user,
    to: order.customer_email,
    subject: `${BUSINESS_NAME} receipt ${receiptNumber(order)}`,
    text: buildReceiptText(order),
    html: buildReceiptHtml(order),
  });
  return true;
}

module.exports = { buildReceiptHtml, buildReceiptText, sendReceiptEmail, escapeHtml };
