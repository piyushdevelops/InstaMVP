# The June Shop — The 2027 Edit

A mobile-first campaign app built with Next.js 16, React 19, TypeScript and a server-only Supabase adapter. No homepage or navigation: intro → tutorial → 12 swipes → celebration → signup → ₹500 reward → Taste Maker → sharing + dashboard.

## Run locally

Requires Node.js 22 or newer and npm.

```sh
npm ci
# macOS / Linux
cp .env.example .env.local
# Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. No credentials are needed in demo mode. Use invented contact details when trying the preview.

```sh
npm test
npm run typecheck
npm run build
npm start
```

`npm start` is the production server; use HTTPS for deployed production, since production session cookies are Secure. For plain HTTP local development, use `npm run dev`.

### Browser tests

```sh
npx playwright install chromium
npm run test:e2e
```

If the browser download is unavailable, use installed Chrome: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` (PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e`). Tests exercise two independent visitors and real local API calls, referral clicks/completions, reload recovery, and cross-origin rejection. E2E tests create demo records; they do not send messages or activate discounts.

## What works

- Typographic splash, accessible tutorial, 12 configurable local cover concepts, pointer swipes, buttons, keyboard arrows, progress, positive feedback, reduced-motion support and completion animation.
- Versioned vote progress in local storage with a no-storage fallback. Form is shown only after all votes. Contact, consent, unique cover IDs and honeypot are checked on the server.
- Personalized random coupon stub generated on the server, one participant/coupon per contact in the campaign; idempotent retry for the same session. Codes are **not redeemable** until commerce provisioning exists.
- Opaque HttpOnly session cookie and hashed server-side token. Dashboard is private to the original browser; public referral codes are not authentication tokens.
- Explicit Taste Maker opt-in, unique link, WhatsApp compose link, clipboard fallback and native share with copy fallback. These actions require the visitor to send the message themselves.
- First valid referral wins for 30 days; query parameter captured into a first-party HttpOnly cookie. No PII, coupon or session credential is put into public links or local storage. Unknown and same-session self-referrals are ignored. Unique visitor/referrer clicks, transactional referral completions, first-touch UTM fields.
- Dashboard shows actual locally observed clicks and completions. Conversion/credit counts start at zero. A labelled switch displays illustrative 24/9/3/₹300 sample data without changing real records.
- Live repository adapter, SQL schema, RLS, unique constraints, atomic registration, persistent rate limiter, signed Shopify webhook receiver and durable idempotent webhook inbox.

## Demo versus live

| Area        | Demo mode                                                           | Supabase mode                                               |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| Persistence | `.data/demo.json`, serialized atomic writes within one Node process | PostgreSQL tables + transactional RPC                       |
| Contact     | HMAC of primary email/phone; raw contact not stored                 | Email/phone plus keyed hash; unique email and phone indexes |
| Rewards     | Clearly marked demo coupon                                          | Reserved coupon, activation pending                         |
| Attribution | Real local clicks/completions                                       | Real persisted clicks/completions                           |
| Revenue     | Zero real earnings; optional sample display                         | Approved ledger rows only; no settlement worker supplied    |
| Rate limits | 60 mutations/minute/IP in process                                   | Shared atomic 60 mutations/minute/IP database bucket        |

The JSON adapter is for one-process local demos. Do not use it on serverless hosts, multiple replicas, or for real customers. Credentials alone do **not** activate discounts or payouts. The live campaign still needs identity verification, approved terms, a Shopify discount adapter and a settlement worker.

## Environment variables

Copy `.env.example` to `.env.local`. Keep all secrets server-side; none uses `NEXT_PUBLIC_`.

| Variable                     | Purpose                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATA_MODE`                  | `demo` (default) or `supabase`; no silent fallback if Supabase fails                                          |
| `APP_ORIGIN`                 | Exact trusted origin, no trailing slash, e.g. `https://campaign.example.com`; used for mutation origin checks |
| `SUPABASE_URL`               | Project URL, required for Supabase mode                                                                       |
| `SUPABASE_SERVICE_ROLE_KEY`  | Server-only service key; never ship to browser                                                                |
| `CONTACT_HASH_SECRET`        | At least 32 random characters in live mode; do not rotate without migrating hashes                            |
| `SHOPIFY_WEBHOOK_SECRET`     | App client secret used for raw-body HMAC verification                                                         |
| `SHOPIFY_SHOP_DOMAIN`        | Exact permitted `your-shop.myshopify.com` domain                                                              |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Reserved for the unimplemented commerce worker adapter                                                        |
| `SHOPIFY_API_VERSION`        | Version to use when implementing the commerce adapter; default example `2026-07`                              |
| `DEMO_DATA_FILE`             | Optional local demo JSON path; defaults to `.data/demo.json`                                                  |

Generate secrets with a cryptographic random generator. Do not commit `.env.local` or demo data.

## Supabase setup and data model

1. Create a Supabase project and apply `supabase/migrations/202610010001_campaign.sql` in the SQL editor, or use `supabase db push` after linking your project. Apply once to a fresh schema.
2. Configure Supabase variables and `CONTACT_HASH_SECRET`, set `DATA_MODE=supabase`, then restart/redeploy.
3. Verify registration, reload, referral attribution and denied anonymous table/RPC access on a staging project before launch.

Tables: `participants` owns `votes` and `coupons`; `referrals` links an existing referrer to one newly registered participant; `referral_events` deduplicates clicks/completions; `orders` stores canonical commerce state; `referral_credits` has one credit record per order; `webhook_inbox` stores retryable events; `rate_limits` provides shared abuse throttling. Amounts use integer paise. Participant identity and campaign contacts are unique. RLS is enabled without public policies; all reads/writes flow through server routes using the service role. RPC functions use invoker permissions and are revoked from public/anon/authenticated roles.

The example migration fixes 12 votes for this campaign. If changing the number of covers, update its ballot guard or create a new campaign migration together with `lib/covers.ts` and the UI copy. Change `CAMPAIGN` to invalidate old local progress.

## Shopify integration scaffolding

`POST /api/webhooks/shopify` verifies the raw-body HMAC with constant-time comparison, requires the configured shop, enforces a payload bound, validates a delivery ID and stores it once before acknowledging. An unavailable database returns a retryable non-2xx response. The receiver **queues only**; it never issues spendable credit from unverified webhook data.

Subscribe to `orders/paid`, `orders/updated`, `orders/cancelled`, `refunds/create`, and `fulfillments/update`. Configure a stable HTTPS URL. Provision app scopes and protected customer-data access appropriate to the final worker. Keep acknowledgements within Shopify's delivery deadline.

Implement `CommerceAdapter` in `lib/shopify.ts` and a durable worker:

1. Claim inbox rows with row locks / `SKIP LOCKED`, a lease and retry backoff. Separate order IDs from refund/fulfillment IDs (`order_id` on those events). Fetch the **current canonical order** from Shopify; use strings for external IDs and handle API throttling. Do not trust webhook arrival order.
2. Resolve the buyer through a server-recorded, verified customer mapping or a personalized provisioned coupon tied to that buyer. Never use a client-supplied referral code as sufficient proof. Copy the participant identifier into Shopify only via a trusted integration, then validate it on receipt.
3. Provision the ₹500 discount with usage limit **one**, customer binding, eligible 2027 variants, minimum spend, expiry, combination policy and INR handling. Reconcile ambiguous API timeouts before retrying creation. Store `shopify_discount_id`; mark active only after confirmation. Coupon text generation alone does not enforce Shopify redemption.
4. Validate payment, eligible net subtotal, customer identity, self-referral/duplicate household rules, risk review and return window. `creditDecision()` is a tested policy gate. Rate is deliberately unconfigured; the UI's ₹100 is a labelled demo example.
5. COD is held until **both actual delivery and payment collection** are verified. `fulfilled` or a shipment being created is not delivery. Integrate trusted carrier delivery evidence and payment reconciliation. All orders currently require delivery in the policy gate, including prepaid orders.
6. On cancellation or any refund, reverse/hold the entire credit conservatively. Fetch current order state even for delayed events. A stale paid event must never resurrect a reversed credit. Partial refund proration needs an explicitly approved policy before implementation.
7. Settle order state and the unique order credit atomically; a cancelled/refunded state takes precedence. Use `settle_order_credit` after verified canonical state is saved. Never mark an inbox event done until its transaction commits. Run scheduled reconciliation for missed events and failed jobs, and retain an audit trail before enabling payouts.

No worker, actual Shopify discount, payout, withdrawal, email/SMS delivery or customer OTP service is activated by this MVP. The adapter intentionally throws until implemented; the receiver can safely queue signed events while that integration is completed.

References: [Shopify webhook verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying).

## Fraud, privacy and launch configuration

Implemented: unpredictable tokens, hashed contact/session identifiers, origin checks, input limits, honeypot, complete-ballot enforcement, shared live throttling, unique contacts/votes/coupons/referral assignments, same-session self-referral rejection, HMAC verification, webhook deduplication and conservative credit policy.

Hooks still to connect before giving rewards monetary value: OTP/customer identity verification, durable session recovery, CAPTCHA or device-risk assessment when suspicious, verified order-to-participant identity mapping, duplicate household/payment/address review, return reconciliation and payout audit. A phone/email supplied in the form is **not verified**. A user can create another browser/contact; this is why the commerce gate requires verified identity and risk approval. IP throttling is only one signal: configure a trusted reverse proxy that overwrites `x-forwarded-for`, or replace extraction with your host's verified client IP header. Prune expired rate-limit buckets on a schedule. Apply request size limits at the gateway too.

The session cookie is a 30-day bearer credential, stored HttpOnly/SameSite=Lax and Secure in production. No cross-device login or recovery is supplied; reopening a public link in a different browser starts a new session. Add verified recovery before a public paid campaign. Choose final privacy notice, retention period, support contact, marketing opt-in, deletion/export process and reward terms with the merchant. Do not collect live customer data while these remain placeholder policy details. Persisted inbox payloads contain customer data: restrict access and retention, encrypt backups, and avoid PII in logs.

## Instagram browser behaviour

The app uses safe-area padding, responsive viewport units, 16px input text, native form controls, pointer events, explicit button alternatives, and no popup-dependent authentication. It requires first-party cookies; blocked local storage only disables progress recovery. There are no autoplay audio/video assets. Clipboard and Web Share are feature-detected, with selectable text and copy fallback. WhatsApp uses a user-initiated link; opening another app may be restricted by Instagram. The dashboard remains accessible in the original browser session.

Browser automation covers mobile Chromium emulation, not Instagram's actual WebView. Before launch, test the deployed HTTPS link on physical iOS and Android inside Instagram: story link, interrupted/reloaded swipes, keyboard, slow network, disabled storage, long names, sharing, external WhatsApp return, and 200% text size. Test links from the final campaign origin, not an unconfigured LAN hostname.

## Replace covers and styling

Edit `lib/covers.ts` to swap IDs, names, descriptions and image URLs. Twelve small local SVG files under `public/covers` are typographic placeholders, not final planner artwork. `npx tsx scripts/generate-covers.ts` recreates them. Use optimized local WebP/AVIF images for final photography and preserve a 3:4 ratio. Keep image IDs stable once voting begins. The stylesheet uses optional Google fonts with system fallbacks; self-host the licensed fonts if external requests are undesirable.

## Deploy

For Vercel or another Node-compatible Next.js host: import this folder, choose Next.js, install with `npm ci`, build with `npm run build`, and set the server environment variables above. On a Node host run `npm start` behind HTTPS. This is **not** a static export: the API routes require a server. Use Supabase for persistent deployed storage; never deploy the JSON adapter on an ephemeral filesystem. Set `APP_ORIGIN` for each staging/production environment. Configure domains/HTTPS, run the SQL migration, and smoke-test before pointing Instagram links to it.

This delivery is a locally tested MVP and integration scaffold, not a live reward programme. Do not switch on redeemable discounts or money credits until the commerce and verification steps above are completed.
