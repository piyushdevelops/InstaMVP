import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Participant, Dashboard, Attribution } from "./types";
type State = {
  participants: Participant[];
  clicks: { ref: string; visitor: string }[];
  webhooks: { id: string; topic: string; payload: unknown }[];
};
const globals = globalThis as typeof globalThis & {
  juneQueue?: Promise<unknown>;
};
export function isLive() {
  return process.env.DATA_MODE === "supabase";
}
export function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Supabase configuration is incomplete");
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function transaction<T>(
  fn: (state: State) => T | Promise<T>,
): Promise<T> {
  const task = (globals.juneQueue ?? Promise.resolve()).then(async () => {
    const file = path.resolve(
      /* turbopackIgnore: true */ process.env.DEMO_DATA_FILE ||
        ".data/demo.json",
    );
    let state: State;
    try {
      state = JSON.parse(
        await fs.readFile(/* turbopackIgnore: true */ file, "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      state = { participants: [], clicks: [], webhooks: [] };
    }
    const result = await fn(state);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file + ".tmp", JSON.stringify(state));
    await fs.rename(file + ".tmp", file);
    return result;
  });
  globals.juneQueue = task.catch(() => {});
  return task;
}
export async function register(p: Participant, email: string, phone: string) {
  if (isLive()) {
    const { error } = await db().rpc("register_participant", {
      p: { ...p, email, phone },
    });
    if (error) {
      if (error.code === "23505") throw new Error("CONTACT_EXISTS");
      throw error;
    }
    return;
  }
  await transaction((s) => {
    if (s.participants.some((x) => x.sessionHash === p.sessionHash)) return;
    if (s.participants.some((x) => x.contactHash === p.contactHash))
      throw new Error("CONTACT_EXISTS");
    s.participants.push(p);
  });
}
export async function getDashboard(
  sessionHash: string,
): Promise<Dashboard | null> {
  if (isLive()) {
    const { data, error } = await db().rpc("participant_dashboard", {
      session_hash: sessionHash,
    });
    if (error) throw error;
    return data as Dashboard | null;
  }
  return transaction((s) => {
    const p = s.participants.find((x) => x.sessionHash === sessionHash);
    if (!p) return null;
    return {
      name: p.name,
      coupon: p.coupon,
      couponStatus: "demo",
      referralCode: p.referralCode,
      joined: p.joined,
      mode: "demo",
      stats: {
        clicks: s.clicks.filter((x) => x.ref === p.referralCode).length,
        completions: s.participants.filter(
          (x) => x.attribution.ref === p.referralCode && x.id !== p.id,
        ).length,
        conversions: 0,
        credits: 0,
      },
      sampleStats: { clicks: 24, completions: 9, conversions: 3, credits: 300 },
    };
  });
}
export async function join(sessionHash: string) {
  if (isLive()) {
    const { error } = await db()
      .from("participants")
      .update({ joined: true })
      .eq("session_hash", sessionHash);
    if (error) throw error;
    return;
  }
  await transaction((s) => {
    const p = s.participants.find((x) => x.sessionHash === sessionHash);
    if (p) p.joined = true;
  });
}
export async function recordClick(ref: string, visitor: string) {
  if (isLive()) {
    const { error } = await db().rpc("record_referral_click", {
      ref_code: ref,
      visitor_hash: visitor,
    });
    if (error) throw error;
    return;
  }
  await transaction((s) => {
    if (
      s.participants.some((p) => p.referralCode === ref && p.joined) &&
      !s.clicks.some((c) => c.ref === ref && c.visitor === visitor)
    )
      s.clicks.push({ ref, visitor });
  });
}
export async function validRef(ref: string) {
  if (isLive()) {
    const { data, error } = await db()
      .from("participants")
      .select("id")
      .eq("referral_code", ref)
      .eq("joined", true)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }
  return transaction((s) =>
    s.participants.some((p) => p.referralCode === ref && p.joined),
  );
}
export async function enqueueWebhook(
  id: string,
  topic: string,
  payload: unknown,
) {
  if (isLive()) {
    const { error } = await db()
      .from("webhook_inbox")
      .upsert(
        { id, topic, payload },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (error) throw error;
    return;
  }
  await transaction((s) => {
    if (!s.webhooks.some((w) => w.id === id))
      s.webhooks.push({ id, topic, payload });
  });
}
export async function checkRate(key: string) {
  if (isLive()) {
    const { data, error } = await db().rpc("consume_rate_limit", {
      bucket_key: key,
    });
    if (error) throw error;
    return data === true;
  }
  return true;
}
