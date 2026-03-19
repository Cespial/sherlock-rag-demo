import type { Metadata, Viewport } from "next";
import { Outfit, Instrument_Serif, Geist_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
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
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "Sherlock — RAG Architecture Comparison",
  description:
    "Comparación side-by-side de Pinecone vs pgvector para búsqueda legal Fintech colombiana. 222 documentos, 8 verticales.",
  authors: [{ name: "tensor.lat" }],
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Sherlock — RAG Architecture Comparison",
    description:
      "Multi-embedding, reranking, agentic RAG. 222 docs, 8 Fintech verticals.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${outfit.variable} ${instrumentSerif.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
