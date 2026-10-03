import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MotionProvider from "@/components/layout/MotionProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Play the piano with your computer keyboard, mouse or touch screen. Built with Next.js and the Web Audio API.";

export const metadata: Metadata = {
  title: "Keyboard Piano",
  description,
  // Shown when the link is shared (LinkedIn, Slack, X, …)
  openGraph: {
    title: "Keyboard Piano",
    description,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b14",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
