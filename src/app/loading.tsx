import { PageLoader } from "@/components/ui/loader";

/** Shown while any page loads (Next.js streams this, then swaps in the page). */
export default function Loading() {
  return <PageLoader />;
}
