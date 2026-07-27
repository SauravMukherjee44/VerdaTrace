"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- vinext client navigation avoids a duplicate React runtime from next/link. */

import {
  ArrowRight,
  KeyRound,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type SessionState = {
  configured: boolean;
  authenticated: boolean;
  displayName: string;
  rateLimit: string;
};

const defaultSession: SessionState = {
  configured: true,
  authenticated: false,
  displayName: "Demo reviewer",
  rateLimit: "3 per hour",
};

export function SiteHeader({ demoContext = false }: { demoContext?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [session, setSession] = useState(defaultSession);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => setSession(result as SessionState))
      .catch(() => setSession(defaultSession));
  }, []);

  const publishSession = (next: SessionState) => {
    setSession(next);
    window.dispatchEvent(
      new CustomEvent("canopy-admin-change", { detail: next }),
    );
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Sign-in failed.");
      publishSession({
        configured: true,
        authenticated: true,
        displayName: result.displayName,
        rateLimit: result.rateLimit,
      });
      setPassword("");
      setAdminOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    publishSession(defaultSession);
  };

  return (
    <>
      <header className={`cc-header ${demoContext ? "cc-header-demo" : ""}`}>
        <a className="cc-brand" href="/" aria-label="VerdaTrace home">
          <span className="cc-brand-logo-frame">
            <img
              src="/brand/verdatrace/logo-primary-transparent.png"
              alt="VerdaTrace — Every ecological obligation, traceable."
            />
          </span>
        </a>

        <nav className="cc-nav" aria-label="Primary navigation">
          <a href="/#platform">Platform</a>
          <a href="/#governance">Governance</a>
          <a href="/research">Research</a>
          <a href="/contact">Contact</a>
        </nav>

        <div className="cc-header-actions">
          <div
            className={`cc-access-chip ${
              session.authenticated ? "is-admin" : ""
            }`}
            title={
              session.authenticated
                ? "Authenticated administrator"
                : "Rate-limited public demo"
            }
          >
            <span>{session.authenticated ? "AR" : "DR"}</span>
            <div>
              <strong>{session.displayName}</strong>
              <small>
                {session.authenticated
                  ? "Unlimited AI analysis"
                  : demoContext
                    ? "3 AI runs / hour"
                    : "Public demo · rate limited"}
              </small>
            </div>
            {session.authenticated && <ShieldCheck size={14} />}
          </div>

          {session.authenticated ? (
            <button className="cc-admin-button" onClick={signOut}>
              <LogOut size={14} /> Sign out
            </button>
          ) : (
            <button
              className="cc-admin-button"
              onClick={() => setAdminOpen(true)}
            >
              <KeyRound size={14} /> Admin sign in
            </button>
          )}
          {!demoContext && (
            <a className="cc-primary-link" href="/demo">
              Open demo <ArrowRight size={15} />
            </a>
          )}
          <button
            className="cc-menu"
            aria-label="Toggle site navigation"
            onClick={() => setMobileOpen((current) => !current)}
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>

        {mobileOpen && (
          <nav className="cc-mobile-nav" aria-label="Mobile navigation">
            <a href="/#platform" onClick={() => setMobileOpen(false)}>
              Platform
            </a>
            <a href="/#governance" onClick={() => setMobileOpen(false)}>
              Governance
            </a>
            <a href="/research" onClick={() => setMobileOpen(false)}>
              Research
            </a>
            <a href="/contact" onClick={() => setMobileOpen(false)}>
              Contact
            </a>
            <a href="/demo" onClick={() => setMobileOpen(false)}>
              Open public demo
            </a>
            <button
              onClick={() => {
                setMobileOpen(false);
                if (session.authenticated) void signOut();
                else setAdminOpen(true);
              }}
            >
              {session.authenticated ? "Admin sign out" : "Administrator sign in"}
            </button>
          </nav>
        )}
      </header>

      {adminOpen && (
        <div
          className="cc-modal-backdrop"
          role="presentation"
          onMouseDown={() => setAdminOpen(false)}
        >
          <section
            className="cc-auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="cc-modal-close"
              aria-label="Close administrator sign in"
              onClick={() => setAdminOpen(false)}
            >
              <X size={18} />
            </button>
            <div className="cc-auth-icon">
              <KeyRound size={20} />
            </div>
            <span className="cc-overline">Controlled access</span>
            <h2 id="admin-title">Administrator review mode</h2>
            <p>
              Authenticated administrators receive an eight-hour secure session
              and bypass the public intelligence quota. Credentials stay
              server-side.
            </p>
            <form onSubmit={signIn}>
              <label>
                Administrator ID
                <input
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter administrator ID"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                />
              </label>
              {error && <div className="cc-form-error">{error}</div>}
              {!session.configured && (
                <div className="cc-form-error">
                  Administrator access is not configured for this environment.
                </div>
              )}
              <button
                className="cc-auth-submit"
                disabled={
                  submitting || !username || !password || !session.configured
                }
              >
                {submitting ? "Verifying…" : "Enter admin workspace"}
                {!submitting && <ArrowRight size={15} />}
              </button>
            </form>
            <div className="cc-auth-footnote">
              <ShieldCheck size={14} />
              HttpOnly session · brute-force protection · no client-side secret
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="cc-footer">
      <div>
        <a className="cc-brand" href="/" aria-label="VerdaTrace home">
          <span className="cc-brand-logo-frame">
            <img
              src="/brand/verdatrace/logo-primary-transparent.png"
              alt="VerdaTrace — Every ecological obligation, traceable."
            />
          </span>
        </a>
        <p>
          Evidence coverage and review priority—not a legal compliance
          determination.
        </p>
      </div>
      <div className="cc-footer-links">
        <div>
          <strong>Platform</strong>
          <a href="/demo">Public demo</a>
          <a href="/#platform">How it works</a>
          <a href="/#governance">Governance</a>
        </div>
        <div>
          <strong>Company</strong>
          <a href="/research">Research</a>
          <a href="/contact">Contact</a>
          <a href="/contact">Request a pilot</a>
        </div>
      </div>
      <div className="cc-footer-status">
        <span>
          <i /> Public system operational
        </span>
        <small>Human review required for consequential findings</small>
      </div>
    </footer>
  );
}
