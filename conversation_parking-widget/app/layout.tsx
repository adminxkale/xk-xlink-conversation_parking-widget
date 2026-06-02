import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conversation Parking - Xlink",
  description: "Widget de parqueo de conversaciones para Genesys Cloud",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
