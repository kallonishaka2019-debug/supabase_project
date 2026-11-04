const LAST_ORDER_STORAGE_KEY = 'jerseyhub-last-order';
const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
const INVOICE_LOGO_URL = 'brand/jerseyhub-logo-512.png';

let lastOrder = null;
let jsPdfPromise = null;

function formatInvoiceNumber(savedOrder) {
  const order = savedOrder?.order ?? savedOrder ?? {};
  return order.invoice_number || `JHSL-${String(order.id ?? '').padStart(4, '0')}`;
}

// Snapshot the order so the invoice survives the redirect to Monime and the cart being cleared.
function rememberOrder(savedOrder) {
  const order = savedOrder?.order ?? savedOrder ?? {};
  const items = cart.map(item => {
    const product = getCartProduct(item);
    return {
      title: `${product.club} · ${product.kit}`,
      size: item.size,
      qty: item.qty,
      unitPrice: Number(product.price),
      customLabel: customizationLabel(item),
      customFee: itemCustomizationFee(item)
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  lastOrder = {
    id: order.id ?? null,
    invoiceNumber: formatInvoiceNumber(savedOrder),
    createdAt: order.created_at || new Date().toISOString(),
    customer: {
      name: window.customer.name.trim(),
      phone: window.customer.phone.trim(),
      address: window.customer.delivery !== 'pickup' ? window.customer.address.trim() : '',
      delivery: window.customer.delivery === 'pickup' ? 'Pickup' : 'Delivery'
    },
    paymentMethod: paymentMethodLabel(),
    items,
    subtotal,
    deliveryCost: deliveryCost(),
    total: Number(order.total ?? subtotal + deliveryCost())
  };
  try {
    localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(lastOrder));
  } catch {
    // Storage may be unavailable in private browsing
  }
  return lastOrder;
}

function loadRememberedOrder(orderId) {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_ORDER_STORAGE_KEY));
    if (saved && Array.isArray(saved.items) && (!orderId || Number(saved.id) === Number(orderId))) return saved;
  } catch {
    // Ignore corrupt data
  }
  return null;
}

function loadJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jsPdfPromise) {
    jsPdfPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = JSPDF_URL;
      script.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('PDF library failed to load.'));
      script.onerror = () => reject(new Error('Could not load the PDF library. Check your connection.'));
      document.head.appendChild(script);
    }).catch(error => {
      jsPdfPromise = null;
      throw error;
    });
  }
  return jsPdfPromise;
}

function loadInvoiceLogo() {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = INVOICE_LOGO_URL;
  });
}

async function downloadInvoicePdf(order = lastOrder) {
  if (!order) throw new Error('No order found to invoice.');
  const [JsPDF, logo] = await Promise.all([loadJsPdf(), loadInvoiceLogo()]);
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const left = 15;
  const right = 195;
  const money = value => `${CURRENCY} ${Number(value).toLocaleString('en-US')}`;
  let y = 15;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 38, 'F');
  if (logo) {
    const canvas = document.createElement('canvas');
    canvas.width = logo.naturalWidth;
    canvas.height = logo.naturalHeight;
    canvas.getContext('2d').drawImage(logo, 0, 0);
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', left, 6, 26, 26);
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('JerseyHub', logo ? left + 31 : left, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('30 Mountain Cut, Freetown, Sierra Leone', logo ? left + 31 : left, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INVOICE', right, 20, { align: 'right' });

  doc.setTextColor(30, 30, 30);
  y = 50;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice no:', left, y);
  doc.text('Date:', left, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(order.invoiceNumber, left + 26, y);
  doc.text(new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), left + 26, y + 6);
  doc.text(`Payment: ${order.paymentMethod}`, left, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Billed to', 120, y);
  doc.setFont('helvetica', 'normal');
  const customerLines = [order.customer.name, order.customer.phone, `${order.customer.delivery}${order.customer.address ? `: ${order.customer.address}` : ''}`];
  doc.text(customerLines.flatMap(line => doc.splitTextToSize(line, 75)), 120, y + 6);

  y = 82;
  const drawHeader = () => {
    doc.setFillColor(238, 240, 244);
    doc.rect(left, y - 5, right - left, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Item', left + 2, y);
    doc.text('Qty', 125, y, { align: 'right' });
    doc.text('Unit price', 158, y, { align: 'right' });
    doc.text('Amount', right - 2, y, { align: 'right' });
    y += 8;
    doc.setFont('helvetica', 'normal');
  };
  drawHeader();

  order.items.forEach(item => {
    const lines = doc.splitTextToSize(`${item.title} (Size ${item.size})`, 85);
    const extra = item.customLabel ? [`Custom: ${item.customLabel}`] : [];
    const rowHeight = (lines.length + extra.length) * 5 + 3;
    if (y + rowHeight > 270) {
      doc.addPage();
      y = 20;
      drawHeader();
    }
    doc.text(lines, left + 2, y);
    if (extra.length) {
      doc.setTextColor(90, 90, 90);
      doc.text(extra, left + 2, y + lines.length * 5);
      doc.setTextColor(30, 30, 30);
    }
    doc.text(String(item.qty), 125, y, { align: 'right' });
    doc.text(money(item.unitPrice), 158, y, { align: 'right' });
    doc.text(money(item.unitPrice * item.qty), right - 2, y, { align: 'right' });
    y += rowHeight;
    doc.setDrawColor(225, 225, 225);
    doc.line(left, y - 3, right, y - 3);
  });

  if (y > 245) {
    doc.addPage();
    y = 20;
  }
  y += 4;
  doc.text('Subtotal', 158, y, { align: 'right' });
  doc.text(money(order.subtotal), right - 2, y, { align: 'right' });
  y += 6;
  doc.text(order.deliveryCost ? 'Delivery' : 'Pickup', 158, y, { align: 'right' });
  doc.text(order.deliveryCost ? money(order.deliveryCost) : 'Free', right - 2, y, { align: 'right' });
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total', 158, y, { align: 'right' });
  doc.text(money(order.total), right - 2, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text('Thank you for shopping with JerseyHub!', 105, 285, { align: 'center' });

  doc.save(`${order.invoiceNumber}.pdf`);
}
