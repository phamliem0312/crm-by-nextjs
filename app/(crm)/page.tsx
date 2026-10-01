import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = {
  title: "EspoCRM",
};

// Trang chủ: Dashboard của người dùng (preferences.dashboardLayout).
export default function HomePage() {
  return <Dashboard />;
}
