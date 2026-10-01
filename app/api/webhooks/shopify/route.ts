import { NextRequest } from "next/server";
import { validHmac } from "@/lib/security";
import { enqueueWebhook } from "@/lib/repository";
import { json, fail } from "@/lib/http";
export const runtime = "nodejs";
const topics = new Set([
  "orders/paid",
  "orders/updated",
  "orders/cancelled",
  "refunds/create",
  "fulfillments/update",
]);
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    if (!secret || !shop)
      return json({ error: "Webhook not configured." }, 503);
    const raw = await req.text();
    if (raw.length > 2_000_000)
      return json({ error: "Payload too large." }, 413);
    if (
      req.headers.get("x-shopify-shop-domain") !== shop ||
      !validHmac(raw, req.headers.get("x-shopify-hmac-sha256") || "", secret)
    )
      return json({ error: "Invalid signature." }, 401);
    const topic = req.headers.get("x-shopify-topic") || "";
    if (!topics.has(topic)) return json({ ignored: true });
    const id = req.headers.get("x-shopify-webhook-id");
    if (!id || id.length > 120)
      return json({ error: "Missing delivery ID." }, 400);
    await enqueueWebhook(`${shop}:${id}`, topic, JSON.parse(raw));
    return json({ accepted: true, settlement: "pending_worker" }, 202);
  } catch (e) {
    return fail(e);
  }
}
