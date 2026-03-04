"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <h1 className="mb-6 text-3xl font-semibold">Settings</h1>

      <div className="space-y-6 max-w-xl">

        <div className="rounded-xl bg-zinc-900 p-6">
          <h2 className="text-lg font-medium mb-3">Voice Assistant</h2>

          <label className="flex items-center justify-between">
            <span>Enable Voice Mode</span>
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={() => setVoiceEnabled(!voiceEnabled)}
            />
          </label>
        </div>

        <div className="rounded-xl bg-zinc-900 p-6">
          <h2 className="text-lg font-medium mb-3">Appearance</h2>

          <label className="flex items-center justify-between">
            <span>Dark Mode</span>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={() => setDarkMode(!darkMode)}
            />
          </label>
        </div>

        <div className="rounded-xl bg-zinc-900 p-6">
          <h2 className="text-lg font-medium mb-3">Account</h2>
          <button className="rounded-lg bg-red-600 px-4 py-2 hover:bg-red-500">
            Log Out
          </button>
        </div>

      </div>
    </main>
  );
}