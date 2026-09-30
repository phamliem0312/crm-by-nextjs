import type { Metadata } from "next";
import { HomeLaunchpad } from "./home-launchpad";

export const metadata: Metadata = {
  title: "EspoCRM",
};

// Trang chủ tạm: lối tắt tới các mục trong menu. Dashboard (preferences.dashboardLayout) làm ở giai đoạn 3.
export default function HomePage() {
  return <HomeLaunchpad />;
}
