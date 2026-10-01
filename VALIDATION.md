# Validation report

Validated locally on 1 October 2026 with Node.js 24 and installed desktop Chrome.

- `npm run build`: passed, production routes compiled, TypeScript passed, no build warnings.
- `npm test`: 6 tests passed, including the complete migration executed in PGlite (an embedded PostgreSQL engine).
- `npm run test:e2e` with `PLAYWRIGHT_CHANNEL=chrome`: 2 tests passed. A full two-visitor flow created separate participants, counted one unique referral click and one completion, and recovered the reward after reload. Partial voting resumed correctly. Cross-origin writes were rejected.
- Visual/pointer smoke check: real drag gesture advanced the deck; reward and dashboard rendered; no browser JavaScript errors; no horizontal overflow at 320px or with root text enlarged to 200% on the dashboard. Mobile and desktop screenshots inspected.
- `npm install` audit: zero reported vulnerabilities at install time.

The original browser download timed out, so browser tests used installed Chrome. A duplicate initialization discovered during referral testing was fixed and the test passed afterward.

Not externally verified: hosted Supabase configuration, production deployment, actual Instagram iOS/Android WebViews, real WhatsApp delivery, Shopify credentials/webhook subscriptions, live discount redemption, trusted carrier delivery evidence, or credit settlement. The migration was tested locally, not applied to a customer's Supabase project. Demo coupons and sample credits have no monetary value.
