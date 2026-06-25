import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import NavProgress from "@/components/nav-progress";
import HoloPreferences from "@/components/holo-preferences";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for headings / wordmarks — gives the app a game-y identity.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SFL TCG",
  description: "SFL Trading Card Game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Passive holo animations default off (perf); HoloPreferences flips this
      // to "on" after hydration only if the user opted in. Setting it here keeps
      // them paused from first paint instead of flashing on then off.
      data-holo-passive="off"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><HoloPreferences /><NavProgress />{children}</body>
    </html>
  );
}
