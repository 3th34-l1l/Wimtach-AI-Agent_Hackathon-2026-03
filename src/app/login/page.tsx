"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/src/app/components/ui/Button";

const DEMO_USERS = [
  { username: "admin", role: "Admin", password: "test123" },
  { username: "maya", role: "Reviewer", password: "test123" },
  { username: "guest", role: "Guest", password: "test123" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const helper = useMemo(
    () => "Demo users: admin, maya, guest — password: test123",
    []
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const match = DEMO_USERS.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.password === password
    );

    if (!match) {
      setError("Invalid demo credentials.");
      return;
    }

    localStorage.setItem(
      "glip_demo_user",
      JSON.stringify({
        username: match.username,
        role: match.role,
        isAuthenticated: true,
      })
    );

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,.28)] backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#d6a84f] to-[#4f7d95] text-white shadow-[0_0_0_1px_rgba(255,255,255,.10)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#eef2f4]">GLIP Demo Login</h1>
            <p className="text-sm text-[#a9b4bc]">Construction safety review workspace</p>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
          {helper}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a9b4bc]">
              Username
            </label>
            <input
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#eef2f4] outline-none transition focus:border-amber-400/30 focus:ring-2 focus:ring-amber-400/35"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a9b4bc]">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="test123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 pr-11 text-sm text-[#eef2f4] outline-none transition focus:border-amber-400/30 focus:ring-2 focus:ring-amber-400/35"
              />
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#a9b4bc]">
                <LockKeyhole className="h-4 w-4" />
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-[#c96b5c]/20 bg-[#c96b5c]/10 px-3 py-2 text-sm text-[#f2c4bc]">
              {error}
            </div>
          ) : null}

          <Button type="submit" variant="primary" className="w-full">
            Sign In
          </Button>
        </form>

        <div className="mt-5 text-xs text-[#7f8b94]">
          Demo-only access for GLIP judging and stakeholder review.
        </div>
      </div>
    </main>
  );
}