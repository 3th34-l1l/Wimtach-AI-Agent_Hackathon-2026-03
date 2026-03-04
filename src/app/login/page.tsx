"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    alert("Login placeholder – authentication not connected yet.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
      <div className="w-full max-w-md rounded-xl bg-zinc-900 p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-semibold">Login</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-zinc-800 p-3 outline-none"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-zinc-800 p-3 outline-none"
          />

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 p-3 font-medium hover:bg-blue-500"
          >
            Sign In
          </button>
        </form>

        <p className="mt-4 text-sm text-zinc-400">
          Demo login page placeholder.
        </p>
      </div>
    </main>
  );
}