import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SubmitReady",
  description: "Turn a receipt into a reimbursement-ready PDF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
