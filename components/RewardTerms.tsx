export default function RewardTerms({
  referral = false,
}: {
  referral?: boolean;
}) {
  return (
    <section
      className="reward-terms"
      aria-label={referral ? "Referral credit terms" : "Planner reward terms"}
    >
      <h2>
        {referral ? "How credits will work" : "Before you plan your purchase"}
      </h2>
      <p className="terms-status">
        Preview only · redemption and earnings are not active
      </p>
      {!referral && (
        <p className="exclusive-offer">
          Just for our cover voters: our best offer on 2027 planners through
          March 2027. Redeem during preorders only.
        </p>
      )}
      <dl>
        {referral ? (
          <>
            <div>
              <dt>Credit per order</dt>
              <dd>To be announced at launch</dd>
            </div>
            <div>
              <dt>When it qualifies</dt>
              <dd>After payment, delivery and the return window</dd>
            </div>
            <div>
              <dt>Clicks & votes</dt>
              <dd>No credits on their own</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Reward value</dt>
              <dd>₹500 toward eligible 2027 planners</dd>
            </div>
            <div>
              <dt>Minimum spend</dt>
              <dd>To be announced at launch</dd>
            </div>
            <div>
              <dt>Valid when</dt>
              <dd>During preorders only · exact dates to be announced</dd>
            </div>
            <div>
              <dt>Usage</dt>
              <dd>One reward per person · single use</dd>
            </div>
          </>
        )}
      </dl>
      <details>
        <summary>
          {referral ? "Eligibility & reversals" : "Activation & eligibility"}
        </summary>
        <p>
          {referral
            ? "Self-referrals and duplicate accounts do not qualify. Cancelled or refunded orders earn no credits; previously approved credits may be reversed. Any ₹100-per-order figures in this preview are examples, not a promised rate."
            : "This preview code cannot be redeemed yet. Redemption ends when preorders close; March 2027 describes our best-offer commitment, not the coupon expiry. Exact preorder dates, eligible planners, minimum spend and combination rules will be confirmed before activation."}
        </p>
      </details>
    </section>
  );
}
