"use client";

import { useState, useEffect } from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import { Chatbot } from "@/components/Chatbot";
import { BottomNav } from "@/components/BottomNav";
import { usePathname } from 'next/navigation';
import { RoleProvider, useRole } from "@/context/RoleContext";
import { CallNotificationBar } from "@/components/CallNotificationBar";

const inter = Inter({ subsets: ["latin"] });

function AppContent({ children }: { children: React.ReactNode }) {
  const { role, isAuthenticated, loading, logout } = useRole();
  const pathname = usePathname();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.group("🔴 Global Error Captured");
      console.error("Message:", event.message);
      console.error("Error Object:", event.error);
      if (event.error?.stack) {
        console.error("Stack Trace:", event.error.stack);
      }
      console.groupEnd();
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (pathname === '/login') {
    return <main className="h-screen w-full">{children}</main>;
  }

  return (
    <div className="flex flex-col min-h-screen relative w-full overflow-x-hidden bg-slate-50/50">
      <CallNotificationBar />
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 pb-32">
        {children}
      </main>
      <BottomNav />
      <Chatbot />
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50`}>
        <RoleProvider>
          <AppContent>{children}</AppContent>
        </RoleProvider>
      </body>
    </html>
  );
}
