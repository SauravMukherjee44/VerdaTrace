"use client";

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useState } from "react";

type FormState = {
  name: string;
  workEmail: string;
  organization: string;
  role: string;
  inquiryType: "pilot" | "research" | "regulator" | "investment" | "other";
  message: string;
  website: string;
};

const initialForm: FormState = {
  name: "",
  workEmail: "",
  organization: "",
  role: "",
  inquiryType: "pilot",
  message: "",
  website: "",
};

export function ContactForm() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to send inquiry.");
      setReference(result.reference ?? "Received");
      setForm(initialForm);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to send inquiry.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <div className="cc-contact-success">
        <CheckCircle2 size={32} />
        <span className="cc-overline">Inquiry received</span>
        <h2>Thank you. Your context is now in the review queue.</h2>
        <p>
          Reference <strong>{reference}</strong>. Keep this code if you want to
          refer to the inquiry later.
        </p>
        <button onClick={() => setReference("")}>
          Send another inquiry <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <form className="cc-contact-form" onSubmit={submit}>
      <div className="cc-form-row">
        <label>
          Full name
          <input
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Your name"
          />
        </label>
        <label>
          Work email
          <input
            required
            type="email"
            maxLength={160}
            autoComplete="email"
            value={form.workEmail}
            onChange={(event) => update("workEmail", event.target.value)}
            placeholder="name@organization.com"
          />
        </label>
      </div>
      <div className="cc-form-row">
        <label>
          Organization
          <input
            required
            minLength={2}
            maxLength={160}
            autoComplete="organization"
            value={form.organization}
            onChange={(event) => update("organization", event.target.value)}
            placeholder="Organization name"
          />
        </label>
        <label>
          Role
          <input
            required
            minLength={2}
            maxLength={120}
            autoComplete="organization-title"
            value={form.role}
            onChange={(event) => update("role", event.target.value)}
            placeholder="Your role"
          />
        </label>
      </div>
      <label>
        What would you like to discuss?
        <select
          value={form.inquiryType}
          onChange={(event) => update("inquiryType", event.target.value)}
        >
          <option value="pilot">Partner-reviewed pilot</option>
          <option value="research">Research or data collaboration</option>
          <option value="regulator">Government or regulator workflow</option>
          <option value="investment">Accelerator or investment</option>
          <option value="other">Other inquiry</option>
        </select>
      </label>
      <label>
        Project context
        <textarea
          required
          minLength={20}
          maxLength={2000}
          rows={7}
          value={form.message}
          onChange={(event) => update("message", event.target.value)}
          placeholder="Tell us about the workflow, evidence sources, project scale, and the review bottleneck you want to address."
        />
        <small>{form.message.length}/2000 characters</small>
      </label>
      <label className="cc-honeypot" aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => update("website", event.target.value)}
        />
      </label>
      {error && (
        <div className="cc-form-error">
          <CircleAlert size={15} /> {error}
        </div>
      )}
      <button className="cc-contact-submit" disabled={submitting}>
        {submitting ? "Sending securely…" : "Submit inquiry"}
        {!submitting && <ArrowRight size={16} />}
      </button>
      <div className="cc-contact-privacy">
        <ShieldCheck size={14} />
        Your details are stored securely for partnership follow-up. This public
        form is limited to two submissions per hour.
      </div>
    </form>
  );
}

