import { notFound } from "next/navigation";
import ResetPreview from "@/components/ResetPreview";

export default function ResetPage() {
  if (process.env.NODE_ENV !== "development" || process.env.DATA_MODE === "supabase") notFound();
  return <ResetPreview />;
}
