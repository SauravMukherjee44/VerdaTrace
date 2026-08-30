"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- vinext client navigation avoids a duplicate React runtime from next/link. */

import {
  ArrowRight,
  ChevronDown,
  KeyRound,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

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

export function SiteHeader({
  demoContext = false,
  tone = "default",
}: {
  demoContext?: boolean;
  tone?: "default" | "cinematic" | "overlay";
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [session, setSession] = useState(defaultSession);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => setSession(result as SessionState))
      .catch(() => setSession(defaultSession));
  }, []);

  useEffect(() => {
    if (!profileOpen) return;

    const closeFromPointer = (event: PointerEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };

    document.addEventListener("pointerdown", closeFromPointer);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromPointer);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [profileOpen]);

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
      setProfileOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    publishSession(defaultSession);
    setProfileOpen(false);
  };

  return (
    <>
      <header
        className={`cc-header ${demoContext ? "cc-header-demo" : ""} ${
          tone === "cinematic" ? "cc-header-cinematic" : ""
        } ${tone === "overlay" ? "cc-header-overlay" : ""}`}
      >
        <a className="cc-brand" href="/" aria-label="VerdaTrace home">
          <span className="cc-brand-logo-frame">
            <img
              src="/brand/verdatrace/logo-primary-transparent.webp"
              width="512"
              height="243"
              fetchPriority="high"
              alt="VerdaTrace — Every ecological obligation, traceable."
            />
          </span>
        </a>

        <nav className="cc-nav" aria-label="Primary navigation">
          <a href="/#products">Products</a>
          <a href="/demo#workflow-orchestrator">Orchestrator</a>
          <a href="/#governance">Governance</a>
          <a href="/research">Research</a>
          <a href="/contact">Contact</a>
        </nav>

        <div className="cc-header-actions">
          <div className="cc-profile-menu" ref={profileMenuRef}>
            <button
              className={`cc-access-chip ${
                session.authenticated ? "is-admin" : ""
              } ${profileOpen ? "is-open" : ""}`}
              onClick={() => setProfileOpen((current) => !current)}
              aria-expanded={profileOpen}
              aria-controls="cc-profile-preview"
              aria-haspopup="dialog"
              title={
                session.authenticated
                  ? "Open administrator profile"
                  : "Open demo profile"
              }
            >
              <span className="cc-avatar-shell" aria-hidden="true">
                <span>{session.authenticated ? "AR" : "DR"}</span>
                <i />
              </span>
              <span className="cc-access-copy">
                <strong>{session.displayName}</strong>
                <small>
                  {session.authenticated
                    ? "Unlimited AI analysis"
                    : demoContext
                      ? "3 AI runs / hour"
                      : "Public demo · rate limited"}
                </small>
              </span>
              <ChevronDown
                className="cc-profile-chevron"
                size={14}
                aria-hidden="true"
              />
            </button>

            {profileOpen && (
              <section
                className="cc-profile-preview"
                id="cc-profile-preview"
                role="dialog"
                aria-label="Demo profile preview"
              >
                <header>
                  <span className="cc-profile-avatar" aria-hidden="true">
                    <span>{session.authenticated ? "AR" : "DR"}</span>
                    <i />
                  </span>
                  <div>
                    <small>
                      {session.authenticated
                        ? "Administrator profile"
                        : "Demo profile"}
                    </small>
                    <strong>{session.displayName}</strong>
                    <span>
                      {session.authenticated
                        ? "Authenticated review workspace"
                        : "Public review workspace"}
                    </span>
                  </div>
                  <span className="cc-profile-live">
                    <i /> Active
                  </span>
                </header>

                <div className="cc-profile-stats">
                  <span>
                    <small>Analysis access</small>
                    <strong>
                      {session.authenticated ? "Unlimited" : "3 runs / hour"}
                    </strong>
                  </span>
                  <span>
                    <small>Workspace mode</small>
                    <strong>
                      {session.authenticated ? "Administrator" : "Demo reviewer"}
                    </strong>
                  </span>
                </div>

                <div className="cc-profile-footnote">
                  <ShieldCheck size={15} />
                  <span>
                    {session.authenticated
                      ? "Secure eight-hour administrator session"
                      : "Demo activity is rate limited and review-only"}
                  </span>
                </div>

                <button
                  className="cc-profile-action"
                  onClick={() => {
                    if (session.authenticated) void signOut();
                    else {
                      setProfileOpen(false);
                      setAdminOpen(true);
                    }
                  }}
                >
                  {session.authenticated ? (
                    <LogOut size={14} />
                  ) : (
                    <KeyRound size={14} />
                  )}
                  {session.authenticated
                    ? "Sign out"
                    : "Administrator sign in"}
                  <ArrowRight size={14} />
                </button>
              </section>
            )}
          </div>

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
            <a href="/#products" onClick={() => setMobileOpen(false)}>
              Products
            </a>
            <a
              href="/demo#workflow-orchestrator"
              onClick={() => setMobileOpen(false)}
            >
              Workflow Orchestrator
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
      <div className="cc-footer-pilot">
        <div>
          <span>Start with one real workflow</span>
          <h2>
            Bring one project. See every obligation, evidence gap, and next
            action.
          </h2>
        </div>
        <div>
          <a className="cc-footer-pilot-primary" href="/contact">
            <span>Request a pilot</span> <ArrowRight size={15} />
          </a>
          <a className="cc-footer-pilot-secondary" href="/demo">
            <span>Explore the demo</span>
          </a>
        </div>
      </div>

      <div className="cc-footer-main">
        <div className="cc-footer-brand">
          <a className="cc-brand" href="/" aria-label="VerdaTrace home">
            <span className="cc-brand-logo-frame">
              <img
                src="/brand/verdatrace/logo-primary-transparent.webp"
                width="512"
                height="243"
                loading="lazy"
                decoding="async"
                alt="VerdaTrace — Every ecological obligation, traceable."
              />
            </span>
          </a>
          <p>
            AI-native environmental intelligence for turning approvals, maps,
            and evidence into traceable work.
          </p>
          <div className="cc-footer-indicators">
            <span>
              <i /> Public demo operational
            </span>
            <span>
              <ShieldCheck size={13} /> Human review required
            </span>
            <span>India-based · APAC-focused</span>
          </div>
        </div>

        <div className="cc-footer-links">
          <div>
            <strong>Products</strong>
            <a href="/demo">Case Intelligence</a>
            <a href="/demo#spatial-intelligence">
              Dynamic World Spatial Evidence
            </a>
            <a href="/demo#workflow-orchestrator">
              Workflow Orchestrator
            </a>
            <a href="/research#spatial">
              AlphaEarth Similarity Intelligence
            </a>
            <a href="/#platform">Agentic capabilities</a>
          </div>
          <div>
            <strong>Company</strong>
            <a href="/research">Research</a>
            <a href="/#governance">Governance</a>
            <a href="/contact">Contact</a>
            <a href="/contact">Request a pilot</a>
          </div>
          <div>
            <strong>Trust &amp; legal</strong>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/#governance">Responsible AI</a>
            <a href="/research#method">Methodology</a>
          </div>
        </div>
      </div>

      <div className="cc-footer-bottom">
        <span>© 2026 VerdaTrace</span>
        <p>
          Evidence coverage and review priority—not a legal compliance
          determination.
        </p>
      </div>
    </footer>
  );
}
