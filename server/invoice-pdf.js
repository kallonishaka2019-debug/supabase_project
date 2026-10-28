const PDFDocument = require("pdfkit");

const CURRENCY = "Le";

function money(value) {
  return `${CURRENCY} ${Number(value || 0).toLocaleString("en-US")}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function paymentLabel(invoice) {
  const labels = { paid: "PAID", partial: "PARTIALLY PAID", unpaid: "UNPAID", refunded: "REFUNDED" };
  return labels[invoice.payment.status] || "UNPAID";
}

// Renders an invoice (or paid receipt) into a PDF buffer. `invoice` comes from computeInvoice/redactInvoiceForShare.
function renderInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `${invoice.invoiceNumber}` } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const isReceipt = invoice.documentType === "receipt";

    doc.fillColor("#182333").fontSize(22).font("Helvetica-Bold").text(invoice.store.name, left, 48);
    doc.fontSize(9).font("Helvetica").fillColor("#687281");
    [invoice.store.address, invoice.store.phone, invoice.store.email].filter(Boolean).forEach((line) => doc.text(line));

    doc.fontSize(22).font("Helvetica-Bold").fillColor(isReceipt ? "#008f78" : "#e4573f")
      .text(isReceipt ? "RECEIPT" : "INVOICE", left, 48, { width: right - left, align: "right" });
    doc.fontSize(10).font("Helvetica").fillColor("#182333")
      .text(invoice.invoiceNumber, { width: right - left, align: "right" })
      .text(`Issued: ${formatDate(invoice.issuedAt)}`, { width: right - left, align: "right" })
      .font("Helvetica-Bold").fillColor(invoice.payment.status === "paid" ? "#008f78" : "#bd3d2b")
      .text(paymentLabel(invoice), { width: right - left, align: "right" });

    doc.moveDown(2).font("Helvetica-Bold").fontSize(10).fillColor("#182333").text("Billed to", left);
    doc.font("Helvetica").text(invoice.customer.name || "");
    if (invoice.customer.phone) doc.text(invoice.customer.phone);
    if (invoice.delivery.address) doc.text(invoice.delivery.address, { width: 260 });
    doc.moveDown(0.5).fillColor("#687281")
      .text(`Order #${invoice.orderId || ""}`.trim() + `  ·  ${formatDate(invoice.orderDate)}`)
      .text(`Delivery: ${invoice.delivery.method === "delivery" ? "Home delivery" : "Pickup"}`);
    if (invoice.delivery.estimatedDelivery) doc.text(`Estimated delivery: ${formatDate(invoice.delivery.estimatedDelivery)}`);

    const columns = { desc: left, qty: left + 290, unit: left + 340, total: left + 430 };
    let y = doc.y + 18;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#182333");
    doc.text("Item", columns.desc, y);
    doc.text("Qty", columns.qty, y, { width: 40, align: "right" });
    doc.text("Unit price", columns.unit, y, { width: 80, align: "right" });
    doc.text("Amount", columns.total, y, { width: right - columns.total, align: "right" });
    y += 16;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#cbd1dc").stroke();
    y += 8;

    doc.font("Helvetica").fontSize(9);
    invoice.lines.forEach((line) => {
      const description = [line.description, line.size && `Size ${line.size}`, line.customization].filter(Boolean).join(" - ");
      const height = doc.heightOfString(description, { width: 280 });
      if (y + height > doc.page.height - 160) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc.fillColor("#182333").text(description, columns.desc, y, { width: 280 });
      doc.text(String(line.quantity), columns.qty, y, { width: 40, align: "right" });
      doc.text(money(line.unitPrice), columns.unit, y, { width: 80, align: "right" });
      doc.text(money(line.lineTotal), columns.total, y, { width: right - columns.total, align: "right" });
      y += Math.max(height, 12) + 8;
    });

    doc.moveTo(left, y).lineTo(right, y).strokeColor("#cbd1dc").stroke();
    y += 10;
    const totals = [["Subtotal", money(invoice.subtotal)]];
    if (invoice.discount > 0) totals.push(["Discount", `- ${money(invoice.discount)}`]);
    totals.push(["Delivery fee", money(invoice.deliveryFee)]);
    if (invoice.tax > 0) totals.push(["Tax", money(invoice.tax)]);
    totals.push(["Total", money(invoice.total)]);
    totals.push(["Amount paid", money(invoice.payment.amountPaid)]);
    totals.push(["Balance due", money(invoice.payment.balanceDue)]);
    if (y + totals.length * 16 > doc.page.height - 80) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    totals.forEach(([label, value]) => {
      const bold = label === "Total" || label === "Balance due";
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#182333");
      doc.text(label, left + 290, y, { width: 100 });
      doc.text(value, columns.total - 20, y, { width: right - columns.total + 20, align: "right" });
      y += 16;
    });

    doc.font("Helvetica").fontSize(9).fillColor("#687281")
      .text(isReceipt ? "Thank you for your payment." : "Payment is pending. Please settle the balance due to complete your order.", left, y + 20, { width: right - left });
    doc.end();
  });
}

module.exports = { renderInvoicePdf };
