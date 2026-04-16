"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function SignInForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (res?.error) {
        setError("אימייל או סיסמה שגויים");
      } else if (res?.url) {
        window.location.href = res.url;
      }
    } catch {
      setError("אירעה שגיאה לא צפויה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #0f2942, #1a3a5b)" }}
        >
          <span className="text-white font-bold text-2xl">בצ</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">בצילא הקודש</h1>
        <p className="text-[var(--color-muted-foreground)] mt-2">
          כניסה למערכת הניהול
        </p>
      </div>

      <div className="bg-white rounded-2xl p-8 card-shadow">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]"
            >
              אימייל
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
              dir="ltr"
              className="w-full h-11 rounded-lg border border-[var(--color-border)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]"
            >
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full h-11 rounded-lg border border-[var(--color-border)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg font-semibold text-sm text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #0f2942, #1a3a5b)" }}
          >
            {loading ? "מתחבר..." : "כניסה"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{
        background:
          "linear-gradient(135deg, #f7f5f0 0%, #eceae4 50%, #f7f5f0 100%)",
      }}
    >
      <Suspense fallback={<div>טוען...</div>}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
