import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
  ADMIN_USERNAME: "test-admin",
  ADMIN_PASSWORD: "test-password-with-adequate-length",
  ADMIN_SESSION_SECRET:
    "test-session-secret-with-more-than-thirty-two-characters",
};
const ctx = {
  waitUntil() {},
  passThroughOnException() {},
};

function request(path, init) {
  return worker.fetch(new Request(`http://localhost${path}`, init), env, ctx);
}

test("renders the enterprise landing page without embedding the workspace", async () => {
  const response = await request("/", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /VerdaTrace/);
  assert.match(html, /Every ecological/);
  assert.match(html, /traceable/i);
  assert.match(html, /hero-product-transparent\.webp/);
  assert.match(html, /VerdaTrace obligation ledger connected to approval documents/);
  assert.match(html, /verdatrace-introduction\.mp4/);
  assert.match(html, /verdatrace-introduction-poster\.jpg/);
  assert.match(html, /This video includes audio/);
  assert.ok(
    html.indexOf("Meet VerdaTrace") < html.indexOf("The accountability gap"),
    "Meet VerdaTrace should appear before the accountability gap",
  );
  assert.doesNotMatch(html, /Upload approvals and evidence/);
  assert.match(html, /Four connected screens\. One evidence system\./);
  assert.match(html, /Case Intelligence/);
  assert.match(html, /Dynamic World Spatial Evidence/);
  assert.match(html, /Workflow Orchestrator/);
  assert.match(html, /AlphaEarth Similarity Intelligence/);
  assert.match(html, /AI-native by design/);
  assert.match(html, /Agentic operating layer/);
  assert.match(html, /Experts approve consequential findings/);
  assert.match(html, /href="\/demo#spatial-intelligence"/);
  assert.match(html, /href="\/research#spatial"/);
  assert.match(html, /Open demo/);
  assert.match(html, /Research/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.doesNotMatch(html, /cc-brand-banner/);
  assert.doesNotMatch(html, /Current project/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
  assert.doesNotMatch(html, /Gemini/i);
});
test("renders the complete public case on its dedicated demo route", async () => {
  const response = await request("/demo", {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /From approval documents/);
  assert.match(html, /accountable action\./i);
  assert.match(html, /Active obligations/);
  assert.match(html, /Priority evidence gaps/);
  assert.match(html, /VerdaTrace · Case Intelligence/);
  assert.match(html, /VerdaTrace · Spatial Workbench/);
  assert.match(html, /Screen 03 · Workflow orchestrator/);
  assert.match(html, /Recorded sample run/);
  assert.match(html, /is-close/);
  assert.match(html, /is-minimize/);
  assert.match(html, /is-expand/);
  assert.match(html, /FP\/KA\/ROAD\/7440\/2014/);
  assert.match(html, /September 2025/);
  assert.match(html, /Revision graph/);
  assert.match(html, /Missing evidence/);
  assert.match(html, /Demo reviewer/);
  assert.match(html, /3 AI runs \/ hour/);
  assert.match(html, /Upload document/);
  assert.match(html, /Generate project report/);
  assert.match(html, /VerdaTrace suggestions/);
  assert.match(html, /Ask VerdaTrace/);
  assert.match(html, /> Agent</);
  assert.ok(
    html.indexOf(">Overview<") < html.indexOf("> Agent<") &&
      html.indexOf("> Agent<") < html.indexOf("> Obligation ledger<"),
    "Agent should be the second workspace tab",
  );
  assert.doesNotMatch(html, /Gemini/i);
});

test("ships the live spatial and revision intelligence contracts", async () => {
  const [spatialUi, revisionUi, spatialSchema, appSource] = await Promise.all([
    readFile(new URL("../app/SpatialWorkbench.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/RevisionEvidenceGraph.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/spatial.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/CanopyApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(spatialUi, /new maplibregl\.Map/);
  assert.match(spatialUi, /\/api\/spatial\/analyze/);
  assert.match(spatialUi, /No parcel statistics until geometry is verified/);
  assert.match(spatialUi, /verdatrace\.spatial\.preferences\.v2/);
  assert.match(spatialUi, /verdatrace\.spatial\.rate-limit\.v1/);
  assert.match(spatialUi, /Spatial compute allowance/);
  assert.match(revisionUi, /old-c2/);
  assert.match(revisionUi, /current-c2/);
  assert.match(revisionUi, /old-c3/);
  assert.match(revisionUi, /current-c3/);
  assert.match(revisionUi, /prefers-reduced-motion|Arrow keys/);
  spatialClassNames.forEach((className) =>
    assert.match(spatialSchema, new RegExp(`id: "${className}"`)),
  );
  assert.match(appSource, /agentEvents/);
  assert.match(appSource, /Measured run ledger/);
});

const spatialClassNames = [
  "water",
  "trees",
  "grass",
  "flooded_vegetation",
  "crops",
  "shrub_and_scrub",
  "built",
  "bare",
  "snow_and_ice",
];

test("rejects malformed spatial computation requests before service use", async () => {
  const malformed = await request("/api/spatial/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "test-spatial-malformed",
    },
    body: JSON.stringify({
      geometry: {
        geometry: {
          type: "Polygon",
          coordinates: [[[181, 15], [76, 15], [76, 16], [181, 15]]],
        },
        metadata: {
          fileName: "invalid.geojson",
          geometryType: "Polygon",
          featureCount: 1,
          coordinateCount: 4,
          bbox: [76, 15, 181, 16],
          areaHectares: 1,
          hash: "invalid-geometry-hash",
          source: "upload",
        },
      },
      baselineYear: 2021,
      currentYear: 2025,
      confidenceThreshold: 0.55,
    }),
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, "invalid_geometry");

  const badTile = await request("/api/spatial/tiles/token/24/0/0");
  assert.equal(badTile.status, 400);
});

test("blocks a fourth hourly spatial computation from the same demo visitor", async () => {
  const statuses = [];
  for (let index = 0; index < 4; index += 1) {
    const response = await request("/api/spatial/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "test-spatial-rate-limit",
      },
      body: JSON.stringify({}),
    });
    statuses.push(response.status);
    if (index === 3) {
      assert.equal(response.headers.get("x-ratelimit-limit"), "3");
      assert.equal(response.headers.get("x-ratelimit-remaining"), "0");
      assert.ok(Number(response.headers.get("retry-after")) > 0);
      assert.equal((await response.json()).code, "SPATIAL_RATE_LIMIT");
    }
  }
  assert.deepEqual(statuses, [400, 400, 400, 429]);
});

test("renders the research and contact surfaces", async () => {
  const [research, contact] = await Promise.all([
    request("/research", { headers: { accept: "text/html" } }),
    request("/contact", { headers: { accept: "text/html" } }),
  ]);
  assert.equal(research.status, 200);
  assert.equal(contact.status, 200);
  const researchHtml = await research.text();
  assert.match(researchHtml, /Evidence should survive/);
  assert.match(researchHtml, /cc-research-scene/);
  assert.match(researchHtml, /hf_20260613_180732/);
  assert.match(researchHtml, /research chapters/);
  assert.doesNotMatch(researchHtml, /cc-research-hero-banner/);
  assert.match(researchHtml, /Case Intelligence method/);
  assert.doesNotMatch(researchHtml, /Gemini/i);
  assert.match(await contact.text(), /Partnership inquiry/);
});

test("renders production privacy and terms surfaces", async () => {
  const [privacy, terms] = await Promise.all([
    request("/privacy", { headers: { accept: "text/html" } }),
    request("/terms", { headers: { accept: "text/html" } }),
  ]);
  assert.equal(privacy.status, 200);
  assert.equal(terms.status, 200);

  const privacyHtml = await privacy.text();
  assert.match(privacyHtml, /Your evidence should remain under your control/);
  assert.match(privacyHtml, /privacy@verdatrace\.com/);
  assert.match(privacyHtml, /seven days after the run completes/);
  assert.match(privacyHtml, /local browser storage/);
  assert.doesNotMatch(privacyHtml, /Gemini/i);

  const termsHtml = await terms.text();
  assert.match(termsHtml, /clear human decision boundary/);
  assert.match(termsHtml, /No automated legal or regulatory determination/);
  assert.match(termsHtml, /applicable laws of India/);
  assert.doesNotMatch(termsHtml, /Gemini/i);
});

test("ships a Netlify Next.js build and managed database migration", async () => {
  const [config, migration, workflowMigration, packageJson] = await Promise.all([
    readFile(new URL("../netlify.toml", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../netlify/database/migrations/20260727063000_initialize_verdatrace.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../netlify/database/migrations/20260801090000_workflow_orchestrator.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(config, /npm run build:netlify/);
  assert.match(config, /publish = "\.next"/);
  assert.match(config, /microphone=\(self\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS api_rate_limits/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS contact_inquiries/);
  assert.match(workflowMigration, /CREATE TABLE IF NOT EXISTS workflow_runs/);
  assert.match(workflowMigration, /CREATE TABLE IF NOT EXISTS workflow_approvals/);
  assert.match(workflowMigration, /CREATE TABLE IF NOT EXISTS workflow_integrations/);
  assert.match(packageJson, /"@netlify\/database"/);
  assert.match(packageJson, /"@netlify\/async-workloads"/);
});

test("ships the constrained Screen 03 workflow and recorded-sample boundaries", async () => {
  const [workflow, ui, runner, delivery] = await Promise.all([
    readFile(new URL("../lib/workflow.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/WorkflowOrchestrator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../netlify/functions/workflow-runner.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/workflow-delivery.ts", import.meta.url), "utf8"),
  ]);
  assert.match(workflow, /Complete project review/);
  assert.match(workflow, /New amendment impact review/);
  assert.match(workflow, /Evidence gaps to inspection plan/);
  assert.match(workflow, /Spatial re-analysis and report update/);
  assert.match(workflow, /Recorded preview · not invoked · calibration pending/);
  assert.match(workflow, /durationMs: 6128/);
  assert.match(ui, /Replay does not consume quota/);
  assert.match(ui, /Human approval boundary/);
  assert.match(ui, /document\.hidden \? 10_000 : 2_000/);
  assert.match(runner, /event\.step\.run/);
  assert.match(runner, /ErrorDoNotRetry/);
  assert.match(delivery, /gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/send/);
  assert.match(delivery, /drive\/v3\/files\?uploadType=multipart/);
  assert.match(delivery, /redirect: "error"/);
  assert.match(delivery, /x-verdatrace-signature/);
});

test("rejects missing and unsupported document uploads", async () => {
  const missing = await request("/api/analyze", {
    method: "POST",
    headers: { "user-agent": "test-document-validation" },
    body: new FormData(),
  });
  assert.equal(missing.status, 400);

  const form = new FormData();
  form.append(
    "file",
    new File(["executable"], "evidence.exe", {
      type: "application/x-msdownload",
    }),
  );
  const invalidType = await request("/api/analyze", {
    method: "POST",
    headers: { "user-agent": "test-document-type" },
    body: form,
  });
  assert.equal(invalidType.status, 415);
});

test("validates file signatures before invoking document intelligence", async () => {
  const form = new FormData();
  form.append(
    "file",
    new File(["plain text pretending to be a PDF"], "fake.pdf", {
      type: "application/pdf",
    }),
  );
  const response = await request("/api/analyze", {
    method: "POST",
    headers: { "user-agent": "test-pdf-signature" },
    body: form,
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /contents do not match/i);
});

test("accepts both text documents and image evidence for analysis", async () => {
  const textForm = new FormData();
  textForm.append(
    "file",
    new File(["Condition 1: retain dated field evidence."], "condition.txt", {
      type: "text/plain",
    }),
  );
  const textResponse = await request("/api/analyze", {
    method: "POST",
    headers: { "user-agent": "test-text-analysis" },
    body: textForm,
  });
  assert.equal(textResponse.status, 503);
  assert.equal((await textResponse.json()).code, "ANALYSIS_NOT_CONFIGURED");

  const pngForm = new FormData();
  pngForm.append(
    "file",
    new File(
      [
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
        ]),
      ],
      "field-evidence.png",
      { type: "image/png" },
    ),
  );
  const pngResponse = await request("/api/analyze", {
    method: "POST",
    headers: { "user-agent": "test-image-analysis" },
    body: pngForm,
  });
  assert.equal(pngResponse.status, 503);
  assert.equal((await pngResponse.json()).code, "ANALYSIS_NOT_CONFIGURED");
});

test("blocks a fourth hourly live analysis from the same demo visitor", async () => {
  const statuses = [];
  for (let index = 0; index < 4; index += 1) {
    const response = await request("/api/analyze", {
      method: "POST",
      headers: { "user-agent": "test-demo-limit" },
      body: new FormData(),
    });
    statuses.push(response.status);
    if (index === 3) {
      assert.equal(response.headers.get("x-ratelimit-limit"), "3");
      assert.equal(response.headers.get("x-ratelimit-remaining"), "0");
      assert.ok(Number(response.headers.get("retry-after")) > 0);
    }
  }
  assert.deepEqual(statuses, [400, 400, 400, 429]);
});

test("validates project assistant questions before model use", async () => {
  const response = await request("/api/project-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "test-project-assistant",
    },
    body: JSON.stringify({ question: "" }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /concise question/i);
});

test("creates a secure admin session that bypasses the public quota", async () => {
  const login = await request("/api/admin/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "test-admin-login",
    },
    body: JSON.stringify({
      username: env.ADMIN_USERNAME,
      password: env.ADMIN_PASSWORD,
    }),
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.match(login.headers.get("set-cookie") ?? "", /SameSite=Strict/);
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

  const session = await request("/api/admin/session", {
    headers: { cookie, "user-agent": "test-admin-session" },
  });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).authenticated, true);

  for (let index = 0; index < 5; index += 1) {
    const response = await request("/api/analyze", {
      method: "POST",
      headers: { cookie, "user-agent": "test-admin-analysis" },
      body: new FormData(),
    });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("x-ratelimit-limit"), "unlimited");
    assert.equal(
      response.headers.get("x-ratelimit-policy"),
      "authenticated-admin",
    );
  }
});

test("rejects malformed contact inquiries before persistence", async () => {
  const response = await request("/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "test-contact-validation",
    },
    body: JSON.stringify({ name: "A" }),
  });
  assert.equal(response.status, 400);
});

test("generates a deterministic inspection plan from unresolved obligations", async () => {
  const obligation = {
    id: "test-biodiversity",
    clause: "Condition 16",
    category: "Biodiversity",
    requirement: "Create and maintain alternate avifauna habitat.",
    responsibleParty: "User Agency",
    quantity: null,
    unit: null,
    deadline: null,
    geography: "Adjoining forest area",
    citation: {
      documentId: "final",
      documentTitle: "Final approval",
      page: 3,
      clause: "3(16)",
      sourceUrl: "https://example.com/final.pdf",
    },
    confidence: 0.98,
    status: "missing_evidence",
    reason: "No habitat evidence is present.",
    evidenceIds: [],
    reviewerState: "pending",
  };
  const response = await request("/api/inspection-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ obligations: [obligation] }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].priority, 1);
  assert.match(result.tasks[0].requiredEvidence.join(" "), /habitat/i);
  assert.match(result.method, /human approval required/i);
});
