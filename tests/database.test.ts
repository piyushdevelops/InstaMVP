import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { covers } from "../lib/covers";
test("migration: atomic signup, attribution, privacy, rate limits and irreversible credit reversal", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    await db.exec(
      await readFile("supabase/migrations/202610010001_campaign.sql", "utf8"),
    );
    const make = (
      id: string,
      session: string,
      ref: string,
      attribution = {},
    ) => ({
      id,
      name: "Test",
      email: `${session}@example.com`,
      phone: "",
      contactHash: session,
      sessionHash: session,
      referralCode: ref,
      coupon: `TEST-${session}`,
      attribution,
      votes: covers.map((c) => ({ coverId: c.id, liked: true })),
    });
    const a = "00000000-0000-4000-8000-000000000001",
      b = "00000000-0000-4000-8000-000000000002";
    await db.query("select register_participant($1::jsonb)", [
      JSON.stringify(make(a, "session-a", "referrer-a")),
    ]);
    await db.query("update participants set joined=true where id=$1", [a]);
    await db.query("select record_referral_click($1,$2)", [
      "referrer-a",
      "session-b",
    ]);
    await db.query("select record_referral_click($1,$2)", [
      "referrer-a",
      "session-b",
    ]);
    await db.query("select register_participant($1::jsonb)", [
      JSON.stringify(make(b, "session-b", "referrer-b", { ref: "referrer-a" })),
    ]);
    const dashboard = await db.query<{
      d: { stats: { clicks: number; completions: number } };
    }>("select participant_dashboard($1) d", ["session-a"]);
    assert.equal(dashboard.rows[0].d.stats.clicks, 1);
    assert.equal(dashboard.rows[0].d.stats.completions, 1);
    const p = await db.query<{ n: number }>(
      "select count(*)::int n from votes",
    );
    assert.equal(p.rows[0].n, 24);
    await assert.rejects(
      db.query("select register_participant($1::jsonb)", [
        JSON.stringify({
          ...make("00000000-0000-4000-8000-000000000003", "session-c", "ref-c"),
          email: "session-a@example.com",
        }),
      ]),
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from participants",
        )
      ).rows[0].n,
      2,
    );
    await db.query(
      "insert into orders(id,participant_id,shop_domain,currency,eligible_subtotal_paise,is_cod) values('o1',$1,'test.myshopify.com','INR',100000,true)",
      [b],
    );
    const settle = async () =>
      (
        await db.query<{ s: string }>(
          "select settle_order_credit('o1',10000) s",
        )
      ).rows[0].s;
    assert.equal(await settle(), "hold");
    await db.exec(
      "update orders set paid_at=now(), delivered_at=now(),identity_verified=true,risk_approved=true,return_window_ends_at=now()-interval '1 day'",
    );
    assert.equal(await settle(), "approved");
    assert.equal(await settle(), "approved");
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from referral_credits",
        )
      ).rows[0].n,
      1,
    );
    await db.exec("update orders set refunded_at=now()");
    assert.equal(await settle(), "reversed");
    await db.exec("update orders set refunded_at=null");
    assert.equal(await settle(), "reversed");
    for (let i = 0; i < 61; i++) {
      const result = await db.query<{ ok: boolean }>(
        "select consume_rate_limit('ip') ok",
      );
      assert.equal(result.rows[0].ok, i < 60);
    }
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from participants"));
    await assert.rejects(db.query("select participant_dashboard('session-a')"));
  } finally {
    await db.close();
  }
});
