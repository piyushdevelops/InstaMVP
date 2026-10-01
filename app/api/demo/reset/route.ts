import { NextRequest } from "next/server";
import { cookieOptions, fail, guard, json } from "@/lib/http";
import { isLive, transaction } from "@/lib/repository";
import { hash } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development" || isLive()) {
    return json({ error: "Not found" }, 404);
  }
  try {
    await guard(req);
    const token = req.cookies.get("june_session")?.value;
    if (token) {
      const sessionHash = hash(token);
      await transaction((state) => {
        const participant = state.participants.find(p => p.sessionHash === sessionHash);
        state.participants = state.participants.filter(p => p.sessionHash !== sessionHash);
        state.clicks = state.clicks.filter(c => c.visitor !== sessionHash && c.ref !== participant?.referralCode);
        if (participant) for (const p of state.participants) {
          if (p.attribution.ref === participant.referralCode) delete p.attribution.ref;
        }
      });
    }
    const response = json({ reset: true });
    for (const name of ["june_session", "june_attr"]) {
      response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
    }
    return response;
  } catch (error) {
    return fail(error);
  }
}
