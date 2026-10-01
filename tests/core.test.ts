import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { captureSchema } from "../lib/validation";
import { covers } from "../lib/covers";
import { couponCode, validHmac } from "../lib/security";
import { creditDecision, type OrderSnapshot } from "../lib/shopify";
const ballot = {
  name: "Aanya",
  email: "aanya@example.com",
  phone: "",
  consent: true,
  website: "",
  votes: covers.map((c) => ({ coverId: c.id, liked: true })),
};
test("complete ballot required; duplicates and honeypot rejected", () => {
  assert.equal(captureSchema.safeParse(ballot).success, true);
  assert.equal(
    captureSchema.safeParse({ ...ballot, votes: ballot.votes.slice(1) })
      .success,
    false,
  );
  assert.equal(
    captureSchema.safeParse({
      ...ballot,
      votes: Array(12).fill(ballot.votes[0]),
    }).success,
    false,
  );
  assert.equal(
    captureSchema.safeParse({ ...ballot, website: "spam" }).success,
    false,
  );
});
test("contact and consent validation", () => {
  assert.equal(
    captureSchema.safeParse({ ...ballot, email: "", phone: "+91 98765 43210" })
      .success,
    true,
  );
  for (const change of [
    { email: "", phone: "" },
    { email: "bad" },
    { consent: false },
    { phone: "123" },
  ])
    assert.equal(
      captureSchema.safeParse({ ...ballot, ...change }).success,
      false,
    );
});
test("coupon is personalized and unpredictable", () => {
  assert.match(couponCode("Aanya"), /^AANYA-[A-F0-9]{10}$/);
  assert.notEqual(couponCode("Aanya"), couponCode("Aanya"));
  assert.match(couponCode("नमस्ते"), /^JUNE-/);
});
test("HMAC verifies original bytes and rejects malformed input", () => {
  const raw = '{"id":1}';
  const mac = createHmac("sha256", "secret").update(raw).digest("base64");
  assert.equal(validHmac(raw, mac, "secret"), true);
  assert.equal(validHmac(raw + " ", mac, "secret"), false);
  assert.equal(validHmac(raw, "bad", "secret"), false);
});
const order: OrderSnapshot = {
  id: "1",
  paid: true,
  cancelled: false,
  refunded: false,
  cod: false,
  delivered: true,
  riskApproved: true,
  identityVerified: true,
  eligibleSubtotalPaise: 100000,
  currency: "INR",
  returnWindowElapsed: true,
};
test("credit gate holds COD until paid and delivered; blocks fraud and early credits", () => {
  assert.equal(creditDecision(order), "eligible");
  for (const change of [
    { paid: false, cod: true },
    { delivered: false, cod: true },
    { riskApproved: false },
    { identityVerified: false },
    { returnWindowElapsed: false },
  ])
    assert.equal(creditDecision({ ...order, ...change }), "hold");
  assert.equal(creditDecision({ ...order, cancelled: true }), "reverse");
  assert.equal(creditDecision({ ...order, refunded: true }), "reverse");
  assert.equal(creditDecision({ ...order, currency: "USD" }), "ineligible");
});
