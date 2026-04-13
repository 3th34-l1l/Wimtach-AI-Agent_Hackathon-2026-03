/*
===========================
FILE: /app/layout.tsx
===========================
*/

import type { Metadata } from "next";
import { AppStateProvider } from "./components/state/AppState";
import { VoiceMount } from "./components/voice/VoiceMount";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aether Intelligence",
  description:
    "Aviation operations intelligence for tracking aircraft, analyzing operators, mapping airports, and uncovering service opportunities using real-world data and AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-transparent text-[var(--text)] antialiased">
        <AppStateProvider>
          {children}
          <VoiceMount />
        </AppStateProvider>
      </body>
    </html>
  );
}