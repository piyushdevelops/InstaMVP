"use client";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Heart,
  X,
  Share2,
  Gift,
  Sparkles,
  ChevronLeft,
  CheckCheck,
} from "lucide-react";
import { covers, CAMPAIGN } from "@/lib/covers";
import type { Dashboard, Vote } from "@/lib/types";
type Stage =
  | "intro"
  | "tutorial"
  | "vote"
  | "complete"
  | "capture"
  | "reward"
  | "onboard"
  | "dashboard";
const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};
async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export default function Experience() {
  const [stage, setStage] = useState<Stage>("intro"),
    [votes, setVotes] = useState<Vote[]>([]),
    [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [drag, setDrag] = useState(0),
    [leaving, setLeaving] = useState(0),
    [feedback, setFeedback] = useState("Trust your first instinct."),
    [sample, setSample] = useState(false),
    [privacy, setPrivacy] = useState(false);
  const start = useRef<number | null>(null),
    locked = useRef(false),
    initializing = useRef(false),
    heading = useRef<HTMLHeadingElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = `${CAMPAIGN}:votes`;
  const cover = covers[votes.length];
  const initialize = async () => {
    if (initializing.current) return;
    initializing.current = true;
    setError("");
    try {
      await api(
        "/api/session",
        Object.fromEntries(new URLSearchParams(location.search)),
      );
      const result = await api("/api/session");
      if (result.dashboard) {
        setDashboard(result.dashboard);
        setStage("reward");
      } else {
        try {
          const saved = JSON.parse(storage.get(key) || "[]") as Vote[];
          if (
            Array.isArray(saved) &&
            saved.length > 0 &&
            saved.length <= covers.length &&
            saved.every(
              (v, i) =>
                v.coverId === covers[i].id && typeof v.liked === "boolean",
            )
          ) {
            setVotes(saved);
            setStage(saved.length === covers.length ? "capture" : "vote");
          }
        } catch {}
      }
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      initializing.current = false;
    }
  };
  useEffect(() => {
    void initialize();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []); // one bootstrap per mount
  useEffect(() => {
    if (!ready) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    if (stage === "intro") id = setTimeout(() => setStage("tutorial"), 2600);
    if (stage === "complete") id = setTimeout(() => setStage("capture"), 2100);
    heading.current?.focus({ preventScroll: true });
    return () => clearTimeout(id);
  }, [stage, ready]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  function choose(liked: boolean) {
    if (locked.current || stage !== "vote" || !cover) return;
    locked.current = true;
    setLeaving(liked ? 1 : -1);
    setFeedback(
      liked
        ? ["Good eye.", "That’s a keeper.", "We see your vision."][
            votes.length % 3
          ]
        : [
            "Making room for your favourites.",
            "Your taste, your rules.",
            "On to the next possibility.",
          ][votes.length % 3],
    );
    if (navigator.vibrate) navigator.vibrate(12);
    timer.current = setTimeout(() => {
      const next = [...votes, { coverId: cover.id, liked }];
      setVotes(next);
      storage.set(key, JSON.stringify(next));
      setDrag(0);
      setLeaving(0);
      locked.current = false;
      if (next.length === covers.length) setStage("complete");
    }, 200);
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        stage === "vote" &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        choose(e.key === "ArrowRight");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [stage, votes]);
  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(form));
    try {
      const result = await api("/api/participants", {
        ...data,
        consent: data.consent === "on",
        votes,
      });
      setDashboard(result.dashboard);
      setStage("reward");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function join() {
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/referrals/join", {});
      setDashboard(result.dashboard);
      setStage("dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const referralUrl = () =>
    `${location.origin}/?ref=${encodeURIComponent(dashboard?.referralCode || "")}&utm_source=tastemaker&utm_medium=referral`;
  async function copy(text: string) {
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(text);
      else {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.top = "0";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        el.remove();
        if (!ok) throw new Error();
      }
      setToast("Copied. Ready to share.");
    } catch {
      setToast(
        "Copy isn’t available here. Press and hold the code or link to copy it.",
      );
    }
  }
  async function share() {
    const url = referralUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Your taste. Our next chapter.",
          text: "Help me choose The June Shop’s 2027 planner covers.",
          url,
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") await copy(url);
      }
    } else await copy(url);
  }
  function change(next: Stage) {
    setError("");
    setStage(next);
  }
  const stats =
    sample && dashboard?.sampleStats ? dashboard.sampleStats : dashboard?.stats;
  return (
    <main className={`experience stage-${stage}`}>
      <div className="ambient" aria-hidden="true">
        2027
      </div>
      <div className="app-shell">
        <header className="brand">
          <span className="wordmark">
            the june shop<span className="brand-dot">®</span>
          </span>
          <span className="edition">THE 2027 EDIT</span>
        </header>
        <div className="screen" key={stage}>
          {stage === "intro" && (
            <section className="intro">
              <p className="eyebrow">A LITTLE INSTINCT. A LOT OF YOU.</p>
              <h1 ref={heading} tabIndex={-1}>
                Good taste?
                <br />
                We had
                <br />a <em>feeling.</em>
                <span className="asterisk">✳</span>
              </h1>
              <p>
                Help us choose the covers
                <br />
                for our 2027 planners.
              </p>
              <div className="intro-bottom">
                <span>12 covers. Your call.</span>
                <button
                  className="text-button"
                  onClick={() => change("tutorial")}
                  disabled={!ready}
                >
                  Let’s do this
                </button>
              </div>
              <div
                className="intro-loading"
                aria-label="Getting your covers ready"
              >
                <span />
              </div>
            </section>
          )}
          {stage === "tutorial" && (
            <section className="tutorial">
              <p className="eyebrow">YOU’RE ON THE DESIGN TEAM</p>
              <h1 ref={heading} tabIndex={-1}>
                No overthinking.
                <br />
                Just <em>your taste.</em>
              </h1>
              <div className="tutorial-art">
                <img
                  src={covers[0].image}
                  alt="Electric dreams planner cover"
                />
                <span className="stamp yes">YES PLEASE</span>
              </div>
              <div className="directions">
                <span>
                  <X size={22} />
                  Swipe left
                  <br />
                  <small>Not my thing</small>
                </span>
                <span>
                  <Heart size={22} />
                  Swipe right
                  <br />
                  <small>Love this one</small>
                </span>
              </div>
              <button className="primary" onClick={() => change("vote")}>
                I’ve got this
              </button>
              <p className="fine">
                Or tap the buttons. There are no wrong answers.
              </p>
            </section>
          )}
          {stage === "vote" && cover && (
            <section className="voting">
              <div className="vote-title">
                <p className="eyebrow">THE COVER CASTING CALL</p>
                <span className="counter">
                  {String(votes.length + 1).padStart(2, "0")}{" "}
                  <span>/ {covers.length}</span>
                </span>
              </div>
              <h1 ref={heading} tabIndex={-1}>
                Your next <em>chapter?</em>
              </h1>
              <div
                className="progress"
                role="progressbar"
                aria-label="Covers voted"
                aria-valuemin={0}
                aria-valuemax={covers.length}
                aria-valuenow={votes.length}
              >
                {covers.map((c, i) => (
                  <span className={i < votes.length ? "done" : ""} key={c.id} />
                ))}
              </div>
              <div className="card-area">
                <div className="card-back" />
                <div
                  className="planner-card"
                  style={{
                    transform: `translateX(${leaving ? leaving * 440 : drag}px) rotate(${leaving ? leaving * 24 : drag / 18}deg)`,
                    opacity: leaving ? 0 : 1,
                  }}
                  onPointerDown={(e) => {
                    start.current = e.clientX;
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (start.current !== null)
                      setDrag(e.clientX - start.current);
                  }}
                  onPointerUp={() => {
                    if (drag > 65) choose(true);
                    else if (drag < -65) choose(false);
                    else setDrag(0);
                    start.current = null;
                  }}
                  onPointerCancel={() => {
                    start.current = null;
                    setDrag(0);
                  }}
                >
                  <img
                    src={cover.image}
                    alt={`${cover.name}, 2027 planner cover concept`}
                    draggable={false}
                  />
                  {Math.abs(drag) > 30 && (
                    <span className={`stamp ${drag > 0 ? "yes" : "no"}`}>
                      {drag > 0 ? "LOVE IT" : "PASS"}
                    </span>
                  )}
                  <span className="concept-label">
                    COVER CONCEPT {String(cover.number).padStart(2, "0")}
                  </span>
                </div>
              </div>
              <div className="cover-info">
                <h2>{cover.name}</h2>
                <p>{cover.caption}</p>
              </div>
              <div className="vote-actions">
                <button
                  aria-label="Pass on this cover"
                  className="vote-button pass"
                  onClick={() => choose(false)}
                  disabled={!!leaving}
                >
                  <X />
                  <span>Not my thing</span>
                </button>
                <span className="swipe-hint">
                  GO WITH
                  <br />
                  YOUR GUT
                </span>
                <button
                  aria-label="Love this cover"
                  className="vote-button love"
                  onClick={() => choose(true)}
                  disabled={!!leaving}
                >
                  <Heart />
                  <span>Love it</span>
                </button>
              </div>
              <p className="feedback" aria-live="polite">
                {feedback}
              </p>
            </section>
          )}
          {stage === "complete" && (
            <section className="completion">
              <div className="celebration-mark">✳</div>
              <p className="eyebrow">ALL 12. ALL YOU.</p>
              <h1 ref={heading} tabIndex={-1}>
                YOU HAVE
                <br />
                EXCELLENT
                <br />
                <em>TASTE.</em>
              </h1>
              <p>
                Your picks are shaping our next chapter.
                <br />
                Now, a little thank-you.
              </p>
              <button className="text-button" onClick={() => change("capture")}>
                See my reward
              </button>
            </section>
          )}
          {stage === "capture" && (
            <section className="capture">
              <span className="round-icon">
                <Gift />
              </span>
              <p className="eyebrow">GOOD TASTE HAS ITS PERKS</p>
              <h1 ref={heading} tabIndex={-1}>
                A little thanks.
                <br />
                <em>₹500, to be exact.</em>
              </h1>
              <p>
                Save your planner reward.
                <br />
                Who should we make it out to?
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(e.currentTarget);
                }}
              >
                <label>
                  Your first name
                  <input
                    name="name"
                    placeholder="e.g. Aanya"
                    autoComplete="given-name"
                    required
                    maxLength={60}
                  />
                </label>
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={254}
                  />
                </label>
                <label>
                  Phone <span className="optional">— if you prefer</span>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+91 98765 43210"
                    autoComplete="tel"
                    maxLength={24}
                  />
                </label>
                <p className="field-hint">
                  An email or phone number is all we need.
                </p>
                <div className="honeypot" aria-hidden="true">
                  <label>
                    Website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                <label className="consent">
                  <input type="checkbox" name="consent" required />
                  <span>
                    I agree to my details and votes being saved for this
                    campaign.{" "}
                    <button
                      type="button"
                      className="inline-link"
                      onClick={() => setPrivacy(!privacy)}
                    >
                      Privacy details
                    </button>
                  </span>
                </label>
                {privacy && (
                  <div className="notice">
                    Your details are used to save your reward and track
                    referrals. Marketing requires a separate opt-in. Demo mode
                    stores a hashed contact, not the email or phone itself. Live
                    storage and retention must be configured by The June Shop
                    before launch.
                  </div>
                )}
                <button className="primary" disabled={busy}>
                  {busy ? "Saving your good taste…" : "Unlock my ₹500"}
                </button>
                <p className="fine">
                  Preview reward. Redemption opens after the campaign launches.
                </p>
              </form>
            </section>
          )}
          {stage === "reward" && dashboard && (
            <section className="reward">
              <div className="saved-label">
                <CheckCheck size={18} /> YOUR PICKS ARE SAVED
              </div>
              <h1 ref={heading} tabIndex={-1}>
                Good eye,
                <br />
                <em>{dashboard.name}.</em>
              </h1>
              <p>
                Here’s a little something
                <br />
                for your next big plans.
              </p>
              <div className="coupon">
                <div className="coupon-top">
                  <span>THE JUNE SHOP</span>
                  <Gift size={22} />
                </div>
                <div className="amount">
                  ₹500<span>PLANNER REWARD</span>
                </div>
                <div className="coupon-divider" />
                <button
                  className="coupon-code"
                  onClick={() => copy(dashboard.coupon)}
                  aria-label="Copy coupon code"
                >
                  <span>{dashboard.coupon}</span>
                  <Copy size={19} />
                </button>
                <span className="coupon-status">
                  {dashboard.couponStatus === "demo"
                    ? "DEMO CODE · NOT REDEEMABLE"
                    : "RESERVED · ACTIVATION PENDING"}
                </span>
              </div>
              <p className="fine">
                One reward per person. Eligible 2027 planners only.
                <br />
                Final minimum spend and expiry will be announced at launch.
              </p>
              <button
                className="primary"
                onClick={() => copy(dashboard.coupon)}
              >
                Copy my reward code <Copy size={18} />
              </button>
              <div className="referral-tease">
                <Sparkles />
                <h2>
                  Your taste deserves
                  <br />a bigger audience.
                </h2>
                <p>
                  Invite your people. Earn credits when
                  <br />
                  their eligible orders are confirmed.
                </p>
                <button
                  className="secondary"
                  onClick={() =>
                    change(dashboard.joined ? "dashboard" : "onboard")
                  }
                >
                  {dashboard.joined
                    ? "My Taste Maker dashboard"
                    : "Become a Taste Maker"}
                </button>
              </div>
            </section>
          )}
          {stage === "onboard" && (
            <section className="onboard">
              <button className="back" onClick={() => change("reward")}>
                <ChevronLeft size={18} />
                My reward
              </button>
              <p className="eyebrow">THE TASTE MAKER CLUB</p>
              <h1 ref={heading} tabIndex={-1}>
                Good taste
                <br />
                is <em>contagious.</em>
              </h1>
              <p>Bring your people into the picture.</p>
              <ol className="steps">
                <li>
                  <span>01</span>
                  <div>
                    <h2>Pass the good taste on.</h2>
                    <p>Send your personal link to a friend.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <h2>They make their picks.</h2>
                    <p>They vote and unlock their own reward.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h2>Their plans. Your perks.</h2>
                    <p>
                      Earn credits after an eligible order is paid, delivered,
                      and past its return window.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="notice">
                Preview programme: sample earnings use ₹100 per qualifying
                order. Live credit rates and terms are not yet active. No
                earnings for clicks or votes alone.
              </div>
              <button className="primary" onClick={join} disabled={busy}>
                {busy ? "Creating your link…" : "Join & get my link"}
              </button>
              <p className="fine">
                By joining, you agree that self-referrals and duplicate accounts
                do not qualify. Cancelled or refunded orders earn no credits.
              </p>
            </section>
          )}
          {stage === "dashboard" && dashboard && stats && (
            <section className="dashboard">
              <button className="back" onClick={() => change("reward")}>
                <ChevronLeft size={18} />
                My reward
              </button>
              <p className="eyebrow">
                TASTE MAKER / {dashboard.name.toUpperCase()}
              </p>
              <h1 ref={heading} tabIndex={-1}>
                Your taste.
                <br />
                <em>A ripple effect.</em>
              </h1>
              <div className="credit-card">
                <span>{sample ? "SAMPLE CREDITS" : "EARNED CREDITS"}</span>
                <strong>₹{stats.credits.toLocaleString("en-IN")}</strong>
                <p>
                  {sample
                    ? "Illustrative earnings, not withdrawable."
                    : "Credits appear after eligible orders are verified."}
                </p>
              </div>
              {dashboard.mode === "demo" && (
                <label className="sample-toggle">
                  <input
                    type="checkbox"
                    checked={sample}
                    onChange={(e) => setSample(e.target.checked)}
                  />
                  Show sample order earnings
                </label>
              )}
              <div className="stats">
                {[
                  ["Link clicks", stats.clicks],
                  ["Completed", stats.completions],
                  ["Orders", stats.conversions],
                ].map(([label, value]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="fine">
                {sample
                  ? "These numbers are an example. Your actual activity is saved separately."
                  : "Unique visits · completed votes + signup · credited orders"}
              </p>
              <div className="share-card">
                <h2>A link with your name on it.</h2>
                <p>Send it to someone whose taste you trust.</p>
                <input
                  className="share-url"
                  aria-label="Your referral link"
                  readOnly
                  value={typeof window !== "undefined" ? referralUrl() : ""}
                  onFocus={(e) => e.target.select()}
                />
                <a
                  className="primary whatsapp"
                  href={`https://wa.me/?text=${encodeURIComponent(`Help choose The June Shop’s 2027 planner covers! ${typeof window !== "undefined" ? referralUrl() : ""}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Share on WhatsApp
                </a>
                <div className="share-actions">
                  <button
                    className="secondary"
                    onClick={() => copy(referralUrl())}
                  >
                    <Copy size={17} />
                    Copy link
                  </button>
                  <button className="secondary" onClick={share}>
                    <Share2 size={17} />
                    More options
                  </button>
                </div>
              </div>
              <button
                className="text-button refresh"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api("/api/session");
                    if (!r.dashboard)
                      throw new Error(
                        "Session expired. Open your original browser.",
                      );
                    setDashboard(r.dashboard);
                    setToast("Your activity is up to date.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Refresh my activity
              </button>
              <p className="fine">
                Keep this browser to access your dashboard.
                <br />
                Your public link never gives access to this page.
              </p>
            </section>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              {!ready && <button onClick={initialize}>Try again</button>}
            </div>
          )}
        </div>
        <footer>
          <span>MADE FOR YOUR NEXT CHAPTER</span>
          <span>✳</span>
          <span>THE JUNE SHOP</span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </main>
  );
}
