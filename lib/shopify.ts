export type OrderSnapshot = {
  id: string;
  paid: boolean;
  cancelled: boolean;
  refunded: boolean;
  cod: boolean;
  delivered: boolean;
  riskApproved: boolean;
  identityVerified: boolean;
  eligibleSubtotalPaise: number;
  currency: string;
  returnWindowElapsed: boolean;
};
// Worker must fetch the canonical current order; never settle from an isolated webhook.
export function creditDecision(order: OrderSnapshot) {
  if (order.cancelled || order.refunded) return "reverse";
  if (order.currency !== "INR" || order.eligibleSubtotalPaise <= 0)
    return "ineligible";
  if (
    !order.paid ||
    !order.delivered ||
    !order.riskApproved ||
    !order.identityVerified ||
    !order.returnWindowElapsed
  )
    return "hold";
  return "eligible";
}
export interface CommerceAdapter {
  provisionCoupon(input: {
    code: string;
    amountPaise: 50000;
    usageLimit: 1;
    participantId: string;
  }): Promise<{ discountId: string }>;
  fetchOrder(id: string): Promise<OrderSnapshot>;
}
export const commerce: CommerceAdapter = {
  async provisionCoupon() {
    throw new Error(
      "Configure Shopify discount provisioning, verified customer binding, eligibility, expiry and usageLimit=1 before activation.",
    );
  },
  async fetchOrder() {
    throw new Error(
      "Implement canonical Shopify order retrieval and trusted delivery/return-window verification before settlement.",
    );
  },
};
