import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter: font phổ biến của giao diện SaaS/CRM, dễ đọc ở cỡ nhỏ, có đủ dấu tiếng Việt.
const inter = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EspoCRM",
  description: "Giao diện Next.js cho EspoCRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Footer "EspoCRM" (AGPL §7(b)) nằm trong từng layout con: components/espo-footer.tsx. */}
        {children}
      </body>
    </html>
  );
}
