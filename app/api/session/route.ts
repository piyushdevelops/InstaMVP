import { NextRequest } from "next/server";
import { json, guard, readBody, fail, cookieOptions } from "@/lib/http";
import { hash, secretToken } from "@/lib/security";
import { getDashboard, validRef, recordClick } from "@/lib/repository";
import type { Attribution } from "@/lib/types";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const session = req.cookies.get("june_session")?.value;
    return json({
      dashboard: session ? await getDashboard(hash(session)) : null,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    await guard(req);
    const body = await readBody(req);
    let token = req.cookies.get("june_session")?.value;
    const fresh = !token;
    token = token || secretToken();
    const existing = req.cookies.get("june_attr")?.value;
    let attribution: Attribution = { utm: {}, capturedAt: Date.now() };
    try {
      if (existing) attribution = JSON.parse(existing);
    } catch {}
    const active = attribution.capturedAt > Date.now() - 30 * 86400000;
    if (!active) attribution = { utm: {}, capturedAt: Date.now() };
    if (
      !attribution.ref &&
      typeof body.ref === "string" &&
      /^[\w-]{8,24}$/.test(body.ref) &&
      (await validRef(body.ref))
    ) {
      const own = await getDashboard(hash(token));
      if (own?.referralCode !== body.ref) {
        attribution.ref = body.ref;
        await recordClick(body.ref, hash(token));
      }
    }
    if (Object.keys(attribution.utm).length === 0)
      for (const key of [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
      ])
        if (typeof body[key] === "string")
          attribution.utm[key] = body[key].slice(0, 120);
    const response = json({ ready: true });
    if (fresh) response.cookies.set("june_session", token, cookieOptions);
    response.cookies.set(
      "june_attr",
      JSON.stringify(attribution),
      cookieOptions,
    );
    return response;
  } catch (e) {
    return fail(e);
  }
}
