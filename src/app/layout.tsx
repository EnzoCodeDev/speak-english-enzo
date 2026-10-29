import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Speak English Enzo — 150 frases para hablar en VRChat",
  description:
    "Practica en voz alta las 150 frases más usadas para conversar en VRChat. Reconocimiento de voz real: no avanzas hasta pronunciarla bien.",
  applicationName: "Speak English Enzo",
};

export const viewport: Viewport = {
  themeColor: "#0f0e1a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable} ${bricolage.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
