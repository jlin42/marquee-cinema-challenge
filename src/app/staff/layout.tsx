import type { Metadata } from "next";

// Staff pages are private: keep them out of search engines.
export const metadata: Metadata = {
  title: "Marquee Staff",
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-950">{children}</div>;
}
