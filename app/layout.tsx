import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EspoCRM",
  description: "Giao diện Next.js cho EspoCRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Footer "EspoCRM" (AGPL §7(b)) nằm trong từng layout con: components/espo-footer.tsx. */}
        {children}
      </body>
    </html>
  );
}
