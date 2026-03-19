import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#030712",
};

export const metadata: Metadata = {
  title: "Sherlock RAG Demo — Pinecone vs pgvector",
  description:
    "Comparación side-by-side de arquitecturas RAG para búsqueda legal Fintech colombiana. 252 documentos, 8 verticales.",
  authors: [{ name: "tensor.lat" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white overscroll-none`}
      >
        {children}
      </body>
    </html>
  );
}
