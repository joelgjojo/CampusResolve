import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1B2A4A",
};

export const metadata: Metadata = {
  title: "CampusResolve — See it. Report it. Resolve it.",
  description:
    "Campus issue resolution platform. Report infrastructure problems, track progress, and verify resolutions.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CampusResolve",
  },
  icons: {
    icon: "/images/logo.png",
    apple: "/images/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased bg-slate-50 text-navy-900`}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              className: "!bg-white !text-navy-900 !shadow-lg !rounded-2xl !border !border-slate-200",
              duration: 3000,
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
