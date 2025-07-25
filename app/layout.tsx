import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { MessageCircleMore } from "lucide-react";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "WhalesTrace - Solana Indicator",
  description: "Most reliable indicator for Solana based on whales activity with W/R around 80% ",
  icons: {
    icon: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground`} suppressHydrationWarning>
        <ToastProvider>
            {children}
            <a
              href="https://t.me/web3_trace"
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-4 right-4 p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg transition-all duration-300 hover:shadow-xl z-50"
              title="Need help? Contact us on Telegram"
            >
              <MessageCircleMore size={24} />
            </a>
        </ToastProvider>
      </body>
    </html>
  );
}
