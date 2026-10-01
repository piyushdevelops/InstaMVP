import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export const secretToken = () => randomBytes(32).toString("base64url");
export const referralCode = () => randomBytes(9).toString("base64url");
export function couponCode(name: string) {
  const prefix =
    name
      .normalize("NFKD")
      .replace(/[^a-z]/gi, "")
      .slice(0, 10)
      .toUpperCase() || "JUNE";
  return `${prefix}-${randomBytes(5).toString("hex").toUpperCase()}`;
}
export function contactHash(value: string) {
  const secret = process.env.CONTACT_HASH_SECRET;
  if (process.env.DATA_MODE === "supabase" && (!secret || secret.length < 32))
    throw new Error("CONTACT_HASH_SECRET must be at least 32 characters");
  return createHmac("sha256", secret || "local-demo-only")
    .update(value)
    .digest("hex");
}
export function validHmac(raw: string, header: string, secret: string) {
  const expected = createHmac("sha256", secret).update(raw).digest();
  const actual = Buffer.from(header, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
