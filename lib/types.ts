export type Vote = { coverId: string; liked: boolean };
export type Attribution = {
  ref?: string;
  utm: Record<string, string>;
  capturedAt: number;
};
export type Participant = {
  id: string;
  name: string;
  contactHash: string;
  referralCode: string;
  sessionHash: string;
  coupon: string;
  createdAt: string;
  votes: Vote[];
  attribution: Attribution;
  joined: boolean;
};
export type Dashboard = {
  name: string;
  coupon: string;
  couponStatus: "demo" | "pending";
  referralCode: string;
  joined: boolean;
  mode: "demo" | "supabase";
  stats: {
    clicks: number;
    completions: number;
    conversions: number;
    credits: number;
  };
  sampleStats: {
    clicks: number;
    completions: number;
    conversions: number;
    credits: number;
  } | null;
};
