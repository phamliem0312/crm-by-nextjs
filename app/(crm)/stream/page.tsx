import type { Metadata } from "next";
import { UserStreamPage } from "@/components/stream/user-stream-page";

export const metadata: Metadata = {
  title: "Stream",
};

export default function StreamPage() {
  return <UserStreamPage />;
}
