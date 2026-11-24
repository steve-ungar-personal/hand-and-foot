import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hand & Foot Scores",
  description: "Score keeper and stats for Hand and Foot",
  appleWebApp: { capable: true, title: "Hand & Foot", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f6f4a" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1a14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="suit">♠</span> Hand &amp; Foot
          </Link>
          <nav>
            <Link href="/new">New</Link>
            <Link href="/history">Games</Link>
            <Link href="/stats">Stats</Link>
            <Link href="/leagues">Leagues</Link>
          </nav>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
