import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-zinc-500">That route doesn’t exist.</p>
      <Link className="mt-4 inline-block underline" href="/">Back to Home</Link>
    </div>
  );
}