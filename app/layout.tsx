import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "Kin's Paris Coffee Shades — Beat the locals. Catch the sun.",
  description:
    "Kin's Paris Coffee Shades shows Paris weather and sun exposure for cafés.",
  openGraph: {
    title: "Kin's Paris Coffee Shades — Beat the locals. Catch the sun.",
    description: "Kin's Paris Coffee Shades shows Paris weather and sun exposure for cafés.",
    url: "https://kinspariscoffeeshades.vercel.app",
    type: "website",
    siteName: "Kin's Paris Coffee Shades",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kin's Paris Coffee Shades — Beat the locals. Catch the sun.",
    description:
      "Paris-only, free sources. Sun exposure for cafés across the next hours.",
    creator: "@steventey",
  },
  metadataBase: new URL("https://kinspariscoffeeshades.vercel.app"),
  themeColor: "#FFF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
