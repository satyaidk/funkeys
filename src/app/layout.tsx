import type { Metadata, Viewport } from "next";
import { Instrument_Sans, DotGothic16 } from "next/font/google";
import MotionProvider from "@/components/layout/MotionProvider";
import "./globals.css";

/** UI text and the fallboard wordmark (variable: weight + width axes) */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  axes: ["wdth"],
});

/** Dot-matrix face, used only inside the LCD display */
const dotGothic = DotGothic16({
  variable: "--font-dot",
  subsets: ["latin"],
  weight: "400",
});

const description =
  "Made With Love and With Passion Of Music";

export const metadata: Metadata = {
  title: "funkeys",
  description,
  // Shown when the link is shared (LinkedIn, Slack, X, …)
  openGraph: {
    title: "funkeys",
    description,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1220",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${dotGothic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
