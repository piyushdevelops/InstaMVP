import { NextRequest, NextResponse } from "next/server";
import { hash } from "./security";
import { checkRate } from "./repository";
const buckets = new Map<string, { n: number; until: number }>();
export async function guard(req: NextRequest) {
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  if (req.headers.get("origin") !== origin) throw new Error("ORIGIN");
  const key = hash(
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
  );
  if (process.env.DATA_MODE === "supabase") {
    if (!(await checkRate(key))) throw new Error("RATE");
  } else {
    const now = Date.now();
    if (buckets.size > 10000)
      for (const [k, b] of buckets) if (b.until < now) buckets.delete(k);
    const b = buckets.get(key);
    if (!b || b.until < now) buckets.set(key, { n: 1, until: now + 60000 });
    else if (++b.n > 60) throw new Error("RATE");
  }
}
export async function readBody(req: NextRequest) {
  const text = await req.text();
  if (text.length > 20000) throw new Error("BODY");
  return JSON.parse(text);
}
export const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
export function fail(e: unknown) {
  const message = e instanceof Error ? e.message : "";
  if (message === "ORIGIN")
    return json({ error: "This request could not be verified." }, 403);
  if (message === "RATE")
    return json(
      { error: "A few too many requests. Try again in a minute." },
      429,
    );
  if (message === "CONTACT_EXISTS")
    return json(
      {
        error:
          "This contact already has a reward. Open the original browser to access it.",
      },
      409,
    );
  if (message === "BODY" || e instanceof SyntaxError)
    return json({ error: "Invalid request." }, 400);
  console.error(
    "Campaign request failed:",
    e instanceof Error ? e.name : "Unknown",
  );
  return json({ error: "We couldn’t save that yet. Please try again." }, 503);
}
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
