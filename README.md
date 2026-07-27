# VerdaTrace

Every ecological obligation, traceable.

VerdaTrace is an AI-native environmental obligation intelligence platform. It
connects approvals, amendments, maps, evidence, and expert review into a
source-cited path from ecological promise to prioritized action.

The bundled public demonstration covers proposal `FP/KA/ROAD/7440/2014` and
shows how the September 2025 amendment supersedes Conditions 2 and 3 of the May
2025 final approval without duplicating active duties.

## What works

- An enterprise landing page plus dedicated `/demo`, `/research`, and `/contact`
  surfaces
- A glass-themed analyst workspace with overview, action-capable agent, ledger,
  revision graph, inspection plan, and source lineage
- A 24-obligation cited review set with amendment-aware supersession
- Evidence states that distinguish missing proof from legal non-compliance
- A MapLibre location view that explicitly flags unavailable parcel geometry
- A deterministic inspection planner and printable checklist
- Device-local workspace memory for conversations, reviewer decisions, filters,
  and extracted findings
- Voice commands with animated listening state and spoken responses
- Branded, structured PDF report generation
- Multimodal document and image analysis at `POST /api/analyze`
- A pre-populated demo reviewer with durable per-visitor and global API budgets
- Environment-backed administrator sign-in with signed HttpOnly sessions and an
  authenticated rate-limit bypass
- Netlify Database-backed rate limits and partnership inquiries, with automatic
  Postgres migrations and isolated deploy-preview branches
- Structured output and Zod validation with document type, signature, and size
  checks

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
# Set GEMINI_API_KEY and the three ADMIN_* values in .env.local.
# Never put a real key in .env.example.
npm run dev
```

Run the production build and acceptance tests:

```bash
npm test
```

## Deploy on Netlify

This repository includes a standard Next.js production build, Netlify runtime
configuration, managed Postgres integration, and a versioned database
migration.

1. In Netlify, select **Add new project → Import an existing project** and
   connect this GitHub repository.
2. Keep the repository-provided build settings:
   - Build command: `npm run build:netlify`
   - Publish directory: `.next`
3. Add these server-side environment variables in **Project configuration →
   Environment variables**:
   - `GEMINI_API_KEY`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET` (at least 32 random characters)
4. Deploy. Because `@netlify/database` and
   `netlify/database/migrations/20260727063000_initialize_verdatrace.sql` are
   present, Netlify can provision its managed Postgres database and apply the
   schema before publishing.

Production deploys use the main database branch. Deploy Previews receive
isolated database branches, so rate-limit and contact-form test data cannot
modify production.

Database maintenance commands:

```bash
npm run db:status
npm run db:migrate
npm run db:new -- --description "describe the schema change"
```

Use `npm run dev:netlify` when you want Netlify's local runtime and database
emulator. The existing `npm run dev` remains available for the bundled local
workspace preview.

## Guardrails

- Uploaded files are processed in memory and are not persisted by the app.
- Extracted workspace context is saved only in the visitor's browser.
- Demo visitors receive at most three live analyses per hour, with a
  production-wide cap of 30 analyses per hour stored in Netlify Database.
- Administrator credentials and session signing keys stay server-side. Valid
  sessions are signed, HttpOnly, SameSite Strict, and expire after eight hours.
- Administrator sign-in attempts and public contact inquiries are rate-limited.
- Applicant contact details are excluded from the demo and extraction prompt.
- AI output is placed in `expert_review`; it is never treated as a legal verdict.
- Every extracted finding requires a page and clause citation.
- Missing spatial data is shown as missing. No parcel geometry is fabricated.

## Public sources

- [May 2025 final approval](https://forestsclearance.nic.in/writereaddata/RO_Approved/051520251document-18.pdf)
- [September 2025 amendment](https://forestsclearance.nic.in/writereaddata/AdditionalInformation/AddInfoSought/0_0_9114121512121IMOEFCC0000337514_1756881077629%282%29.pdf)
- [Proposal and KML records](https://forestsclearance.nic.in/viewreport_B.aspx?pid=FP%2FKA%2FROAD%2F7440%2F2014)

## Validation status

The 24-item review set is prepared for consultant labelling. Precision and
recall are intentionally unpublished until a consultant completes the review.
The demo amendment relationship is covered by automated tests.
