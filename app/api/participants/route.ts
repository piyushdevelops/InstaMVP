import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { captureSchema } from "@/lib/validation";
import { json, guard, readBody, fail } from "@/lib/http";
import { hash, contactHash, couponCode, referralCode } from "@/lib/security";
import { register, getDashboard, validRef } from "@/lib/repository";
import type { Attribution } from "@/lib/types";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    await guard(req);
    const session = req.cookies.get("june_session")?.value;
    if (!session)
      return json({ error: "Please enable cookies and try again." }, 400);
    const parsed = captureSchema.safeParse(await readBody(req));
    if (!parsed.success)
      return json({ error: parsed.error.issues[0].message }, 400);
    const existing = await getDashboard(hash(session));
    if (existing) return json({ dashboard: existing });
    const data = parsed.data;
    const email = data.email.trim().toLowerCase();
    const phone = data.phone.replace(/[\s()-]/g, "");
    let attribution: Attribution = { utm: {}, capturedAt: Date.now() };
    try {
      attribution = JSON.parse(req.cookies.get("june_attr")?.value || "{}");
    } catch {}
    if (
      !attribution.capturedAt ||
      attribution.capturedAt < Date.now() - 30 * 86400000
    )
      attribution = { utm: {}, capturedAt: Date.now() };
    if (attribution.ref && !(await validRef(attribution.ref)))
      delete attribution.ref;
    await register(
      {
        id: randomUUID(),
        name: data.name,
        contactHash: contactHash(email || phone),
        sessionHash: hash(session),
        referralCode: referralCode(),
        coupon: couponCode(data.name),
        createdAt: new Date().toISOString(),
        votes: data.votes,
        attribution,
        joined: false,
      },
      email,
      phone,
    );
    return json({ dashboard: await getDashboard(hash(session)) }, 201);
  } catch (e) {
    return fail(e);
  }
}
