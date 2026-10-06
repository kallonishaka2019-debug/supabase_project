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
const monimeApiKey = String(process.env.MONIME_API_KEY || '').trim();
const monimeSecretKey = String(process.env.MONIME_SECRET_KEY || '').trim();
const monimeBaseUrl = String(process.env.MONIME_BASE_URL || '').trim().replace(/\/$/, '');
const monimeWebhookSecret = String(process.env.MONIME_WEBHOOK_SECRET || '').trim();

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
  return error || !data ? products : data;
}

console.log(`JerseyHub Server Running at http://localhost:${port}`);

app.use(cors({ origin: true, credentials: true }));
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

function getMonimeCheckoutUrl(data = {}) {
  return String(
    data?.checkoutUrl ||
    data?.checkout_url ||
    data?.url ||
    data?.redirectUrl ||
    data?.redirect_url ||
    data?.paymentUrl ||
    data?.payment_url ||
    data?.data?.checkoutUrl ||
    data?.data?.url ||
    ""
  ).trim();
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
  const { orderId, amount, email, name } = request.body || {};

  if (!monimeApiKey || !monimeSecretKey || !monimeBaseUrl) {
    return response.status(501).json({
      error: "Monime is not configured yet. Set MONIME_API_KEY, MONIME_SECRET_KEY, and MONIME_BASE_URL in the server environment.",
    });
  }

  if (!orderId || !Number.isFinite(Number(amount)) || !email || !name) {
    return response.status(400).json({ error: "orderId, amount, email and name are required for Monime checkout." });
  }

  try {
    const paymentPayload = {
      amount: Number(amount),
      currency: "SLL",
      email,
      name,
      merchantReference: String(orderId),
      callbackUrl: `${appBaseUrl}/api/payments/callback`,
      redirectUrl: `${appBaseUrl}/jersey.html?payment=success`,
    };

    const monimeResponse = await fetch(`${monimeBaseUrl}/api/payments/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${monimeApiKey}`,
        "X-API-Key": monimeApiKey,
      },
      body: JSON.stringify(paymentPayload),
    });

    const data = await monimeResponse.json().catch(() => ({}));
    if (!monimeResponse.ok) {
      return response.status(502).json({
        error: data?.message || "The Monime payment session could not be created.",
      });
    }

    const checkoutUrl = getMonimeCheckoutUrl(data);
    return response.json({
      success: true,
      provider: "monime",
      checkoutUrl,
      reference: data.reference || data.transactionId || String(orderId),
    });
  } catch (error) {
    console.error("Monime checkout failed:", error);
    return response.status(500).json({
      error: "Monime checkout failed. Check your API URL, keys, and callback configuration.",
    });
  }
});

app.post("/api/payments/callback", express.raw({ type: "application/json" }), async (request, response) => {
  const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from(JSON.stringify(request.body || {}));
  let payload = {};

  try {
    const jsonText = rawBody.toString("utf8").trim();
    if (jsonText) payload = JSON.parse(jsonText);
  } catch (error) {
    console.warn("Monime callback payload was not valid JSON:", error.message);
    payload = {};
  }

  const incomingSignature = request.headers["x-monime-signature"] || request.headers["x-signature"] || request.headers["monime-signature"];

  if (monimeWebhookSecret && incomingSignature) {
    const expectedSignature = crypto.createHmac("sha256", monimeWebhookSecret).update(rawBody).digest("hex");
    const normalizedSignature = String(incomingSignature).trim();
    const valid = normalizedSignature === expectedSignature || normalizedSignature === `sha256=${expectedSignature}`;

    if (!valid) {
      console.warn("Monime webhook signature mismatch. Expected a SHA-256 HMAC using MONIME_WEBHOOK_SECRET.");
      return response.status(401).json({ success: false, error: "Invalid signature" });
    }
  }

  const paymentStatus = String(
    payload?.status ||
    payload?.state ||
    payload?.paymentStatus ||
    payload?.transactionStatus ||
    payload?.data?.status ||
    payload?.data?.state ||
    payload?.data?.paymentStatus ||
    ""
  ).toLowerCase();

  const merchantReference = String(
    payload?.merchantReference ||
    payload?.merchant_reference ||
    payload?.reference ||
    payload?.transactionReference ||
    payload?.data?.reference ||
    payload?.data?.merchantReference ||
    payload?.data?.merchant_reference ||
    ""
  ).trim();

  if (merchantReference && /^\d+$/.test(merchantReference) && supabaseAdmin) {
    const nextStatus = /success|paid|completed|settled/.test(paymentStatus) ? "confirmed" : "pending";
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", Number(merchantReference));

    if (error) {
      console.warn("Failed to update order payment status:", error.message);
    }
  }

  console.log("Monime callback received:", payload);
  response.status(200).json({ success: true, received: true });
});

app.post("/api/orders", ensureSupabase, async (request, response) => {
  const { items, deliveryMethod, paymentMethod, paymentPlan, deliveryAddress = "", address = "", note = "" } = request.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return response.status(400).json({ error: "At least one item is required" });
  }

  const normalizedItems = items.map((item) => ({
    productId: item.productId ?? item.product_id,
    club: String(item.club || ""),
    kit: String(item.kit || ""),
    size: String(item.size || ""),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice ?? item.unit_price),
    custom: Boolean(item.custom),
    customName: item.customName || item.custom_name || null,
    customNumber: item.customNumber || item.custom_number || null,
  }));
  const invalidItem = normalizedItems.some(
    (item) => !["M", "L", "XL", "XXL"].includes(item.size) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 ||
      !Number.isFinite(item.unitPrice) || item.unitPrice < 0,
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
      payment_method: String(paymentMethod || "monime"),
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
