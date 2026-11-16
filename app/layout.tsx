import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FeedWise AI | Class feedback",
  description: "Class feedback forms and private lecturer results.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
