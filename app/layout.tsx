import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import "./enterprise.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "https://verdatrace.invalid";
  const title = "VerdaTrace — Every ecological obligation, traceable.";
  const description =
    "AI-native environmental obligation intelligence with clause-level citations, amendment resolution, spatial evidence gaps, and human approval.";

  return {
    title,
    description,
    icons: {
      icon: "/brand/verdatrace/mark-transparent.png",
      shortcut: "/brand/verdatrace/mark-transparent.png",
      apple: "/brand/verdatrace/mark-transparent.png",
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "VerdaTrace spatial workbench and ecological obligation evidence graph.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
