/*
===========================
FILE: /app/layout.tsx
===========================
*/

import { AppStateProvider } from "./components/state/AppState";
import { VoiceMount } from "./components/voice/VoiceMount";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GLIP Safety Intelligence",
  description: "Track incidents, surface recurring hazards, and generate plain-language safety insights for construction teams.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-zinc-950 text-zinc-50 antialiased">
         <AppStateProvider>
          {children}
          {/* ✅ now VoiceFloatingAssistant can use useAppState safely */}
          <VoiceMount />
        </AppStateProvider>
      </body>
    </html>
  );
}
