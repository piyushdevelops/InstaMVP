"use client";
import { useState } from "react";
import { CAMPAIGN } from "@/lib/covers";

export default function ResetPreview() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function reset() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      try { localStorage.removeItem(`${CAMPAIGN}:votes`); } catch {}
      location.replace("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return <main className="app-shell"><section className="capture">
    <p className="eyebrow">LOCAL PREVIEW</p>
    <h1>Another <em>go?</em></h1>
    <p>Start again with a fresh ballot and reward. This resets only this browser’s demo participant, so you can reuse your contact details.</p>
    <button className="primary" style={{ marginTop: 24 }} disabled={busy} onClick={reset}>{busy ? "Resetting…" : "Reset my preview"}</button>
    {error && <p role="alert" className="error">{error}</p>}
  </section></main>;
}
