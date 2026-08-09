import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pintando Coyoacán",
  description:
    "Registro de casas a pintar en Coyoacán: fotos, comprobante, geolocalización y mapa por colonias.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${body.variable} ${display.variable} h-full`}>
      <body className="min-h-dvh font-[family-name:var(--font-body)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
