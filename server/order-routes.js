const {
  SHARE_MAX_ACTIVE_LINKS,
  SHARE_TOKEN_PATTERN,
  computeInvoice,
  redactInvoiceForShare,
  generateShareToken,
  hashShareToken,
  parseShareHours,
  shareLinkState,
  parseAdminOrderUpdate,
} = require("./orders");
const { renderInvoicePdf } = require("./invoice-pdf");

// Never select monime_session_id or user_id for customer-facing responses.
const CUSTOMER_ORDER_COLUMNS = [
  "id", "created_at", "updated_at", "status", "items", "total", "delivery_method", "delivery_address",
  "payment_method", "payment_plan", "payment_due", "amount_paid", "payment_status", "estimated_delivery",
  "delivery_fee", "discount_amount", "tax_amount", "note", "customer_name", "customer_phone",
].join(", ");

const KNOWN_ADMIN_ERRORS = [
  "Invalid order status transition",
  "Cannot mark a cancelled or returned order as paid",
  "Nothing to refund",
  "Note is too long",
  "Invalid status",
  "Invalid payment status",
];

function parseOrderId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function registerOrderRoutes(app, { supabaseAdmin, ensureSupabase, requireAuth, requireAdmin, appBaseUrl }) {
  function noStore(response) {
    response.set("Cache-Control", "no-store");
  }

  async function loadHistory(orderIds) {
    if (!orderIds.length) return new Map();
    const { data, error } = await supabaseAdmin
      .from("order_status_history")
      .select("id, order_id, status, previous_status, note, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    const map = new Map();
    for (const row of data || []) {
      if (!map.has(row.order_id)) map.set(row.order_id, []);
      map.get(row.order_id).push(row);
    }
    return map;
  }

  // Returns the order only if the caller owns it (or is an admin). Others get a 404 to avoid revealing ids.
  async function loadAccessibleOrder(request, response, columns = CUSTOMER_ORDER_COLUMNS) {
    const orderId = parseOrderId(request.params.id);
    if (!orderId) {
      response.status(400).json({ error: "Invalid order id" });
      return null;
    }
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(`${columns}, user_id`)
      .eq("id", orderId)
      .maybeSingle();
    if (error) {
      response.status(500).json({ error: "Failed to load order" });
      return null;
    }
    if (!order || (!request.user.is_admin && order.user_id !== request.user.id)) {
      response.status(404).json({ error: "Order not found" });
      return null;
    }
    return order;
  }

  async function loadInvoiceRow(orderId) {
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("id, order_id, invoice_number, issued_at, paid_at")
      .eq("order_id", orderId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  function stripUser({ user_id, ...rest }) {
    return rest;
  }

  app.get("/api/orders", ensureSupabase, requireAuth, async (request, response) => {
    noStore(response);
    try {
      const { data: orders, error } = await supabaseAdmin
        .from("orders")
        .select(CUSTOMER_ORDER_COLUMNS)
        .eq("user_id", request.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (orders || []).map((order) => order.id);
      const history = await loadHistory(ids);
      const { data: invoices, error: invoiceError } = ids.length
        ? await supabaseAdmin.from("invoices").select("order_id, invoice_number").in("order_id", ids)
        : { data: [], error: null };
      if (invoiceError) throw invoiceError;
      const invoiceMap = new Map((invoices || []).map((invoice) => [invoice.order_id, invoice.invoice_number]));
      response.json({
        orders: (orders || []).map((order) => ({
          ...order,
          invoice_number: invoiceMap.get(order.id) || null,
          history: history.get(order.id) || [],
        })),
      });
    } catch (error) {
      console.error("Failed to load orders:", error.message);
      response.status(500).json({ error: "Failed to load orders" });
    }
  });

  app.get("/api/orders/:id", ensureSupabase, requireAuth, async (request, response) => {
    noStore(response);
    const order = await loadAccessibleOrder(request, response);
    if (!order) return;
    try {
      const history = await loadHistory([order.id]);
      const invoice = await loadInvoiceRow(order.id);
      response.json({
        order: { ...stripUser(order), invoice_number: invoice?.invoice_number || null, history: history.get(order.id) || [] },
      });
    } catch (error) {
      console.error("Failed to load order:", error.message);
      response.status(500).json({ error: "Failed to load order" });
    }
  });

  async function buildInvoiceForOrder(order) {
    const invoiceRow = await loadInvoiceRow(order.id);
    if (!invoiceRow) return null;
    return { invoice: computeInvoice(order, invoiceRow), invoiceRow };
  }

  app.get("/api/orders/:id/invoice", ensureSupabase, requireAuth, async (request, response) => {
    noStore(response);
    const order = await loadAccessibleOrder(request, response);
    if (!order) return;
    try {
      const built = await buildInvoiceForOrder(order);
      if (!built) return response.status(404).json({ error: "Invoice not found" });
      response.json({ invoice: built.invoice });
    } catch (error) {
      console.error("Failed to build invoice:", error.message);
      response.status(500).json({ error: "Failed to load invoice" });
    }
  });

  function sendPdf(response, invoice, pdf) {
    const safeName = String(invoice.invoiceNumber).replace(/[^A-Za-z0-9_-]/g, "");
    noStore(response);
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName || "invoice"}.pdf"`,
      "X-Content-Type-Options": "nosniff",
    });
    response.send(pdf);
  }

  app.get("/api/orders/:id/invoice/pdf", ensureSupabase, requireAuth, async (request, response) => {
    const order = await loadAccessibleOrder(request, response);
    if (!order) return;
    try {
      const built = await buildInvoiceForOrder(order);
      if (!built) return response.status(404).json({ error: "Invoice not found" });
      sendPdf(response, built.invoice, await renderInvoicePdf(built.invoice));
    } catch (error) {
      console.error("Failed to render invoice PDF:", error.message);
      response.status(500).json({ error: "Failed to generate invoice PDF" });
    }
  });

  // --- Share links (owner/admin managed, token-based public access) ---

  app.post("/api/orders/:id/invoice/shares", ensureSupabase, requireAuth, async (request, response) => {
    noStore(response);
    const hours = parseShareHours(request.body?.expiresInHours);
    if (hours === null) return response.status(400).json({ error: "Link lifetime must be between 1 hour and 30 days" });
    const order = await loadAccessibleOrder(request, response, "id");
    if (!order) return;
    try {
      const invoiceRow = await loadInvoiceRow(order.id);
      if (!invoiceRow) return response.status(404).json({ error: "Invoice not found" });

      const { count, error: countError } = await supabaseAdmin
        .from("invoice_share_links")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", invoiceRow.id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString());
      if (countError) throw countError;
      if ((count || 0) >= SHARE_MAX_ACTIVE_LINKS) {
        return response.status(409).json({ error: "Too many active share links. Revoke one first." });
      }

      const { token, hash } = generateShareToken();
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const { data: link, error } = await supabaseAdmin
        .from("invoice_share_links")
        .insert({ invoice_id: invoiceRow.id, token_hash: hash, created_by: request.user.id, expires_at: expiresAt })
        .select("id, created_at, expires_at")
        .single();
      if (error) throw error;

      // The token travels in the URL fragment so it is never sent to servers, logs or referrers.
      const url = `${appBaseUrl}/invoice.html#share=${token}`;
      response.status(201).json({ share: { ...link, url } });
    } catch (error) {
      console.error("Failed to create share link:", error.message);
      response.status(500).json({ error: "Failed to create share link" });
    }
  });

  app.get("/api/orders/:id/invoice/shares", ensureSupabase, requireAuth, async (request, response) => {
    noStore(response);
    const order = await loadAccessibleOrder(request, response, "id");
    if (!order) return;
    try {
      const invoiceRow = await loadInvoiceRow(order.id);
      if (!invoiceRow) return response.json({ shares: [] });
      const { data, error } = await supabaseAdmin
        .from("invoice_share_links")
        .select("id, created_at, expires_at, revoked_at, last_accessed_at, access_count")
        .eq("invoice_id", invoiceRow.id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      response.json({ shares: data || [] });
    } catch (error) {
      console.error("Failed to list share links:", error.message);
      response.status(500).json({ error: "Failed to load share links" });
    }
  });

  app.delete("/api/orders/:id/invoice/shares{/:shareId}", ensureSupabase, requireAuth, async (request, response) => {
    noStore(response);
    const order = await loadAccessibleOrder(request, response, "id");
    if (!order) return;
    const shareId = request.params.shareId;
    if (shareId !== undefined && !/^[0-9a-f-]{36}$/i.test(shareId)) {
      return response.status(400).json({ error: "Invalid share id" });
    }
    try {
      const invoiceRow = await loadInvoiceRow(order.id);
      if (!invoiceRow) return response.status(404).json({ error: "Invoice not found" });
      let query = supabaseAdmin
        .from("invoice_share_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("invoice_id", invoiceRow.id)
        .is("revoked_at", null);
      if (shareId) query = query.eq("id", shareId);
      const { error } = await query;
      if (error) throw error;
      response.status(204).end();
    } catch (error) {
      console.error("Failed to revoke share link:", error.message);
      response.status(500).json({ error: "Failed to revoke share link" });
    }
  });

  async function resolveSharedInvoice(request, response) {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" });
    const token = String(request.params.token || "");
    const invalid = () => {
      response.status(404).json({ error: "This invoice link is invalid, expired or has been revoked." });
      return null;
    };
    if (!SHARE_TOKEN_PATTERN.test(token)) return invalid();

    const { data: link, error } = await supabaseAdmin
      .from("invoice_share_links")
      .select("id, invoice_id, expires_at, revoked_at, access_count")
      .eq("token_hash", hashShareToken(token))
      .maybeSingle();
    if (error) {
      console.error("Share link lookup failed:", error.message);
      response.status(500).json({ error: "Failed to load invoice" });
      return null;
    }
    // Unknown, revoked and expired links all produce the same response.
    if (shareLinkState(link) !== "active") return invalid();

    const { data: invoiceRow } = await supabaseAdmin
      .from("invoices")
      .select("id, order_id, invoice_number, issued_at, paid_at")
      .eq("id", link.invoice_id)
      .maybeSingle();
    if (!invoiceRow) return invalid();
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(CUSTOMER_ORDER_COLUMNS)
      .eq("id", invoiceRow.order_id)
      .maybeSingle();
    if (!order) return invalid();

    await supabaseAdmin
      .from("invoice_share_links")
      .update({ last_accessed_at: new Date().toISOString(), access_count: (link.access_count || 0) + 1 })
      .eq("id", link.id);

    return redactInvoiceForShare(computeInvoice(order, invoiceRow));
  }

  app.get("/api/invoices/shared/:token", ensureSupabase, async (request, response) => {
    try {
      const invoice = await resolveSharedInvoice(request, response);
      if (invoice) response.json({ invoice });
    } catch (error) {
      console.error("Failed to load shared invoice:", error.message);
      if (!response.headersSent) response.status(500).json({ error: "Failed to load invoice" });
    }
  });

  app.get("/api/invoices/shared/:token/pdf", ensureSupabase, async (request, response) => {
    try {
      const invoice = await resolveSharedInvoice(request, response);
      if (invoice) sendPdf(response, invoice, await renderInvoicePdf(invoice));
    } catch (error) {
      console.error("Failed to render shared invoice PDF:", error.message);
      if (!response.headersSent) response.status(500).json({ error: "Failed to generate invoice PDF" });
    }
  });

  // --- Notifications (rows are created by database triggers; unique per order + event) ---

  app.get("/api/notifications", ensureSupabase, requireAuth, async (request, response) => {
    noStore(response);
    const { data, error } = await supabaseAdmin
      .from("order_notifications")
      .select("id, order_id, kind, message, created_at")
      .eq("user_id", request.user.id)
      .is("read_at", null)
      .order("created_at", { ascending: true })
      .limit(20);
    if (error) return response.status(500).json({ error: "Failed to load notifications" });
    response.json({ notifications: data || [] });
  });

  app.post("/api/notifications/read", ensureSupabase, requireAuth, async (request, response) => {
    const ids = Array.isArray(request.body?.ids) ? request.body.ids.map(Number) : [];
    if (!ids.length || ids.length > 50 || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
      return response.status(400).json({ error: "A list of notification ids is required" });
    }
    const { error } = await supabaseAdmin
      .from("order_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", request.user.id)
      .is("read_at", null)
      .in("id", ids);
    if (error) return response.status(500).json({ error: "Failed to update notifications" });
    response.status(204).end();
  });

  // --- Admin ---

  app.get("/api/admin/orders/:id/history", ensureSupabase, requireAdmin, async (request, response) => {
    const orderId = parseOrderId(request.params.id);
    if (!orderId) return response.status(400).json({ error: "Invalid order id" });
    try {
      const history = await loadHistory([orderId]);
      response.json({ history: history.get(orderId) || [] });
    } catch (error) {
      response.status(500).json({ error: "Failed to load order history" });
    }
  });

  app.patch("/api/admin/orders/:id", ensureSupabase, requireAdmin, async (request, response) => {
    const orderId = parseOrderId(request.params.id);
    if (!orderId) return response.status(400).json({ error: "Invalid order id" });
    const parsed = parseAdminOrderUpdate(request.body || {});
    if (parsed.error) return response.status(400).json({ error: parsed.error });
    const { update } = parsed;

    const { data: order, error } = await supabaseAdmin.rpc("admin_update_order", {
      p_order_id: orderId,
      p_actor: request.user.id,
      p_status: update.status,
      p_note: update.note,
      p_estimated_delivery: update.estimatedDelivery,
      p_clear_estimate: update.clearEstimate,
      p_payment_status: update.paymentStatus,
    });
    if (error) {
      const message = String(error.message || "");
      if (error.code === "P0002" || message.includes("Order not found")) return response.status(404).json({ error: "Order not found" });
      if (error.code === "42501") return response.status(403).json({ error: "Admin access required." });
      const known = KNOWN_ADMIN_ERRORS.find((prefix) => message.startsWith(prefix));
      if (known) {
        return response.status(known === "Invalid order status transition" ? 409 : 400).json({ error: message });
      }
      console.error("Failed to update order:", message);
      return response.status(500).json({ error: "Failed to update order" });
    }
    response.json({ success: true, order });
  });
}

module.exports = { registerOrderRoutes, CUSTOMER_ORDER_COLUMNS };
