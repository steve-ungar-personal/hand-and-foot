"use client";
import { useState } from "react";
import { syncPending } from "@/lib/client";

/** Where to go after signing in. Only pages on this site are allowed. */
function destination() {
  const next = new URLSearchParams(location.search).get("next") || "/";
  const url = new URL(next, location.origin);
  return url.origin === location.origin ? url.href : "/";
}

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) {
        setError((await r.json().catch(() => null))?.error || "Couldn't sign in.");
        setBusy(false);
        return;
      }
      await syncPending(); // send any scores saved while signed out
      location.assign(destination());
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h2>Sign in</h2>
      {error && <div className="banner err">{error}</div>}
      <label className="field" htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        autoCapitalize="none"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        required
      />
      <button className="btn primary block" style={{ marginTop: 16 }} disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
