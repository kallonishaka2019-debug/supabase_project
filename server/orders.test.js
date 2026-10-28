const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const {
  canTransition,
  computeInvoice,
  redactInvoiceForShare,
  generateShareToken,
  hashShareToken,
  parseShareHours,
  shareLinkState,
  parseAdminOrderUpdate,
  SHARE_TOKEN_PATTERN,
} = require("./orders");
const { renderInvoicePdf } = require("./invoice-pdf");
const { registerOrderRoutes } = require("./order-routes");

const baseOrder = {
  id: 7,
  user_id: "user-1",
  created_at: "2026-10-01T10:00:00Z",
  status: "confirmed",
  customer_name: "Mariama Kamara",
  customer_phone: "+23276000000",
  delivery_method: "delivery",
  delivery_address: "12 Hill Station",
  payment_method: "monime",
  payment_plan: "full",
  payment_due: 650,
  amount_paid: 650,
  payment_status: "paid",
  total: 650,
  delivery_fee: 50,
  discount_amount: 0,
  tax_amount: 0,
  items: [
    { club: "Real Madrid", kit: "Home 2026/27", size: "M", quantity: 2, unitPrice: 280 },
    { club: "Arsenal", kit: "Away", size: "L", quantity: 1, unitPrice: 40, custom: true, customName: "Ali", customNumber: "7" },
  ],
};
const invoiceRow = { invoice_number: "INV-2026-000007", issued_at: "2026-10-01T10:00:00Z", paid_at: "2026-10-01T10:05:00Z" };

test("canTransition allows only forward lifecycle moves", () => {
  assert.ok(canTransition("pending", "confirmed"));
  assert.ok(canTransition("confirmed", "processing"));
  assert.ok(canTransition("fulfilled", "returned"));
  assert.ok(!canTransition("pending", "fulfilled"));
  assert.ok(!canTransition("cancelled", "confirmed"));
  assert.ok(!canTransition("returned", "pending"));
  assert.ok(!canTransition("confirmed", "pending"));
});

test("computeInvoice totals line items, discounts, delivery and tax", () => {
  const invoice = computeInvoice({ ...baseOrder, discount_amount: 20, tax_amount: 10, total: 660 }, invoiceRow);
  assert.equal(invoice.subtotal, 600);
  assert.equal(invoice.total, 600 - 20 + 50 + 10);
  assert.equal(invoice.lines[0].lineTotal, 560);
  assert.equal(invoice.lines[1].customization, "Ali #7");
  assert.equal(invoice.payment.amountPaid, 640);
});

test("computeInvoice distinguishes receipts from unpaid invoices", () => {
  assert.equal(computeInvoice(baseOrder, invoiceRow).documentType, "receipt");
  const unpaid = computeInvoice({ ...baseOrder, payment_status: "unpaid", amount_paid: 0 }, invoiceRow);
  assert.equal(unpaid.documentType, "invoice");
  assert.equal(unpaid.payment.balanceDue, 600 + 50);
  const partial = computeInvoice({ ...baseOrder, payment_status: "partial", amount_paid: 325 }, invoiceRow);
  assert.equal(partial.payment.balanceDue, 325);
});

test("computeInvoice derives the delivery fee for legacy orders", () => {
  const legacy = computeInvoice({ ...baseOrder, delivery_fee: null }, invoiceRow);
  assert.equal(legacy.deliveryFee, 50);
  assert.equal(legacy.total, 650);
});

test("redactInvoiceForShare removes private customer data", () => {
  const shared = redactInvoiceForShare(computeInvoice(baseOrder, invoiceRow));
  const text = JSON.stringify(shared);
  assert.ok(!text.includes("23276000000"));
  assert.ok(!text.includes("Hill Station"));
  assert.ok(!text.includes("Mariama"));
  assert.ok(!text.includes("monime"));
  assert.equal(shared.customer.name, "M. K.");
  assert.equal(shared.total, 650);
});

test("share tokens are random, URL-safe and stored only as hashes", () => {
  const a = generateShareToken();
  const b = generateShareToken();
  assert.notEqual(a.token, b.token);
  assert.match(a.token, SHARE_TOKEN_PATTERN);
  assert.equal(a.hash, hashShareToken(a.token));
  assert.notEqual(a.hash, a.token);
});

test("share link lifetime and state", () => {
  assert.equal(parseShareHours(undefined), 24);
  assert.equal(parseShareHours(48), 48);
  assert.equal(parseShareHours(0), null);
  assert.equal(parseShareHours(24 * 31), null);
  assert.equal(parseShareHours("abc"), null);
  const now = new Date("2026-10-01T00:00:00Z");
  assert.equal(shareLinkState({ expires_at: "2026-10-02T00:00:00Z", revoked_at: null }, now), "active");
  assert.equal(shareLinkState({ expires_at: "2026-09-30T00:00:00Z", revoked_at: null }, now), "expired");
  assert.equal(shareLinkState({ expires_at: "2026-10-02T00:00:00Z", revoked_at: "2026-10-01T00:00:00Z" }, now), "revoked");
  assert.equal(shareLinkState(null, now), "invalid");
});

test("parseAdminOrderUpdate validates input", () => {
  assert.ok(parseAdminOrderUpdate({ status: "bogus" }).error);
  assert.ok(parseAdminOrderUpdate({}).error);
  assert.ok(parseAdminOrderUpdate({ estimatedDelivery: "2026-02-31" }).error);
  assert.ok(parseAdminOrderUpdate({ paymentStatus: "unpaid" }).error);
  assert.ok(parseAdminOrderUpdate({ note: "x".repeat(501) }).error);
  const ok = parseAdminOrderUpdate({ status: "processing", note: " Packing ", estimatedDelivery: "2026-11-02" });
  assert.deepEqual(ok.update, { status: "processing", note: "Packing", estimatedDelivery: "2026-11-02", clearEstimate: false, paymentStatus: null });
});

test("renderInvoicePdf produces a PDF", async () => {
  const pdf = await renderInvoicePdf(computeInvoice(baseOrder, invoiceRow));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});

// Minimal in-memory stand-in for the Supabase query builder used by order-routes.js.
function createFakeSupabase(tables) {
  function builder(name) {
    const state = { filters: [], op: "select", payload: null, single: false, maybe: false, head: false, limit: null };
    const api = {
      select(_cols, opts) { if (state.op === "select") state.op = "select"; state.head = Boolean(opts?.head); state.count = opts?.count; return api; },
      insert(row) { state.op = "insert"; state.payload = row; return api; },
      update(row) { state.op = "update"; state.payload = row; return api; },
      eq(col, val) { state.filters.push((r) => r[col] === val); return api; },
      is(col, val) { state.filters.push((r) => (r[col] ?? null) === val); return api; },
      gt(col, val) { state.filters.push((r) => r[col] > val); return api; },
      in(col, vals) { state.filters.push((r) => vals.includes(r[col])); return api; },
      order() { return api; },
      limit(n) { state.limit = n; return api; },
      single() { state.single = true; return api; },
      maybeSingle() { state.maybe = true; return api; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    function run() {
      const rows = tables[name];
      if (state.op === "insert") {
        const row = { id: `gen-${rows.length + 1}`, created_at: new Date().toISOString(), revoked_at: null, access_count: 0, ...state.payload };
        rows.push(row);
        return { data: state.single ? row : [row], error: null };
      }
      const matched = rows.filter((r) => state.filters.every((f) => f(r)));
      if (state.op === "update") {
        matched.forEach((r) => Object.assign(r, state.payload));
        return { data: matched, error: null };
      }
      if (state.head) return { data: null, count: matched.length, error: null };
      const limited = state.limit ? matched.slice(0, state.limit) : matched;
      if (state.single || state.maybe) return { data: limited[0] || null, error: null };
      return { data: limited, error: null };
    }
    return api;
  }
  return {
    from: builder,
    rpc: async (fn, args) => {
      if (args.p_status && !canTransition(tables.orders.find((o) => o.id === args.p_order_id).status, args.p_status)) {
        return { data: null, error: { message: "Invalid order status transition: x -> y", code: "23514" } };
      }
      return { data: { id: args.p_order_id, status: args.p_status }, error: null };
    },
  };
}

async function withServer(users, tables, fn) {
  const supabaseAdmin = createFakeSupabase(tables);
  const app = express();
  app.use(express.json());
  const requireAuth = (request, response, next) => {
    const user = users[request.get("x-test-user")];
    if (!user) return response.status(401).json({ error: "Please log in to continue." });
    request.user = user;
    return next();
  };
  const requireAdmin = (request, response, next) => requireAuth(request, response, () => (
    request.user.is_admin ? next() : response.status(403).json({ error: "Admin access required." })
  ));
  registerOrderRoutes(app, { supabaseAdmin, ensureSupabase: (q, r, n) => n(), requireAuth, requireAdmin, appBaseUrl: "https://shop.test" });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { user, method = "GET", body } = {}) => fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  try {
    await fn(call);
  } finally {
    server.close();
  }
}

function fixtureTables() {
  return {
    orders: [{ ...baseOrder }, { ...baseOrder, id: 8, user_id: "user-2" }],
    invoices: [
      { id: 1, order_id: 7, ...invoiceRow },
      { id: 2, order_id: 8, invoice_number: "INV-2026-000008", issued_at: invoiceRow.issued_at, paid_at: null },
    ],
    order_status_history: [{ id: 1, order_id: 7, status: "pending", created_at: "2026-10-01T10:00:00Z" }],
    invoice_share_links: [],
    order_notifications: [],
  };
}

const users = {
  alice: { id: "user-1", is_admin: false },
  bob: { id: "user-2", is_admin: false },
  admin: { id: "admin-1", is_admin: true },
};

test("customers can only access their own orders and invoices", async () => {
  await withServer(users, fixtureTables(), async (call) => {
    assert.equal((await call("/api/orders/7/invoice")).status, 401);
    assert.equal((await call("/api/orders/7/invoice", { user: "alice" })).status, 200);
    assert.equal((await call("/api/orders/8/invoice", { user: "alice" })).status, 404);
    assert.equal((await call("/api/orders/8/invoice/pdf", { user: "alice" })).status, 404);
    assert.equal((await call("/api/orders/8/invoice/shares", { user: "alice", method: "POST", body: {} })).status, 404);
    assert.equal((await call("/api/orders/8/invoice", { user: "admin" })).status, 200);
    const list = await (await call("/api/orders", { user: "alice" })).json();
    assert.deepEqual(list.orders.map((order) => order.id), [7]);
    assert.equal(list.orders[0].invoice_number, "INV-2026-000007");
    assert.equal(list.orders[0].history.length, 1);
    const pdf = await call("/api/orders/7/invoice/pdf", { user: "alice" });
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
  });
});

test("share links can be created, used without login, revoked and expire", async () => {
  const tables = fixtureTables();
  await withServer(users, tables, async (call) => {
    const created = await call("/api/orders/7/invoice/shares", { user: "alice", method: "POST", body: { expiresInHours: 2 } });
    assert.equal(created.status, 201);
    const { share } = await created.json();
    const token = share.url.split("#share=")[1];
    assert.match(token, SHARE_TOKEN_PATTERN);
    assert.equal(tables.invoice_share_links[0].token_hash, hashShareToken(token));
    assert.ok(!JSON.stringify(tables.invoice_share_links).includes(token));

    const shared = await call(`/api/invoices/shared/${token}`);
    assert.equal(shared.status, 200);
    const body = await shared.json();
    assert.equal(body.invoice.invoiceNumber, "INV-2026-000007");
    assert.ok(!JSON.stringify(body).includes("Hill Station"));
    assert.equal((await call(`/api/invoices/shared/${token}/pdf`)).status, 200);

    assert.equal((await call(`/api/invoices/shared/${"a".repeat(43)}`)).status, 404);
    assert.equal((await call("/api/invoices/shared/short")).status, 404);

    // Another customer cannot revoke it; the owner can.
    assert.equal((await call(`/api/orders/7/invoice/shares/${share.id}`, { user: "bob", method: "DELETE" })).status, 404);
    assert.equal((await call(`/api/orders/7/invoice/shares/${share.id}`, { user: "alice", method: "DELETE" })).status, 400, "ids must be UUIDs");
    tables.invoice_share_links[0].id = "11111111-1111-1111-1111-111111111111";
    assert.equal((await call("/api/orders/7/invoice/shares/11111111-1111-1111-1111-111111111111", { user: "alice", method: "DELETE" })).status, 204);
    assert.equal((await call(`/api/invoices/shared/${token}`)).status, 404);

    const second = await (await call("/api/orders/7/invoice/shares", { user: "alice", method: "POST", body: {} })).json();
    const secondToken = second.share.url.split("#share=")[1];
    tables.invoice_share_links[1].expires_at = new Date(Date.now() - 1000).toISOString();
    assert.equal((await call(`/api/invoices/shared/${secondToken}`)).status, 404);

    assert.equal((await call("/api/orders/7/invoice/shares", { user: "alice", method: "POST", body: { expiresInHours: 9999 } })).status, 400);
  });
});

test("only admins can update order status, and invalid transitions are rejected", async () => {
  await withServer(users, fixtureTables(), async (call) => {
    assert.equal((await call("/api/admin/orders/7", { method: "PATCH", body: { status: "processing" } })).status, 401);
    assert.equal((await call("/api/admin/orders/7", { user: "alice", method: "PATCH", body: { status: "processing" } })).status, 403);
    assert.equal((await call("/api/admin/orders/7", { user: "admin", method: "PATCH", body: { status: "nonsense" } })).status, 400);
    assert.equal((await call("/api/admin/orders/7", { user: "admin", method: "PATCH", body: { status: "pending" } })).status, 409);
    assert.equal((await call("/api/admin/orders/7", { user: "admin", method: "PATCH", body: { status: "processing", note: "ok" } })).status, 200);
  });
});

test("notifications are only visible to their owner", async () => {
  const tables = fixtureTables();
  tables.order_notifications.push(
    { id: 1, user_id: "user-1", order_id: 7, kind: "order_confirmed", message: "m", created_at: "2026-10-01", read_at: null },
    { id: 2, user_id: "user-2", order_id: 8, kind: "order_confirmed", message: "m", created_at: "2026-10-01", read_at: null },
  );
  await withServer(users, tables, async (call) => {
    const list = await (await call("/api/notifications", { user: "alice" })).json();
    assert.deepEqual(list.notifications.map((n) => n.id), [1]);
    assert.equal((await call("/api/notifications/read", { user: "alice", method: "POST", body: { ids: [2] } })).status, 204);
    assert.equal(tables.order_notifications[1].read_at, null);
    assert.equal((await call("/api/notifications/read", { user: "alice", method: "POST", body: { ids: [1] } })).status, 204);
    assert.ok(tables.order_notifications[0].read_at);
  });
});
