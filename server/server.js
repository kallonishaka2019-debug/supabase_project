const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { createClient } = require("@supabase/supabase-js");
const { registerAuthRoutes } = require("./auth");
const fs = require("fs");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);
const appBaseUrl = String(process.env.APP_BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const monimeAccessToken = String(process.env.MONIME_ACCESS_TOKEN || '').trim();
const monimeSpaceId = String(process.env.MONIME_SPACE_ID || '').trim();
const monimeBaseUrl = "https://api.monime.io";
const monimeVersion = "caph.2025-08-23";
const customJerseyPrice = 400;

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// User auth uses a publishable key; privileged database and admin operations stay server-side.
const supabaseAuth = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
// The secret key bypasses RLS and must never be exposed to the browser.
const supabaseAdmin = supabaseUrl && supabaseSecretKey
  ? createClient(supabaseUrl, supabaseSecretKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

if (!supabaseAuth || !supabaseAdmin) {
  console.warn("Supabase is not fully configured. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in the server environment.");
}

let products = [];
try {
  const productsPath = path.join(__dirname, "..", "js", "data.js");
  const dataContent = fs.readFileSync(productsPath, "utf8");
  const productsMatch = dataContent.match(/(?:const|let) PRODUCTS = (\[[\s\S]*?\]);/);
  if (productsMatch) {
    products = eval(productsMatch[1]);
  }
} catch (err) {
  console.warn("Could not load products from data.js:", err.message);
}

function normalizeProductInput(input = {}) {
  const club = String(input.club || "").trim();
  const kit = String(input.kit || "").trim();
  const price = Number(input.price);
  if (club.length < 2 || kit.length < 2 || !Number.isInteger(price) || price < 0) return null;

  const number = input.number === null || input.number === "" ? null : Number(input.number);
  if (number !== null && (!Number.isInteger(number) || number < 1 || number > 99)) return null;

  const sale = input.sale === null || input.sale === "" ? null : Number(input.sale);
  if (sale !== null && (!Number.isInteger(sale) || sale < 0)) return null;

  return {
    club,
    kit,
    number,
    price,
    sale,
    color: String(input.color || "#111111"),
    stripe: String(input.stripe || "#FFFFFF"),
    text_color: input.textColor ? String(input.textColor) : null,
    image: input.image ? String(input.image) : null,
    back_image: input.backImage ? String(input.backImage) : null,
    available: input.available !== false,
  };
}

let productSeedPromise = Promise.resolve();

async function seedProductsIfEmpty() {
  if (!supabaseAdmin || !products.length) return;
  const { data, error } = await supabaseAdmin.from("products").select("id").limit(1);
  if (error || data?.length) return;

  const { error: insertError } = await supabaseAdmin.from("products").insert(
    products.map((product) => normalizeProductInput(product)),
  );
  if (insertError) console.warn("Could not seed products table:", insertError.message);
}

async function readCatalogProducts() {
  await productSeedPromise;
  if (!supabaseAdmin) return products;
  const { data, error } = await supabaseAdmin.from("products").select("*").order("id");
  return error || !data ? products : data.map(useWebpImages);
}

// Catalog rows saved before the WebP conversion still point at .png files that no longer exist.
function useWebpImages(product) {
  const toWebp = (value) => (typeof value === "string" ? value.replace(/^(customJersey\/.+)\.png$/, "$1.webp") : value);
  return { ...product, image: toWebp(product.image), back_image: toWebp(product.back_image) };
}

console.log(`JerseyHub Server Running at http://localhost:${port}`);

app.use(cors({ origin: true, credentials: true }));

// Monime signs the exact raw body, so this route must be registered before express.json().
app.post("/api/webhooks/monime", express.raw({ type: "*/*", limit: "100kb" }), async (request, response) => {
  const secret = String(process.env.MONIME_WEBHOOK_SECRET || "").trim();
  if (!secret || !supabaseAdmin || !monimeAccessToken || !monimeSpaceId) {
    console.error("Monime webhook received but the server is not fully configured.");
    return response.status(500).json({ error: "Webhook not configured" });
  }

  const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  const header = String(request.get("monime-signature") || "");
  let timestamp = null;
  let signature = null;
  for (const part of header.split(",")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("t=")) timestamp = Number(trimmed.slice(2));
    if (trimmed.startsWith("v1=")) signature = trimmed.slice(3).trim();
  }
  if (!Number.isFinite(timestamp) || !signature) {
    return response.status(401).json({ error: "Invalid signature" });
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
    return response.status(401).json({ error: "Timestamp expired" });
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}_${rawBody.toString("utf8")}`)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return response.status(401).json({ error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return response.status(400).json({ error: "Invalid JSON" });
  }

  // Only a completed checkout changes an order; cancelled/expired sessions leave it pending so the customer can retry.
  if (event?.event?.name !== "checkout_session.completed") {
    return response.status(200).json({ received: true });
  }

  try {
    const sessionId = String(event?.object?.id || event?.data?.id || "");
    if (!sessionId) return response.status(200).json({ received: true });

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_method, monime_session_id")
      .eq("monime_session_id", sessionId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.payment_method !== "monime") {
      return response.status(200).json({ received: true });
    }

    // Never trust the payload alone: confirm the status with Monime directly.
    const session = await fetchMonimeCheckoutSession(sessionId);
    if (String(session?.reference || "") !== String(order.id)
      || String(session?.status || "").toLowerCase() !== "completed") {
      console.error("Monime webhook did not match order:", order.id);
      return response.status(200).json({ received: true });
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (updateError) throw updateError;
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error("Monime webhook processing failed:", error.message);
    return response.status(500).json({ error: "Processing failed" });
  }
});

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

const { ensureSupabase, requireAuth, requireAdmin } = registerAuthRoutes(app, {
  supabaseAuth,
  supabaseAdmin,
  supabaseUrl,
  supabasePublishableKey,
  appBaseUrl,
  nodeEnv: process.env.NODE_ENV,
});

function getMonimeResult(data = {}) {
  return data?.result || data?.data || data;
}

async function fetchMonimeCheckoutSession(sessionId) {
  const monimeResponse = await fetch(
    `${monimeBaseUrl}/v1/checkout-sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: {
        Authorization: `Bearer ${monimeAccessToken}`,
        "Monime-Space-Id": monimeSpaceId,
        "Monime-Version": monimeVersion,
      },
    },
  );
  const data = await monimeResponse.json().catch(() => ({}));
  if (!monimeResponse.ok) {
    throw new Error(data?.message || data?.error || "Monime could not verify the checkout session.");
  }
  return getMonimeResult(data);
}

app.get("/api/products", async (request, response) => {
  const catalog = await readCatalogProducts();
  response.json({ products: catalog, total: catalog.length });
});

app.post("/api/admin/products", requireAdmin, async (request, response) => {
  const product = normalizeProductInput(request.body);
  if (!product) return response.status(400).json({ error: "Invalid product details" });

  const { data, error } = await supabaseAdmin.from("products").insert(product).select("*").single();
  if (error) return response.status(500).json({ error: "Failed to create product" });
  response.status(201).json({ product: data });
});

app.patch("/api/admin/products/:id", requireAdmin, async (request, response) => {
  const product = normalizeProductInput(request.body);
  if (!product) return response.status(400).json({ error: "Invalid product details" });

  const { data, error } = await supabaseAdmin
    .from("products")
    .update(product)
    .eq("id", request.params.id)
    .select("*")
    .single();
  if (error) return response.status(404).json({ error: "Product not found" });
  response.json({ product: data });
});

app.delete("/api/admin/products/:id", requireAdmin, async (request, response) => {
  const { error } = await supabaseAdmin.from("products").delete().eq("id", request.params.id);
  if (error) return response.status(500).json({ error: "Failed to delete product" });
  response.status(204).end();
});

app.post("/api/payments/create", async (request, response) => {
  const orderId = Number(request.body?.orderId);

  if (!monimeAccessToken || !monimeSpaceId) {
    return response.status(501).json({
      error: "Monime is not configured. Add MONIME_ACCESS_TOKEN and MONIME_SPACE_ID to the server environment.",
    });
  }

  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return response.status(400).json({ error: "A valid orderId is required for Monime checkout." });
  }
  if (!supabaseAdmin) {
    return response.status(503).json({ error: "Order storage is not configured." });
  }

  try {
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_method, payment_due, monime_session_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("Failed to load order for Monime checkout:", orderError.message);
      return response.status(500).json({ error: "Could not load the order for payment." });
    }
    if (!order) return response.status(404).json({ error: "Order not found." });
    if (order.payment_method !== "monime") {
      return response.status(400).json({ error: "This order is not set up for Monime payment." });
    }
    if (order.status !== "pending") {
      return response.status(409).json({ error: "This order is no longer awaiting payment." });
    }
    if (!Number.isSafeInteger(Number(order.payment_due)) || Number(order.payment_due) <= 0) {
      return response.status(400).json({ error: "This order has no amount due for online payment." });
    }

    if (order.monime_session_id) {
      const existingSession = await fetchMonimeCheckoutSession(order.monime_session_id);
      if (String(existingSession?.reference || "") !== String(order.id)) {
        return response.status(502).json({ error: "The saved Monime session does not match this order." });
      }
      if (String(existingSession?.status || "").toLowerCase() === "completed") {
        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({ status: "confirmed" })
          .eq("id", order.id)
          .eq("status", "pending");
        if (updateError) throw updateError;
        return response.status(409).json({ error: "This order has already been paid." });
      }
      if (String(existingSession?.status || "").toLowerCase() === "pending") {
        let existingCheckoutUrl;
        try {
          existingCheckoutUrl = new URL(existingSession.redirectUrl);
        } catch {
          existingCheckoutUrl = null;
        }
        if (!existingCheckoutUrl || existingCheckoutUrl.protocol !== "https:") {
          return response.status(502).json({ error: "Monime returned an invalid checkout session." });
        }
        return response.json({
          success: true,
          provider: "monime",
          checkoutUrl: existingCheckoutUrl.toString(),
          reference: String(order.id),
        });
      }
    }

    const successUrl = new URL("/api/payments/return", appBaseUrl);
    successUrl.searchParams.set("orderId", String(order.id));
    successUrl.searchParams.set("outcome", "success");
    const cancelUrl = new URL(successUrl);
    cancelUrl.searchParams.set("outcome", "cancelled");

    const monimeResponse = await fetch(`${monimeBaseUrl}/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${monimeAccessToken}`,
        "Monime-Space-Id": monimeSpaceId,
        "Monime-Version": monimeVersion,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        name: `JerseyHub order #${order.id}`,
        description: `Payment for JerseyHub order #${order.id}`,
        reference: String(order.id),
        successUrl: successUrl.toString(),
        cancelUrl: cancelUrl.toString(),
        lineItems: [{
          type: "custom",
          name: `JerseyHub order #${order.id}`,
          price: { currency: "SLE", value: Number(order.payment_due) * 100 },
          quantity: 1,
          reference: String(order.id),
        }],
      }),
    });

    const data = await monimeResponse.json().catch(() => ({}));
    if (!monimeResponse.ok) {
      return response.status(502).json({
        error: data?.message || data?.error || "The Monime payment session could not be created.",
      });
    }

    const session = getMonimeResult(data);
    const checkoutUrl = String(session?.redirectUrl || "").trim();
    const sessionId = String(session?.id || "").trim();
    let parsedCheckoutUrl;
    try {
      parsedCheckoutUrl = new URL(checkoutUrl);
    } catch {
      parsedCheckoutUrl = null;
    }
    if (!sessionId || !parsedCheckoutUrl || parsedCheckoutUrl.protocol !== "https:") {
      console.error("Monime returned an invalid checkout session response.");
      return response.status(502).json({ error: "Monime returned an invalid checkout session." });
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ monime_session_id: sessionId })
      .eq("id", order.id)
      .eq("status", "pending");
    if (updateError) {
      console.error("Failed to save Monime session for order:", updateError.message);
      return response.status(500).json({ error: "Could not save the Monime payment session." });
    }

    return response.json({
      success: true,
      provider: "monime",
      checkoutUrl,
      reference: session.reference || String(order.id),
    });
  } catch (error) {
    console.error("Monime checkout failed:", error);
    return response.status(500).json({
      error: "Monime checkout failed. Check the Monime credentials and try again.",
    });
  }
});

app.get("/api/payments/return", async (request, response) => {
  const orderId = Number(request.query.orderId);
  const outcome = request.query.outcome === "cancelled" ? "cancelled" : "success";
  const resultUrl = new URL("/jersey.html", appBaseUrl);
  resultUrl.searchParams.set("payment", "pending");
  if (Number.isSafeInteger(orderId) && orderId > 0) {
    resultUrl.searchParams.set("orderId", String(orderId));
  }

  if (!Number.isSafeInteger(orderId) || orderId < 1 || !supabaseAdmin || !monimeAccessToken || !monimeSpaceId) {
    return response.redirect(303, resultUrl.toString());
  }

  try {
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_method, monime_session_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order || order.payment_method !== "monime" || !order.monime_session_id) {
      return response.redirect(303, resultUrl.toString());
    }
    if (order.status === "confirmed") {
      resultUrl.searchParams.set("payment", "success");
      return response.redirect(303, resultUrl.toString());
    }

    const session = await fetchMonimeCheckoutSession(order.monime_session_id);
    if (String(session?.reference || "") !== String(order.id)) {
      console.error("Monime session reference did not match order:", order.id);
      return response.redirect(303, resultUrl.toString());
    }

    if (String(session?.status || "").toLowerCase() === "completed") {
      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", order.id)
        .eq("status", "pending");
      if (updateError) throw updateError;
      resultUrl.searchParams.set("payment", "success");
    } else if (outcome === "cancelled") {
      resultUrl.searchParams.set("payment", "cancelled");
    }
  } catch (error) {
    console.error("Could not verify Monime checkout return:", error.message);
  }

  return response.redirect(303, resultUrl.toString());
});

app.post("/api/orders", ensureSupabase, async (request, response) => {
  const { items, deliveryMethod, paymentMethod, paymentPlan, deliveryAddress = "", address = "", note = "" } = request.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return response.status(400).json({ error: "At least one item is required" });
  }
  const selectedPaymentMethod = String(paymentMethod || "monime");
  if (!["monime", "cash", "orange_money", "afrimoney"].includes(selectedPaymentMethod)) {
    return response.status(400).json({ error: "Invalid payment method" });
  }

  const catalog = await readCatalogProducts();
  const normalizedItems = items.map((item) => {
    const custom = Boolean(item.custom);
    const productId = item.productId ?? item.product_id;
    const product = custom
      ? null
      : catalog.find((candidate) => String(candidate.id) === String(productId));
    return {
      productId: custom ? null : product?.id ?? productId,
      club: custom ? String(item.club || "") : String(product?.club || ""),
      kit: custom ? String(item.kit || "") : String(product?.kit || ""),
      size: String(item.size || ""),
      quantity: Number(item.quantity),
      unitPrice: custom ? customJerseyPrice : Number(product?.price),
      custom,
      customName: custom ? String(item.customName || item.custom_name || "") : null,
      customNumber: custom ? item.customNumber ?? item.custom_number ?? null : null,
    };
  });
  const invalidItem = normalizedItems.some(
    (item) => !["M", "L", "XL", "XXL"].includes(item.size) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 ||
      !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 ||
      item.club.length < 2 || item.kit.length < 2 ||
      (!item.custom && !catalog.some((product) => String(product.id) === String(item.productId))) ||
      (item.custom && item.customName.length > 12),
  );
  if (invalidItem) return response.status(400).json({ error: "Order contains invalid items" });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const selectedDelivery = String(deliveryMethod || "pickup");
  const deliveryCost = { pickup: 0, standard: 50 }[selectedDelivery];
  if (deliveryCost === undefined) {
    return response.status(400).json({ error: "Invalid delivery method" });
  }
  const total = subtotal + deliveryCost;
  const paymentRate = { full: 1, deposit: 0.5, pickup: 0 }[String(paymentPlan || "full")];
  if (paymentRate === undefined) {
    return response.status(400).json({ error: "Invalid payment plan" });
  }
  const paymentDueAmount = Math.ceil(total * paymentRate);
  const finalDeliveryAddress = deliveryAddress || address;
  if (selectedDelivery !== "pickup" && !String(finalDeliveryAddress || "").trim()) {
    return response.status(400).json({ error: "Delivery address is required" });
  }
  const customerName = String(request.body.customerName || request.user?.name || "").trim();
  const customerPhone = String(request.body.customerPhone || request.user?.phone || "").trim();

  if (!customerName || !customerPhone) {
    return response.status(400).json({ error: "Customer name and phone are required" });
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: request.user?.id ?? null,
      customer_name: customerName,
      customer_phone: customerPhone,
      total,
      delivery_method: selectedDelivery === "pickup" ? "pickup" : "delivery",
      delivery_address: String(finalDeliveryAddress || ""),
      payment_method: selectedPaymentMethod,
      payment_plan: String(paymentPlan || "full"),
      payment_due: paymentDueAmount,
      note: String(note),
      items: normalizedItems,
      status: "pending",
    })
    .select("id, total, status")
    .single();

  if (error) {
    console.warn("Failed to save order:", error.message);
    return response.status(500).json({ error: "Failed to save order" });
  }

  response.status(201).json({ order });
});

app.get("/api/orders", ensureSupabase, requireAuth, async (request, response) => {
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("user_id", request.user.id)
    .order("created_at", { ascending: false });

  if (error) return response.status(500).json({ error: "Failed to load orders" });
  response.json({ orders: orders || [] });
});

app.get("/api/admin/orders", ensureSupabase, requireAdmin, async (request, response) => {
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return response.status(500).json({ error: "Failed to load orders" });

  const userIds = [...new Set((orders || []).filter((order) => order.user_id).map((order) => order.user_id))];
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

  const merged = (orders || []).map((order) => ({
    ...order,
    user_name: order.user_id ? (profileMap.get(order.user_id)?.full_name || order.customer_name) : order.customer_name,
    user_phone: order.user_id ? (profileMap.get(order.user_id)?.phone || order.customer_phone) : order.customer_phone,
  }));

  response.json({ orders: merged });
});

app.patch("/api/admin/orders/:id", ensureSupabase, requireAdmin, async (request, response) => {
  const { status } = request.body;
  if (!["pending", "confirmed", "fulfilled", "cancelled"].includes(status)) {
    return response.status(400).json({ error: "Invalid status" });
  }
  const { error } = await supabaseAdmin.from("orders").update({ status }).eq("id", request.params.id);
  if (error) return response.status(500).json({ error: "Failed to update order" });
  response.json({ success: true });
});

app.get("/api/admin/stats", ensureSupabase, requireAdmin, async (request, response) => {
  const { count: totalOrders } = await supabaseAdmin.from("orders").select("*", { count: "exact", head: true });
  const { count: pendingOrders } = await supabaseAdmin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  const { data: revenueRows } = await supabaseAdmin.from("orders").select("total").neq("status", "cancelled");
  const totalRevenue = (revenueRows || []).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const { data: recentOrders } = await supabaseAdmin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  response.json({
    stats: {
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      totalRevenue,
      recentOrders: recentOrders || [],
    },
  });
});

app.use(express.static(path.join(__dirname, "..")));

productSeedPromise = seedProductsIfEmpty();

if (require.main === module) {
  app.listen(port, () => {
    console.log(`JerseyHub server running at http://localhost:${port}`);
  });
}

module.exports = app;

process.on("SIGINT", () => {
  process.exit(0);
});
