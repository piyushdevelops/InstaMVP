import { NextRequest } from "next/server";
import { json, guard, fail } from "@/lib/http";
import { hash } from "@/lib/security";
import { join, getDashboard } from "@/lib/repository";
export async function POST(req: NextRequest) {
  try {
    await guard(req);
    const token = req.cookies.get("june_session")?.value;
    if (!token || !(await getDashboard(hash(token))))
      return json({ error: "Unlock your reward first." }, 401);
    await join(hash(token));
    return json({ dashboard: await getDashboard(hash(token)) });
  } catch (e) {
    return fail(e);
  }
}
