"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- vinext client navigation avoids a duplicate React runtime from next/link. */

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileSearch,
  FileText,
  Filter,
  Fingerprint,
  GitCompareArrows,
  Layers3,
  Leaf,
  Lightbulb,
  Map,
  MapPin,
  MessageCircle,
  Mic,
  MicOff,
  Network,
  PanelLeft,
  Radar,
  RotateCcw,
  Satellite,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TreePine,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  benchmark,
  demoObligations,
  evidenceItems,
  revisions,
  sourceDocuments,
} from "@/lib/demo-data";
import { createInspectionPlan } from "@/lib/inspection";
import { downloadVerdaTraceReport } from "@/lib/report-pdf";
import { analysisResultSchema, obligationSchema } from "@/lib/schema";
import { dynamicWorldEvidence } from "@/lib/spatial-demo";
import type {
  AnalysisResult,
  AssessmentStatus,
  InspectionTask,
  Obligation,
} from "@/lib/schema";
import { CaseMap } from "./CaseMap";
import { SiteFooter, SiteHeader } from "./SiteHeader";
import type {
  SpatialGeometryMetadata,
  SpatialInsight,
} from "@/lib/spatial-demo";

type Tab =
  | "overview"
  | "ledger"
  | "revisions"
  | "inspection"
  | "documents"
  | "agent";

type AdminChange = {
  authenticated: boolean;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: AgentAction[];
};

type AgentAction =
  | { type: "navigate"; tab: Tab; label: string }
  | {
      type: "filter_obligations";
      status: AssessmentStatus | "all";
      label: string;
    }
  | { type: "search_obligations"; query: string; label: string }
  | { type: "open_upload"; label: string }
  | { type: "export_report"; label: string }
  | { type: "reset_filters"; label: string };

type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

type VoiceRecognitionResult = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type VoiceRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<VoiceRecognitionResult>;
};

type VoiceRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type VoiceRecognitionConstructor = new () => VoiceRecognition;

const DEMO_STORAGE_KEY = "verdatrace.demo.workspace.v1";
const DEFAULT_CHAT_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "I can investigate this project and operate the workspace for you. Ask me to open a tab, filter or search obligations, start an upload, or generate a report.",
};

type PersistedDemoWorkspace = {
  version: 1;
  tab: Tab;
  obligations: Obligation[];
  search: string;
  statusFilter: AssessmentStatus | "all";
  analysis: AnalysisResult | null;
  chatMessages: ChatMessage[];
  agentActivity: string[];
  spatialInspectionTasks: InspectionTask[];
  demoRemaining: number;
  rateLimitResetAt: number;
};

const statusLabels: Record<AssessmentStatus, string> = {
  verified: "Verified",
  partial: "Partial evidence",
  missing_evidence: "Missing evidence",
  not_yet_due: "Not yet due",
  superseded: "Superseded",
  expert_review: "Expert review",
};

const statusOrder: AssessmentStatus[] = [
  "missing_evidence",
  "partial",
  "expert_review",
  "not_yet_due",
  "verified",
  "superseded",
];

function isInspectionTask(value: unknown): value is InspectionTask {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<InspectionTask>;
  return Boolean(
    typeof task.id === "string" &&
      (task.priority === 1 || task.priority === 2 || task.priority === 3) &&
      typeof task.title === "string" &&
      typeof task.location === "string" &&
      Array.isArray(task.requiredEvidence) &&
      task.requiredEvidence.every((item) => typeof item === "string") &&
      typeof task.rationale === "string" &&
      typeof task.safetyNote === "string" &&
      Array.isArray(task.obligationIds),
  );
}

function StatusPill({ status }: { status: AssessmentStatus }) {
  return (
    <span className={`status status-${status}`}>
      <span />
      {statusLabels[status]}
    </span>
  );
}

function Citation({ obligation }: { obligation: Obligation }) {
  const isSession = obligation.citation.sourceUrl.startsWith("session:");
  const content = (
    <>
      {obligation.citation.documentTitle} · p.{obligation.citation.page} ·{" "}
      {obligation.citation.clause}
      {!isSession && <ExternalLink size={12} />}
    </>
  );
  if (isSession) {
    return <span className="citation session-citation">{content}</span>;
  }
  return (
    <a
      className="citation"
      href={`${obligation.citation.sourceUrl}#page=${obligation.citation.page}`}
      target="_blank"
      rel="noreferrer"
    >
      {content}
    </a>
  );
}

export function CanopyApp() {
  const [tab, setTab] = useState<Tab>("overview");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [obligations, setObligations] = useState(demoObligations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<AssessmentStatus | "all">("all");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [demoRemaining, setDemoRemaining] = useState(3);
  const [rateLimitResetAt, setRateLimitResetAt] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    DEFAULT_CHAT_MESSAGE,
  ]);
  const [agentActivity, setAgentActivity] = useState<string[]>([]);
  const [spatialInspectionTasks, setSpatialInspectionTasks] = useState<
    InspectionTask[]
  >([]);
  const seenHashes = useRef(new Set<string>());
  const persistenceReady = useRef(false);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session) => setIsAdmin(Boolean(session.authenticated)))
      .catch(() => setIsAdmin(false));
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<AdminChange>).detail;
      setIsAdmin(Boolean(detail?.authenticated));
    };
    window.addEventListener("canopy-admin-change", listener);
    return () => window.removeEventListener("canopy-admin-change", listener);
  }, []);

  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      try {
        const serialized = window.localStorage.getItem(DEMO_STORAGE_KEY);
        if (serialized) {
          const stored = JSON.parse(
            serialized,
          ) as Partial<PersistedDemoWorkspace>;
          const validTabs: Tab[] = [
            "overview",
            "agent",
            "ledger",
            "revisions",
            "inspection",
            "documents",
          ];
          const validStatuses: Array<AssessmentStatus | "all"> = [
            "all",
            ...statusOrder,
          ];
          const restoredObligations = obligationSchema
            .array()
            .max(200)
            .safeParse(stored.obligations);
          const restoredAnalysis = stored.analysis
            ? analysisResultSchema.safeParse(stored.analysis)
            : null;
          const restoredMessages = Array.isArray(stored.chatMessages)
            ? stored.chatMessages
                .filter(
                  (message): message is ChatMessage =>
                    Boolean(
                      message &&
                        (message.role === "user" ||
                          message.role === "assistant") &&
                        typeof message.content === "string",
                    ),
                )
                .slice(-50)
            : [];
          const restoredSpatialTasks = Array.isArray(
            stored.spatialInspectionTasks,
          )
            ? stored.spatialInspectionTasks.filter(isInspectionTask).slice(0, 6)
            : [];

          if (stored.tab && validTabs.includes(stored.tab)) setTab(stored.tab);
          if (restoredObligations.success) {
            setObligations(restoredObligations.data);
          }
          if (typeof stored.search === "string") {
            setSearch(stored.search.slice(0, 180));
          }
          if (
            stored.statusFilter &&
            validStatuses.includes(stored.statusFilter)
          ) {
            setStatusFilter(stored.statusFilter);
          }
          if (restoredAnalysis?.success) {
            setAnalysis(restoredAnalysis.data);
            seenHashes.current.add(restoredAnalysis.data.document.hash);
          }
          if (restoredMessages.length) setChatMessages(restoredMessages);
          if (restoredSpatialTasks.length) {
            setSpatialInspectionTasks(restoredSpatialTasks);
          }
          if (Array.isArray(stored.agentActivity)) {
            setAgentActivity(
              stored.agentActivity
                .filter((item): item is string => typeof item === "string")
                .slice(0, 8),
            );
          }

          const resetAt =
            typeof stored.rateLimitResetAt === "number"
              ? stored.rateLimitResetAt
              : 0;
          if (
            resetAt > Date.now() &&
            typeof stored.demoRemaining === "number"
          ) {
            setDemoRemaining(
              Math.max(0, Math.min(3, Math.floor(stored.demoRemaining))),
            );
            setRateLimitResetAt(resetAt);
          }
        }
      } catch {
        window.localStorage.removeItem(DEMO_STORAGE_KEY);
      } finally {
        persistenceReady.current = true;
      }
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  }, []);

  useEffect(() => {
    if (!persistenceReady.current) return;
    const saveTimer = window.setTimeout(() => {
      const workspace: PersistedDemoWorkspace = {
        version: 1,
        tab,
        obligations,
        search,
        statusFilter,
        analysis,
        chatMessages: chatMessages.slice(-50),
        agentActivity: agentActivity.slice(0, 8),
        spatialInspectionTasks: spatialInspectionTasks.slice(0, 6),
        demoRemaining,
        rateLimitResetAt,
      };
      try {
        window.localStorage.setItem(
          DEMO_STORAGE_KEY,
          JSON.stringify(workspace),
        );
      } catch {
        // Continue with in-memory state when browser storage is unavailable.
      }
    }, 120);
    return () => window.clearTimeout(saveTimer);
  }, [
    agentActivity,
    analysis,
    chatMessages,
    demoRemaining,
    obligations,
    rateLimitResetAt,
    search,
    spatialInspectionTasks,
    statusFilter,
    tab,
  ]);

  const activeObligations = obligations.filter(
    (obligation) => obligation.status !== "superseded",
  );
  const counts = useMemo(
    () =>
      statusOrder.reduce(
        (result, status) => ({
          ...result,
          [status]: obligations.filter((item) => item.status === status).length,
        }),
        {} as Record<AssessmentStatus, number>,
      ),
    [obligations],
  );
  const coverage =
    activeObligations.length === 0
      ? 0
      : Math.round(
          ((counts.verified + counts.partial * 0.5) / activeObligations.length) *
            100,
        );

  const filteredObligations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return obligations.filter((obligation) => {
      const matchesStatus =
        statusFilter === "all" || obligation.status === statusFilter;
      const matchesQuery =
        !query ||
        [
          obligation.clause,
          obligation.category,
          obligation.requirement,
          obligation.responsibleParty,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [obligations, search, statusFilter]);

  const inspectionTasks = useMemo(
    () => [
      ...spatialInspectionTasks,
      ...createInspectionPlan(obligations).filter(
        (task) =>
          !spatialInspectionTasks.some(
            (spatialTask) => spatialTask.id === task.id,
          ),
      ),
    ],
    [obligations, spatialInspectionTasks],
  );

  const toggleReviewer = (id: string) => {
    setObligations((current) =>
      current.map((obligation) =>
        obligation.id === id
          ? {
              ...obligation,
              reviewerState:
                obligation.reviewerState === "approved" ? "pending" : "approved",
            }
          : obligation,
      ),
    );
  };

  const analyzeDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      setAnalysisError("Choose a document or image first.");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysis(null);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append(
        "projectContext",
        "Forest-clearance obligation review. Do not extract applicant contact details.",
      );
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (remaining && remaining !== "unlimited") {
        setDemoRemaining(Number(remaining));
      }
      const resetSeconds = response.headers.get("x-ratelimit-reset");
      if (resetSeconds && resetSeconds !== "0") {
        setRateLimitResetAt(
          Date.now() + Math.max(1, Number(resetSeconds)) * 1000,
        );
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Analysis failed.");
      const typed = result as AnalysisResult;
      if (seenHashes.current.has(typed.document.hash)) {
        throw new Error("This document was already analyzed in this session.");
      }
      seenHashes.current.add(typed.document.hash);
      setAnalysis(typed);
      setObligations((current) => [...typed.obligations, ...current]);
      setSearch("");
      setStatusFilter("all");
      setTab("ledger");
      setUploadOpen(false);
      setSelectedFile(null);
      window.setTimeout(() => {
        document
          .querySelector(".analysis-result-banner")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    } catch (caught) {
      setAnalysisError(
        caught instanceof Error
          ? caught.message
          : "The document could not be analyzed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportReport = async () => {
    setIsExporting(true);
    try {
      await downloadVerdaTraceReport({
        projectId: "FP/KA/ROAD/7440/2014",
        projectName: "Zeenath approach road",
        location: "Ballari, Karnataka",
        obligations,
        revisions,
        inspectionTasks,
        documents: sourceDocuments,
        evidence: evidenceItems,
        coverage,
        dynamicWorld: dynamicWorldEvidence,
        uploadedDocumentTitle: analysis?.document.title,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const executeAgentActions = (actions: AgentAction[]) => {
    actions.forEach((action) => {
      if (action.type === "navigate") {
        setChatOpen(false);
        setTab(action.tab);
      } else if (action.type === "filter_obligations") {
        setChatOpen(false);
        setSearch("");
        setStatusFilter(action.status);
        setTab("ledger");
      } else if (action.type === "search_obligations") {
        setChatOpen(false);
        setStatusFilter("all");
        setSearch(action.query);
        setTab("ledger");
      } else if (action.type === "open_upload") {
        setChatOpen(false);
        setUploadOpen(true);
      } else if (action.type === "export_report") {
        void exportReport();
      } else if (action.type === "reset_filters") {
        setSearch("");
        setStatusFilter("all");
      }
    });
    if (actions.length) {
      setAgentActivity((current) => [
        ...actions.map((action) => action.label),
        ...current,
      ].slice(0, 8));
    }
  };

  const askAssistant = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || chatSending) return;
    const history = chatMessages.slice(-8);
    if (tab !== "agent") setChatOpen(true);
    setChatInput("");
    setChatSending(true);
    setChatMessages((current) => [
      ...current,
      { role: "user", content: trimmed },
    ]);
    try {
      const response = await fetch("/api/project-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed, history }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Assistant unavailable.");
      const actions = Array.isArray(result.actions)
        ? (result.actions as AgentAction[])
        : [];
      setChatMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer, actions },
      ]);
      executeAgentActions(actions);
    } catch (caught) {
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            caught instanceof Error
              ? caught.message
              : "I could not answer that right now.",
        },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  const handleSuggestion = (action: string, prompt: string) => {
    if (action === "missing") {
      setTab("ledger");
      setStatusFilter("missing_evidence");
      return;
    }
    if (action === "revision") {
      setTab("revisions");
      return;
    }
    if (action === "inspection") {
      setTab("inspection");
      return;
    }
    if (action === "documents") {
      setTab("documents");
      return;
    }
    if (action === "export") {
      void exportReport();
      return;
    }
    void askAssistant(prompt);
  };

  return (
    <main className="demo-page">
      <SiteHeader demoContext />

      <section className="demo-command">
        <div className="demo-command-grid" />
        <div className="demo-breadcrumb">
          <a href="/">
            <ArrowLeft size={13} /> VerdaTrace
          </a>
          <span>/</span>
          <strong>Public demonstration</strong>
        </div>
        <div className="demo-command-main">
          <div>
            <span className="demo-live">
              <i /> Live public case
            </span>
            <h1>Environmental obligation intelligence workspace</h1>
            <p>
              A complete amendment-aware review of proposal
              FP/KA/ROAD/7440/2014 using public documents from India&apos;s
              forest-clearance portal.
            </p>
          </div>
          <div className="demo-command-actions">
            <button
              className="demo-print"
              onClick={exportReport}
              disabled={isExporting}
            >
              <Download size={15} />{" "}
              {isExporting ? "Building report…" : "Export branded report"}
            </button>
            <button className="demo-analyze" onClick={() => setUploadOpen(true)}>
              <UploadCloud size={16} /> Upload document
            </button>
          </div>
        </div>
        <div className="demo-context-row">
          <div>
            <span>Proposal</span>
            <strong>FP/KA/ROAD/7440/2014</strong>
          </div>
          <div>
            <span>Project</span>
            <strong>Zeenath approach road</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>Ballari, Karnataka</strong>
          </div>
          <div>
            <span>Access</span>
            <strong className={isAdmin ? "admin-access" : ""}>
              {isAdmin ? "Admin · unlimited analysis" : `${demoRemaining}/3 demo analyses left`}
            </strong>
          </div>
        </div>
      </section>

      <section className="demo-stage">
        <div className="demo-stage-heading">
          <div>
            <span>Screen 01 · Case intelligence</span>
            <h2>From approval language to review-ready action.</h2>
          </div>
          <div className="demo-trust">
            <span>
              <ShieldCheck size={14} /> Legal verdicts disabled
            </span>
            <span>
              <Fingerprint size={14} /> 100% source-linked demo
            </span>
          </div>
        </div>

        <div className="demo-workspace">
          <aside className="demo-sidebar">
            <div className="demo-project-switcher">
              <span>Active project</span>
              <button>
                <span className="project-avatar">ZG</span>
                <span>
                  <strong>Zeenath approach road</strong>
                  <small>9.40 ha diversion · public record</small>
                </span>
                <ChevronDown size={14} />
              </button>
            </div>
            <nav aria-label="Case workspace sections">
              <button
                className={tab === "overview" ? "active" : ""}
                onClick={() => setTab("overview")}
              >
                <PanelLeft size={17} /> Overview
              </button>
              <button
                className={`agent-nav ${tab === "agent" ? "active" : ""}`}
                onClick={() => {
                  setChatOpen(false);
                  setTab("agent");
                }}
              >
                <Sparkles size={17} /> Agent
                <span className="agent-live-badge">Live</span>
              </button>
              <button
                className={tab === "ledger" ? "active" : ""}
                onClick={() => setTab("ledger")}
              >
                <ClipboardCheck size={17} /> Obligation ledger
                <span>{obligations.length}</span>
              </button>
              <button
                className={tab === "revisions" ? "active" : ""}
                onClick={() => setTab("revisions")}
              >
                <GitCompareArrows size={17} /> Revision graph
                <span>{revisions.length}</span>
              </button>
              <button
                className={tab === "inspection" ? "active" : ""}
                onClick={() => setTab("inspection")}
              >
                <Map size={17} /> Inspection plan
                <span>{inspectionTasks.length}</span>
              </button>
              <button
                className={tab === "documents" ? "active" : ""}
                onClick={() => setTab("documents")}
              >
                <FileText size={17} /> Sources
                <span>{sourceDocuments.length}</span>
              </button>
            </nav>
            <div className="demo-agent-status">
              <div>
                <Bot size={15} />
                <span>
                  <strong>Agent control plane</strong>
                  <small>5 bounded agents</small>
                </span>
                <i />
              </div>
              {[
                ["Extractor", "Source grounded"],
                ["Resolver", "1 chain linked"],
                ["Matcher", "Evidence indexed"],
                ["Assessor", "Rules applied"],
                ["Planner", "6 tasks ready"],
              ].map(([name, state]) => (
                <p key={name}>
                  <span>{name}</span>
                  <small>{state}</small>
                </p>
              ))}
            </div>
          </aside>

          <div className="demo-content">
            {analysis && (
              <div className="analysis-result-banner" role="status">
                <div>
                  <CheckCircle2 size={18} />
                  <span>
                    <strong>{analysis.document.title}</strong>
                    {analysis.obligations.length} source-cited obligations added
                    in {(analysis.processingMs / 1000).toFixed(1)} seconds.
                  </span>
                </div>
                <button
                  onClick={() => {
                    setAnalysis(null);
                    setObligations(demoObligations);
                    setStatusFilter("all");
                    seenHashes.current.clear();
                  }}
                >
                  <RotateCcw size={13} /> Reset public case
                </button>
              </div>
            )}
            <AssistantSuggestions
              tab={tab}
              onAction={handleSuggestion}
            />
            {tab === "overview" && (
              <OverviewTab
                counts={counts}
                coverage={coverage}
                activeCount={activeObligations.length}
                setTab={setTab}
                approved={
                  obligations.filter(
                    (item) => item.reviewerState === "approved",
                  ).length
                }
              />
            )}
            {tab === "ledger" && (
              <LedgerTab
                obligations={filteredObligations}
                allCount={obligations.length}
                search={search}
                setSearch={setSearch}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                toggleReviewer={toggleReviewer}
              />
            )}
            {tab === "revisions" && <RevisionTab />}
            {tab === "inspection" && (
              <InspectionTab tasks={inspectionTasks} />
            )}
            {tab === "documents" && <DocumentsTab />}
            {tab === "agent" && (
              <AgentTab
                messages={chatMessages}
                input={chatInput}
                setInput={setChatInput}
                sending={chatSending}
                ask={askAssistant}
                activity={agentActivity}
              />
            )}
          </div>
        </div>
      </section>

      <DynamicWorldScreen
        isExporting={isExporting}
        onExport={() => void exportReport()}
        onQueueTasks={(tasks) => {
          setSpatialInspectionTasks(tasks);
          setAgentActivity((current) => [
            `Added ${tasks.length} spatial review tasks to the inspection plan`,
            ...current,
          ].slice(0, 8));
          setTab("inspection");
          window.setTimeout(() => {
            document
              .querySelector(".demo-workspace")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 80);
        }}
      />

      <section className="demo-moat">
        <div>
          <span className="cc-overline">What compounds after every project</span>
          <h2>The obligation graph becomes operating memory.</h2>
        </div>
        <div className="demo-moat-grid">
          <article>
            <Network size={20} />
            <strong>Revision-aware ontology</strong>
            <p>Each condition joins a reusable graph of actors, actions, evidence, and geography.</p>
          </article>
          <article>
            <Fingerprint size={20} />
            <strong>Decision provenance</strong>
            <p>Model output, deterministic rules, citations, and reviewer decisions remain separable.</p>
          </article>
          <article>
            <Radar size={20} />
            <strong>Inspection feedback loop</strong>
            <p>Field findings can improve prioritization without silently rewriting source obligations.</p>
          </article>
          <article>
            <Layers3 size={20} />
            <strong>Spatial evidence layer</strong>
            <p>Future Earth Engine signals join the graph only after partner-reviewed calibration.</p>
          </article>
        </div>
      </section>

      <SiteFooter />

      <button
        className={`assistant-launcher ${chatOpen ? "is-open" : ""}`}
        onClick={() => setChatOpen((current) => !current)}
        aria-label="Open VerdaTrace Assistant"
      >
        <MessageCircle size={20} />
        <span>Ask VerdaTrace</span>
      </button>

      {chatOpen && (
        <aside className="assistant-drawer" aria-label="VerdaTrace Assistant">
          <header>
            <div>
              <span><Sparkles size={14} /></span>
              <div>
                <strong>VerdaTrace Assistant</strong>
                <small><i /> Project-aware · source-grounded</small>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} aria-label="Close assistant">
              <X size={17} />
            </button>
          </header>
          <div className="assistant-messages">
            {chatMessages.map((message, index) => (
              <div className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}>
                {message.role === "assistant" ? (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : (
                  message.content
                )}
              </div>
            ))}
            {chatSending && (
              <div className="assistant-message assistant thinking">
                <span className="spinner" /> Reviewing the project record…
              </div>
            )}
          </div>
          <div className="assistant-quick">
            {[
              "What needs attention first?",
              "Explain the 9.54 ha amendment.",
              "Which evidence is missing?",
            ].map((prompt) => (
              <button key={prompt} onClick={() => void askAssistant(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void askAssistant(chatInput);
            }}
          >
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask about an obligation, source, gap, or task…"
              maxLength={1500}
              rows={2}
            />
            <button disabled={!chatInput.trim() || chatSending} aria-label="Send question">
              <Send size={16} />
            </button>
          </form>
          <small className="assistant-boundary">
            Answers support expert review and are not legal determinations.
          </small>
        </aside>
      )}

      {uploadOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setUploadOpen(false)}
        >
          <section
            className="upload-modal demo-upload-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close upload"
              onClick={() => setUploadOpen(false)}
            >
              <X size={19} />
            </button>
            <div className="modal-icon">
              <Sparkles size={20} />
            </div>
            <span className="modal-kicker">VerdaTrace document intelligence</span>
            <h2 id="upload-title">Turn documents into cited obligations</h2>
            <p>
              Our multimodal intelligence reads documents and images, then
              returns structured, source-linked obligations. Files are limited
              to 15 MB. Original files are not retained; extracted workspace
              context is saved only in this browser.
            </p>
            <div className={`demo-limit-note ${isAdmin ? "admin" : ""}`}>
              <span>{isAdmin ? "AR" : "DR"}</span>
              <div>
                <strong>{isAdmin ? "Admin reviewer" : "Demo reviewer"}</strong>
                <small>
                  {isAdmin
                    ? "Authenticated session · unlimited live analysis."
                    : `${demoRemaining} of 3 live analyses remain this hour.`}
                </small>
              </div>
              <ShieldCheck size={16} />
            </div>
            <form onSubmit={analyzeDocument}>
              <label className={`dropzone ${selectedFile ? "has-file" : ""}`}>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.rtf,.txt,.csv,.json,.md,.png,.jpg,.jpeg,.webp,.tif,.tiff,application/pdf,application/msword,application/rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,image/*"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null);
                    setAnalysisError("");
                    setAnalysis(null);
                  }}
                />
                {selectedFile ? <FileCheck2 size={28} /> : <Upload size={28} />}
                <strong>
                  {selectedFile
                    ? selectedFile.name
                    : "Choose a document or image"}
                </strong>
                <span>
                  {selectedFile
                    ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                    : "Documents, scans, photos, and structured files · 15 MB"}
                </span>
              </label>
              {analysisError && (
                <div className="analysis-message error">
                  <CircleAlert size={16} /> {analysisError}
                </div>
              )}
              {analysis && (
                <div className="analysis-message success">
                  <CheckCircle2 size={16} />
                  Extracted {analysis.obligations.length} cited obligations in{" "}
                  {(analysis.processingMs / 1000).toFixed(1)} seconds.
                </div>
              )}
              <button
                className="primary-button modal-submit"
                disabled={isAnalyzing || !selectedFile}
              >
                {isAnalyzing ? (
                  <>
                    <span className="spinner" /> Resolving obligations…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Analyze with VerdaTrace
                  </>
                )}
              </button>
            </form>
            <div className="privacy-line">
              <ShieldCheck size={14} /> Device-local workspace memory · human
              approval required
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const SPATIAL_STORAGE_KEY = "verdatrace.demo.spatial.v1";

function collectCoordinatePairs(
  value: unknown,
  pairs: Array<[number, number]>,
) {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    pairs.push([value[0], value[1]]);
    return;
  }
  value.forEach((item) => collectCoordinatePairs(item, pairs));
}

async function parseSpatialGeometry(
  file: File,
): Promise<SpatialGeometryMetadata> {
  if (file.size === 0 || file.size > 3 * 1024 * 1024) {
    throw new Error("Geometry files must be between 1 byte and 3 MB.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["geojson", "json", "kml"].includes(extension ?? "")) {
    throw new Error("Use a GeoJSON, JSON, or KML boundary file.");
  }

  const source = await file.text();
  const pairs: Array<[number, number]> = [];
  let featureCount = 0;
  const geometryTypes = new Set<string>();

  if (extension === "kml") {
    const document = new DOMParser().parseFromString(
      source,
      "application/xml",
    );
    if (document.querySelector("parsererror")) {
      throw new Error("The KML file could not be parsed.");
    }
    const geometries = [
      ...document.querySelectorAll("Polygon, MultiGeometry, LineString"),
    ];
    featureCount = Math.max(1, geometries.length);
    geometries.forEach((node) => geometryTypes.add(node.tagName));
    document.querySelectorAll("coordinates").forEach((node) => {
      node.textContent
        ?.trim()
        .split(/\s+/)
        .forEach((coordinate) => {
          const [longitude, latitude] = coordinate
            .split(",")
            .map(Number);
          if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
            pairs.push([longitude, latitude]);
          }
        });
    });
  } else {
    let data: unknown;
    try {
      data = JSON.parse(source);
    } catch {
      throw new Error("The GeoJSON file contains invalid JSON.");
    }
    if (!data || typeof data !== "object") {
      throw new Error("The GeoJSON boundary is empty.");
    }
    const root = data as {
      type?: string;
      features?: Array<{
        geometry?: { type?: string; coordinates?: unknown } | null;
      }>;
      geometry?: { type?: string; coordinates?: unknown } | null;
      coordinates?: unknown;
    };
    if (root.type === "FeatureCollection" && Array.isArray(root.features)) {
      featureCount = root.features.length;
      root.features.forEach((feature) => {
        if (feature.geometry?.type) geometryTypes.add(feature.geometry.type);
        collectCoordinatePairs(feature.geometry?.coordinates, pairs);
      });
    } else if (root.type === "Feature" && root.geometry) {
      featureCount = 1;
      if (root.geometry.type) geometryTypes.add(root.geometry.type);
      collectCoordinatePairs(root.geometry.coordinates, pairs);
    } else if (root.type && root.coordinates) {
      featureCount = 1;
      geometryTypes.add(root.type);
      collectCoordinatePairs(root.coordinates, pairs);
    } else {
      throw new Error(
        "The file must contain a GeoJSON Feature, FeatureCollection, or geometry.",
      );
    }
  }

  if (featureCount < 1 || pairs.length < 4) {
    throw new Error("No usable parcel boundary coordinates were found.");
  }
  const invalidPair = pairs.find(
    ([longitude, latitude]) =>
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90,
  );
  if (invalidPair) {
    throw new Error("The boundary contains coordinates outside valid bounds.");
  }
  const longitudes = pairs.map(([longitude]) => longitude);
  const latitudes = pairs.map(([, latitude]) => latitude);

  return {
    fileName: file.name,
    geometryType: [...geometryTypes].join(" + ") || "Boundary",
    featureCount,
    coordinateCount: pairs.length,
    bbox: [
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes),
    ],
  };
}

function DynamicWorldScreen({
  isExporting,
  onExport,
  onQueueTasks,
}: {
  isExporting: boolean;
  onExport: () => void;
  onQueueTasks: (tasks: InspectionTask[]) => void;
}) {
  const [selectedYear, setSelectedYear] = useState<"baseline" | "current">(
    "current",
  );
  const [geometry, setGeometry] =
    useState<SpatialGeometryMetadata | null>(null);
  const [geometryError, setGeometryError] = useState("");
  const [spatialQuestion, setSpatialQuestion] = useState(
    "Interpret the land-cover change and recommend the safest next review actions.",
  );
  const [spatialInsight, setSpatialInsight] =
    useState<SpatialInsight | null>(null);
  const [spatialError, setSpatialError] = useState("");
  const [spatialRunning, setSpatialRunning] = useState(false);
  const [tasksQueued, setTasksQueued] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SPATIAL_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        selectedYear?: "baseline" | "current";
        geometry?: SpatialGeometryMetadata | null;
        spatialQuestion?: string;
        spatialInsight?: SpatialInsight | null;
        tasksQueued?: boolean;
      };
      if (
        parsed.selectedYear === "baseline" ||
        parsed.selectedYear === "current"
      ) {
        setSelectedYear(parsed.selectedYear);
      }
      if (parsed.geometry?.fileName && Array.isArray(parsed.geometry.bbox)) {
        setGeometry(parsed.geometry);
      }
      if (typeof parsed.spatialQuestion === "string") {
        setSpatialQuestion(parsed.spatialQuestion.slice(0, 800));
      }
      if (parsed.spatialInsight?.headline) {
        setSpatialInsight(parsed.spatialInsight);
      }
      setTasksQueued(Boolean(parsed.tasksQueued));
    } catch {
      // Start with the bundled spatial example if storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          SPATIAL_STORAGE_KEY,
          JSON.stringify({
            selectedYear,
            geometry,
            spatialQuestion,
            spatialInsight,
            tasksQueued,
          }),
        );
      } catch {
        // Keep the spatial workspace in memory when storage is unavailable.
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [
    geometry,
    selectedYear,
    spatialInsight,
    spatialQuestion,
    tasksQueued,
  ]);

  const year =
    selectedYear === "baseline"
      ? dynamicWorldEvidence.baselineYear
      : dynamicWorldEvidence.currentYear;
  const valueKey = selectedYear === "baseline" ? "baseline" : "current";
  const tree = dynamicWorldEvidence.classes.find(
    (item) => item.id === "tree",
  )!;
  const built = dynamicWorldEvidence.classes.find(
    (item) => item.id === "built",
  )!;

  const handleGeometry = async (file: File | null) => {
    if (!file) return;
    setGeometryError("");
    setSpatialError("");
    setSpatialInsight(null);
    setTasksQueued(false);
    try {
      setGeometry(await parseSpatialGeometry(file));
    } catch (error) {
      setGeometry(null);
      setGeometryError(
        error instanceof Error ? error.message : "Geometry validation failed.",
      );
    }
  };

  const runSpatialReview = async (event?: FormEvent) => {
    event?.preventDefault();
    setSpatialRunning(true);
    setSpatialError("");
    setTasksQueued(false);
    try {
      const response = await fetch("/api/spatial-insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: spatialQuestion,
          parcelLabel: dynamicWorldEvidence.parcelLabel,
          baselineYear: dynamicWorldEvidence.baselineYear,
          currentYear: dynamicWorldEvidence.currentYear,
          confidence: dynamicWorldEvidence.confidence,
          classes: dynamicWorldEvidence.classes.map((item) => ({
            label: item.label,
            baseline: item.baseline,
            current: item.current,
          })),
          geometry,
        }),
      });
      const result = (await response.json()) as SpatialInsight & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Spatial review failed.");
      }
      setSpatialInsight(result);
    } catch (error) {
      setSpatialError(
        error instanceof Error
          ? error.message
          : "Spatial intelligence could not complete the review.",
      );
    } finally {
      setSpatialRunning(false);
    }
  };

  const queueSpatialTasks = () => {
    if (!spatialInsight) return;
    const location = geometry
      ? `Uploaded boundary · ${geometry.fileName}`
      : "Project parcel boundary required";
    const tasks = spatialInsight.actions.map<InspectionTask>((action, index) => ({
      id: `spatial-ai-${index + 1}-${action.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`,
      priority: action.priority,
      title: action.title,
      location,
      requiredEvidence: action.requiredEvidence,
      rationale: action.rationale,
      safetyNote:
        "Confirm land access, field safety, and expert approval before collection.",
      obligationIds: [],
    }));
    setTasksQueued(true);
    onQueueTasks(tasks);
  };

  return (
    <section className="demo-spatial-stage" id="spatial-intelligence">
      <div className="demo-spatial-heading">
        <div>
          <span>Screen 02 · Spatial evidence</span>
          <h2>See what changed around every documented parcel.</h2>
          <p>
            Dynamic World turns annual land-cover composition into explainable
            evidence that can be reviewed beside the governing obligation.
          </p>
        </div>
        <div className="demo-spatial-status">
          <span>
            <Satellite size={14} /> Dynamic World layer
          </span>
          <strong>
            <i /> AI review available
          </strong>
        </div>
      </div>

      <div className="dw-workspace">
        <header className="dw-toolbar">
          <div>
            <span className="dw-product-mark">
              <Layers3 size={16} />
            </span>
            <div>
              <strong>Land-cover change evidence</strong>
              <small>{dynamicWorldEvidence.parcelLabel}</small>
            </div>
          </div>
          <div className="dw-year-switch" aria-label="Comparison year">
            <button
              className={selectedYear === "baseline" ? "active" : ""}
              onClick={() => setSelectedYear("baseline")}
            >
              Baseline · {dynamicWorldEvidence.baselineYear}
            </button>
            <button
              className={selectedYear === "current" ? "active" : ""}
              onClick={() => setSelectedYear("current")}
            >
              Current · {dynamicWorldEvidence.currentYear}
            </button>
          </div>
        </header>

        <div className="dw-main-grid">
          <aside className="dw-composition">
            <div className="dw-panel-title">
              <span>Parcel composition</span>
              <strong>{year} annual composite</strong>
            </div>
            <div className="dw-class-list">
              {dynamicWorldEvidence.classes.map((item) => {
                const value = item[valueKey];
                const delta = item.current - item.baseline;
                return (
                  <article key={item.id}>
                    <div>
                      <i style={{ background: item.color }} />
                      <span>{item.label}</span>
                      <strong>{value.toFixed(1)}%</strong>
                    </div>
                    <div className="dw-class-track">
                      <span
                        style={{
                          width: `${value}%`,
                          background: item.color,
                        }}
                      />
                    </div>
                    <small
                      className={
                        selectedYear === "current"
                          ? delta > 0
                            ? "increase"
                            : "decrease"
                          : ""
                      }
                    >
                      {selectedYear === "current"
                        ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pp vs baseline`
                        : "Baseline reference"}
                    </small>
                  </article>
                );
              })}
            </div>
            <div className="dw-confidence">
              <div>
                <SlidersHorizontal size={14} />
                <span>
                  <strong>Layer confidence</strong>
                  <small>Confidence-aware display</small>
                </span>
              </div>
              <strong>
                {Math.round(dynamicWorldEvidence.confidence * 100)}%
              </strong>
            </div>
            <label className={`dw-geometry-upload ${geometry ? "ready" : ""}`}>
              <input
                type="file"
                accept=".geojson,.json,.kml,application/geo+json,application/json,application/vnd.google-earth.kml+xml"
                onChange={(event) =>
                  void handleGeometry(event.target.files?.[0] ?? null)
                }
              />
              {geometry ? (
                <FileCheck2 size={16} />
              ) : (
                <UploadCloud size={16} />
              )}
              <span>
                <strong>
                  {geometry ? "Boundary validated" : "Attach parcel boundary"}
                </strong>
                <small>
                  {geometry
                    ? `${geometry.geometryType} · ${geometry.coordinateCount} vertices`
                    : "GeoJSON or KML · processed locally"}
                </small>
              </span>
              <ArrowRight size={13} />
            </label>
            {geometryError && (
              <p className="dw-inline-error">
                <CircleAlert size={12} /> {geometryError}
              </p>
            )}
          </aside>

          <div
            className={`dw-map dw-map-${selectedYear}`}
            aria-label={`Illustrative ${year} Dynamic World land-cover map`}
          >
            <div className="dw-map-grid" />
            <span className="dw-zone dw-zone-tree-one" />
            <span className="dw-zone dw-zone-tree-two" />
            <span className="dw-zone dw-zone-shrub" />
            <span className="dw-zone dw-zone-bare" />
            <span className="dw-zone dw-zone-built" />
            <span className="dw-road dw-road-one" />
            <span className="dw-road dw-road-two" />
            <div className="dw-parcel">
              <span>{geometry ? "Geometry validated" : "Illustrative parcel"}</span>
              <small>
                {geometry
                  ? `Map remains illustrative · ${geometry.featureCount} feature${geometry.featureCount === 1 ? "" : "s"} parsed`
                  : "Boundary required before operational use"}
              </small>
            </div>
            <div className="dw-map-meta">
              <span>
                <i /> {year} selected
              </span>
              <span>10 m class probabilities</span>
            </div>
            <div className="dw-map-legend">
              {dynamicWorldEvidence.classes.map((item) => (
                <span key={item.id}>
                  <i style={{ background: item.color }} />
                  {item.label.replace(" cover", "")}
                </span>
              ))}
            </div>
          </div>

          <aside className="dw-change-panel">
            <div className="dw-panel-title">
              <span>Baseline vs current</span>
              <strong>Change evidence</strong>
            </div>
            <article className="dw-change-card primary">
              <TreePine size={17} />
              <span>Tree-cover change</span>
              <strong>
                {(tree.current - tree.baseline).toFixed(1)} pp
              </strong>
              <small>
                {tree.baseline}% → {tree.current}%
              </small>
            </article>
            <article className="dw-change-card">
              <Building2 size={17} />
              <span>Built-area change</span>
              <strong>+{(built.current - built.baseline).toFixed(1)} pp</strong>
              <small>
                {built.baseline}% → {built.current}%
              </small>
            </article>
            <div className="dw-review-signal">
              <Radar size={16} />
              <div>
                <strong>Expert review suggested</strong>
                <p>
                  Compare the signal with field evidence and the current
                  obligation before planning an inspection.
                </p>
              </div>
            </div>
            <div className="dw-report-ready">
              <CheckCircle2 size={15} />
              <span>
                <strong>Report ready</strong>
                Change evidence is included in the branded export.
              </span>
            </div>
            <button
              className="dw-export-button"
              onClick={onExport}
              disabled={isExporting}
            >
              <Download size={14} />
              {isExporting ? "Building report…" : "Export spatial evidence"}
            </button>
          </aside>
        </div>

        <section className="dw-ai-workbench">
          <form className="dw-ai-controls" onSubmit={runSpatialReview}>
            <div className="dw-ai-title">
              <span>
                <Sparkles size={15} />
              </span>
              <div>
                <strong>VerdaTrace spatial intelligence</strong>
                <small>
                  Bounded interpretation · evidence actions · human approval
                </small>
              </div>
            </div>
            <label>
              <span>Ask about this land-cover signal</span>
              <textarea
                value={spatialQuestion}
                onChange={(event) =>
                  setSpatialQuestion(event.target.value.slice(0, 800))
                }
                rows={3}
                placeholder="Ask for an interpretation or a verification plan…"
              />
            </label>
            <div className="dw-ai-prompts">
              {[
                "What should be verified first?",
                "Explain the tree-cover change.",
                "Create a desk-to-field review plan.",
              ].map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => setSpatialQuestion(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <button
              className="dw-ai-run"
              disabled={spatialRunning || spatialQuestion.trim().length < 2}
            >
              {spatialRunning ? (
                <>
                  <span className="spinner" /> Interpreting evidence…
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Run spatial review
                </>
              )}
            </button>
            {spatialError && (
              <p className="dw-inline-error">
                <CircleAlert size={12} /> {spatialError}
              </p>
            )}
          </form>

          <div className="dw-ai-output" aria-live="polite">
            {spatialInsight ? (
              <>
                <header>
                  <span
                    className={`dw-risk-signal ${spatialInsight.riskSignal}`}
                  >
                    <i />
                    {spatialInsight.riskSignal.replace("_", " ")}
                  </span>
                  <small>Generated from the visible comparison</small>
                </header>
                <h3>{spatialInsight.headline}</h3>
                <p>{spatialInsight.answer}</p>
                <div className="dw-confidence-summary">
                  <ShieldCheck size={14} />
                  <span>{spatialInsight.confidenceSummary}</span>
                </div>
                <div className="dw-ai-actions">
                  <span>Suggested review actions</span>
                  {spatialInsight.actions.map((action) => (
                    <article key={`${action.priority}-${action.title}`}>
                      <strong>P{action.priority}</strong>
                      <div>
                        <h4>{action.title}</h4>
                        <p>{action.rationale}</p>
                        <small>{action.requiredEvidence.join(" · ")}</small>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="dw-evidence-boundary">
                  <CircleAlert size={14} />
                  <p>{spatialInsight.evidenceBoundary}</p>
                </div>
                <button
                  className="dw-queue-button"
                  onClick={queueSpatialTasks}
                  disabled={tasksQueued}
                >
                  <ClipboardCheck size={15} />
                  {tasksQueued
                    ? "Added to inspection plan"
                    : "Add actions to inspection plan"}
                </button>
              </>
            ) : (
              <div className="dw-ai-empty">
                <Radar size={29} />
                <strong>Ready to interpret the change signal</strong>
                <p>
                  Run the spatial review to generate a bounded explanation,
                  confidence statement, and editable evidence-collection tasks.
                </p>
                <div>
                  <span>
                    <Check size={11} /> No automated legal verdict
                  </span>
                  <span>
                    <Check size={11} /> No fabricated field evidence
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="dw-disclaimer">
          <CircleAlert size={14} />
          <span>{dynamicWorldEvidence.disclaimer}</span>
        </footer>
      </div>

      <section className="alphaearth-preview" aria-label="AlphaEarth preview">
        <div className="alphaearth-copy">
          <span>
            <Sparkles size={13} /> Coming next
          </span>
          <h3>AlphaEarth similarity intelligence.</h3>
          <p>
            Annual parcel embeddings will retrieve comparable landscapes,
            quantify year-to-year similarity, and rank anomalies for inspection
            after expert calibration.
          </p>
          <div className="alphaearth-capabilities">
            <span>Annual embeddings</span>
            <span>Comparable-site retrieval</span>
            <span>Anomaly ranking</span>
          </div>
        </div>
        <div className="alphaearth-visual" aria-hidden="true">
          <div className="ae-orbit ae-orbit-one" />
          <div className="ae-orbit ae-orbit-two" />
          <span className="ae-node ae-node-one">2022</span>
          <span className="ae-node ae-node-two">2023</span>
          <span className="ae-node ae-node-three">2024</span>
          <div className="ae-core">
            <Leaf size={22} />
            <strong>Parcel embedding</strong>
            <small>64-dimensional annual signal</small>
          </div>
          <div className="ae-similarity">
            <BarChart3 size={15} />
            <span>
              <small>Cosine similarity</small>
              <strong>Calibration pending</strong>
            </span>
          </div>
        </div>
      </section>

      <section className="demo-pilot-cta" id="pilot">
        <div>
          <span>Design partner program</span>
          <h3>Bring one real project. Leave with a traceable review.</h3>
          <p>
            We are opening a limited set of partner pilots for consultants,
            project teams, and restoration organisations across APAC.
          </p>
        </div>
        <a href="/contact">
          Request a pilot <ArrowRight size={16} />
        </a>
      </section>
    </section>
  );
}

const suggestionsByTab: Record<
  Tab,
  Array<{ action: string; title: string; prompt: string }>
> = {
  overview: [
    {
      action: "missing",
      title: "Review priority evidence gaps",
      prompt: "Which missing evidence should be reviewed first, and why?",
    },
    {
      action: "revision",
      title: "Inspect the material amendment",
      prompt: "Explain the amendment relationship for the 9.54 hectare parcel.",
    },
    {
      action: "ask",
      title: "Summarize project risk",
      prompt: "Give me a concise, source-grounded project risk summary.",
    },
  ],
  ledger: [
    {
      action: "missing",
      title: "Show unresolved obligations",
      prompt: "Which obligations are unresolved?",
    },
    {
      action: "inspection",
      title: "Turn gaps into field tasks",
      prompt: "How should the unresolved obligations shape the inspection plan?",
    },
    {
      action: "ask",
      title: "Explain the current ledger",
      prompt: "Summarize the active obligation ledger with the most important citations.",
    },
  ],
  revisions: [
    {
      action: "ask",
      title: "Explain supersession reasoning",
      prompt: "Why is the May condition superseded rather than simultaneously active?",
    },
    {
      action: "documents",
      title: "Open amendment sources",
      prompt: "Which documents support the amendment relationship?",
    },
    {
      action: "inspection",
      title: "Check the amended parcel",
      prompt: "What evidence should be collected for the amended 9.54 hectare parcel?",
    },
  ],
  inspection: [
    {
      action: "ask",
      title: "Brief the field team",
      prompt: "Create a short field briefing from the current inspection priorities.",
    },
    {
      action: "missing",
      title: "Trace tasks to gaps",
      prompt: "Trace the inspection tasks back to their missing-evidence obligations.",
    },
    {
      action: "documents",
      title: "Prepare source pack",
      prompt: "Which source documents should accompany the inspection team?",
    },
  ],
  documents: [
    {
      action: "ask",
      title: "Summarize source lineage",
      prompt: "Summarize the project source lineage and any important limitations.",
    },
    {
      action: "revision",
      title: "Compare approval and amendment",
      prompt: "Compare the final approval with the later amendment.",
    },
    {
      action: "missing",
      title: "Find unsupported findings",
      prompt: "Which current findings still lack adequate evidence?",
    },
  ],
  agent: [
    {
      action: "missing",
      title: "Open priority gaps",
      prompt: "Open the obligation ledger and show missing-evidence obligations.",
    },
    {
      action: "inspection",
      title: "Open inspection plan",
      prompt: "Open the inspection plan and explain the highest-priority task.",
    },
    {
      action: "export",
      title: "Generate full report",
      prompt: "Generate the complete branded project report.",
    },
  ],
};

function AssistantSuggestions({
  tab,
  onAction,
}: {
  tab: Tab;
  onAction: (action: string, prompt: string) => void;
}) {
  return (
    <section className="assistant-suggestions" aria-label="Assistant suggestions">
      <div>
        <span><Lightbulb size={14} /></span>
        <p>
          <strong>VerdaTrace suggestions</strong>
          Context-aware next steps for this workspace
        </p>
      </div>
      <div>
        {suggestionsByTab[tab].map((suggestion) => (
          <button
            key={suggestion.title}
            onClick={() => onAction(suggestion.action, suggestion.prompt)}
          >
            {suggestion.title} <ArrowRight size={12} />
          </button>
        ))}
      </div>
    </section>
  );
}

function AgentTab({
  messages,
  input,
  setInput,
  sending,
  ask,
  activity,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  ask: (question: string) => Promise<void>;
  activity: string[];
}) {
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const voiceRequestStartRef = useRef(0);
  const shouldSpeakResponseRef = useRef(false);

  const prompts = [
    "Show only missing-evidence obligations.",
    "Open the amendment graph and explain the current duty.",
    "Take me to the highest-priority inspection tasks.",
    "Open document upload.",
    "Generate the complete project report.",
  ];

  useEffect(() => {
    const browserWindow = window as typeof window & {
      SpeechRecognition?: VoiceRecognitionConstructor;
      webkitSpeechRecognition?: VoiceRecognitionConstructor;
    };
    const supportCheck = window.requestAnimationFrame(() => {
      setVoiceSupported(
        Boolean(
          browserWindow.SpeechRecognition ??
            browserWindow.webkitSpeechRecognition,
        ) && "speechSynthesis" in window,
      );
    });

    return () => {
      window.cancelAnimationFrame(supportCheck);
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (
      !shouldSpeakResponseRef.current ||
      sending ||
      messages.length <= voiceRequestStartRef.current
    ) {
      return;
    }
    const latest = messages[messages.length - 1];
    if (latest?.role !== "assistant" || !("speechSynthesis" in window)) return;

    shouldSpeakResponseRef.current = false;
    window.speechSynthesis.cancel();
    const spokenReply = new SpeechSynthesisUtterance(latest.content);
    spokenReply.rate = 0.98;
    spokenReply.pitch = 1;
    spokenReply.onstart = () => setVoiceState("speaking");
    spokenReply.onend = () => setVoiceState("idle");
    spokenReply.onerror = () => {
      setVoiceState("error");
      setVoiceError("The response is ready in chat, but audio playback failed.");
    };
    window.speechSynthesis.speak(spokenReply);
  }, [messages, sending]);

  const startVoiceCommand = () => {
    if (voiceState === "speaking") {
      window.speechSynthesis.cancel();
      setVoiceState("idle");
      return;
    }
    if (voiceState === "listening") {
      recognitionRef.current?.stop();
      setVoiceState("idle");
      return;
    }

    const browserWindow = window as typeof window & {
      SpeechRecognition?: VoiceRecognitionConstructor;
      webkitSpeechRecognition?: VoiceRecognitionConstructor;
    };
    const Recognition =
      browserWindow.SpeechRecognition ??
      browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceState("error");
      setVoiceError("Voice recognition is not available in this browser.");
      return;
    }

    setVoiceError("");
    let submitted = false;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-IN";
    recognition.onstart = () => setVoiceState("listening");
    recognition.onresult = (event) => {
      let transcript = "";
      let finalTranscript = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";
        transcript += text;
        if (result.isFinal) finalTranscript += text;
      }
      if (transcript.trim()) setInput(transcript.trim());
      if (finalTranscript.trim() && !submitted) {
        submitted = true;
        const command = finalTranscript.trim();
        setVoiceState("processing");
        voiceRequestStartRef.current = messages.length;
        shouldSpeakResponseRef.current = true;
        void ask(command);
      }
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setVoiceState("error");
      setVoiceError(
        event.error === "not-allowed"
          ? "Microphone access is blocked. Allow it in your browser settings."
          : "I could not hear a command. Tap the microphone and try again.",
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceState((current) =>
        current === "listening" ? "idle" : current,
      );
    };
    recognition.start();
  };

  const voiceLabel = {
    idle: "Voice mode",
    listening: "Listening…",
    processing: "Working…",
    speaking: "Speaking…",
    error: "Try voice again",
  }[voiceState];

  return (
    <div className="tab-stack agent-tab">
      <div className="content-header agent-tab-header">
        <div>
          <span>Agent workspace</span>
          <h3>Ask. Investigate. Act across the project.</h3>
        </div>
        <div className="agent-mode">
          <i /> Controlled action mode
        </div>
      </div>

      <div className="agent-capabilities">
        <article>
          <PanelLeft size={16} />
          <div>
            <strong>Navigate</strong>
            <span>Open any project workspace</span>
          </div>
        </article>
        <article>
          <Search size={16} />
          <div>
            <strong>Investigate</strong>
            <span>Search, filter, and explain findings</span>
          </div>
        </article>
        <article>
          <UploadCloud size={16} />
          <div>
            <strong>Operate</strong>
            <span>Start uploads and generate reports</span>
          </div>
        </article>
        <article>
          <ShieldCheck size={16} />
          <div>
            <strong>Respect controls</strong>
            <span>Reviewer decisions stay human-confirmed</span>
          </div>
        </article>
      </div>

      <div className="agent-console">
        <section className="agent-conversation">
          <header>
            <div className="agent-identity">
              <span><Sparkles size={15} /></span>
              <div>
                <strong>VerdaTrace Agent</strong>
                <small>Project context connected</small>
              </div>
            </div>
            <div className="agent-header-actions">
              <span className="agent-context-chip">
                FP/KA/ROAD/7440/2014
              </span>
              <button
                type="button"
                className={`agent-voice-mode voice-${voiceState}`}
                onClick={startVoiceCommand}
                disabled={!voiceSupported || voiceState === "processing"}
                aria-label={
                  voiceState === "listening"
                    ? "Stop listening"
                    : "Start voice mode"
                }
                aria-pressed={voiceState === "listening"}
                title={
                  voiceSupported
                    ? "Speak a command and hear the response"
                    : "Voice mode is unavailable in this browser"
                }
              >
                <span className="agent-voice-icon" aria-hidden="true">
                  {voiceSupported ? <Mic size={15} /> : <MicOff size={15} />}
                  <i />
                </span>
                <span>
                  <strong>{voiceLabel}</strong>
                  <small>
                    {voiceState === "listening"
                      ? "Speak your project command"
                      : voiceState === "speaking"
                        ? "Tap to stop audio"
                        : "Ask and act hands-free"}
                  </small>
                </span>
                <span className="agent-voice-wave" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </button>
            </div>
          </header>
          {voiceError && (
            <div className="agent-voice-error" role="status">
              <CircleAlert size={13} /> {voiceError}
            </div>
          )}
          <div className="agent-thread">
            {messages.map((message, index) => (
              <div
                className={`agent-thread-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.role === "assistant" ? (
                  <>
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                    {message.actions && message.actions.length > 0 && (
                      <div className="agent-action-results">
                        {message.actions.map((action, actionIndex) => (
                          <span key={`${action.type}-${actionIndex}`}>
                            <CheckCircle2 size={12} /> {action.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  message.content
                )}
              </div>
            ))}
            {sending && (
              <div className="agent-thread-message assistant thinking">
                <span className="spinner" /> Resolving the request and checking
                allowed actions…
              </div>
            )}
          </div>
          <div className="agent-prompt-chips">
            {prompts.map((prompt) => (
              <button key={prompt} onClick={() => void ask(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <form
            className="agent-command-form"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
          >
            <Sparkles size={17} />
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about the project or tell the agent what to do…"
              maxLength={1500}
              rows={2}
            />
            <button disabled={!input.trim() || sending}>
              <Send size={16} /> Run
            </button>
          </form>
        </section>

        <aside className="agent-run-log">
          <header>
            <span>Action history</span>
            <strong>{activity.length} executed</strong>
          </header>
          {activity.length ? (
            <ol>
              {activity.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <span><Check size={11} /></span>
                  <div>
                    <strong>{item}</strong>
                    <small>Completed in this session</small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="agent-log-empty">
              <Bot size={22} />
              <strong>No actions yet</strong>
              <p>
                Ask the agent to open, filter, search, upload, or export.
              </p>
            </div>
          )}
          <div className="agent-control-note">
            <ShieldCheck size={15} />
            <p>
              The agent uses a fixed action allowlist. Approval and legal
              decisions cannot be executed automatically.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function OverviewTab({
  counts,
  coverage,
  activeCount,
  setTab,
  approved,
}: {
  counts: Record<AssessmentStatus, number>;
  coverage: number;
  activeCount: number;
  setTab: (tab: Tab) => void;
  approved: number;
}) {
  const amendment = revisions[0];
  const replacement = demoObligations.find(
    (item) => item.id === amendment.replacementObligationId,
  )!;
  return (
    <div className="tab-stack">
      <div className="content-header">
        <div>
          <span>Project overview</span>
          <h3>Evidence coverage at a glance</h3>
        </div>
        <div className="as-of">
          <Clock3 size={14} /> Public record set
        </div>
      </div>
      <div className="metric-grid demo-metric-grid">
        <article>
          <span>Active obligations</span>
          <strong>{activeCount}</strong>
          <small>across 10 evidence categories</small>
        </article>
        <article>
          <span>Evidence coverage</span>
          <strong>{coverage}%</strong>
          <small>partial evidence weighted at 50%</small>
        </article>
        <article className="warning">
          <span>Priority gaps</span>
          <strong>{counts.missing_evidence}</strong>
          <small>ranked for desk or field review</small>
        </article>
        <article>
          <span>Expert approvals</span>
          <strong>{approved}</strong>
          <small>saved locally on this device</small>
        </article>
      </div>
      <div className="overview-grid demo-overview-grid">
        <section className="panel coverage-panel">
          <div className="panel-heading">
            <div>
              <span>Coverage by state</span>
              <h4>Where attention is needed</h4>
            </div>
            <button onClick={() => setTab("ledger")}>
              View ledger <ArrowRight size={14} />
            </button>
          </div>
          <div
            className="coverage-bar"
            aria-label={`${coverage}% evidence coverage`}
          >
            <span
              className="verified"
              style={{
                width: `${(counts.verified / demoObligations.length) * 100}%`,
              }}
            />
            <span
              className="partial"
              style={{
                width: `${(counts.partial / demoObligations.length) * 100}%`,
              }}
            />
            <span
              className="review"
              style={{
                width: `${(counts.expert_review / demoObligations.length) * 100}%`,
              }}
            />
            <span className="missing" style={{ flex: 1 }} />
          </div>
          <div className="coverage-legend">
            {statusOrder.slice(0, 5).map((status) => (
              <div key={status}>
                <StatusPill status={status} />
                <strong>{counts[status]}</strong>
              </div>
            ))}
          </div>
          <div className="coverage-insight">
            <Activity size={16} />
            <p>
              <strong>Review signal:</strong> evidence gaps cluster around
              spatial proof, habitat actions, and recurring monitoring.
            </p>
          </div>
        </section>
        <section className="panel map-panel demo-map-panel">
          <div className="panel-heading">
            <div>
              <span>Spatial evidence</span>
              <h4>Documented project location</h4>
            </div>
            <span className="map-ready">
              <i /> Map active
            </span>
          </div>
          <CaseMap />
          <div className="map-signal-row">
            <span>
              <MapPin size={13} /> Approximate point
            </span>
            <span>
              <Layers3 size={13} /> Parcel geometry missing
            </span>
          </div>
        </section>
      </div>
      <section className="panel amendment-panel demo-amendment-panel">
        <div className="amendment-label">
          <GitCompareArrows size={16} /> Material amendment detected
        </div>
        <div className="amendment-copy">
          <div>
            <span>Superseded · May 2025, Condition 2</span>
            <p>Raise compensatory afforestation over 9.54 ha of non-forest land.</p>
          </div>
          <ArrowRight size={20} />
          <div className="current">
            <span>Current · September 2025, Condition 2</span>
            <p>{replacement.requirement}</p>
          </div>
        </div>
        <button onClick={() => setTab("revisions")}>
          Inspect revision reasoning <ArrowRight size={13} />
        </button>
      </section>
    </div>
  );
}

function LedgerTab({
  obligations,
  allCount,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  toggleReviewer,
}: {
  obligations: Obligation[];
  allCount: number;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: AssessmentStatus | "all";
  setStatusFilter: (value: AssessmentStatus | "all") => void;
  toggleReviewer: (id: string) => void;
}) {
  return (
    <div className="tab-stack">
      <div className="content-header">
        <div>
          <span>Obligation ledger</span>
          <h3>Every finding traceable to source</h3>
        </div>
        <div className="citation-score">
          <ShieldCheck size={14} /> 100% cited
        </div>
      </div>
      <div className="ledger-tools">
        <label>
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search clause, category, requirement…"
          />
        </label>
        <label className="filter-select">
          <Filter size={15} />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as AssessmentStatus | "all")
            }
          >
            <option value="all">All statuses</option>
            {statusOrder.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="ledger-summary">
        Showing {obligations.length} of {allCount} obligations
      </div>
      <div className="ledger-list">
        {obligations.map((obligation) => (
          <article
            className={`ledger-row ${
              obligation.status === "superseded" ? "is-superseded" : ""
            }`}
            key={obligation.id}
          >
            <div className="ledger-main">
              <div className="ledger-topline">
                <span className="clause">{obligation.clause}</span>
                <span className="category">{obligation.category}</span>
                <StatusPill status={obligation.status} />
              </div>
              <h4>{obligation.requirement}</h4>
              <div className="ledger-meta">
                <span>
                  <strong>Owner</strong> {obligation.responsibleParty}
                </span>
                {obligation.quantity !== null && (
                  <span>
                    <strong>Quantity</strong> {obligation.quantity}{" "}
                    {obligation.unit}
                  </span>
                )}
                {obligation.deadline && (
                  <span>
                    <strong>Due</strong> {obligation.deadline}
                  </span>
                )}
              </div>
              <p className="assessment-reason">{obligation.reason}</p>
              <Citation obligation={obligation} />
            </div>
            <div className="ledger-review">
              <span>
                {Math.round(obligation.confidence * 100)}% extraction confidence
              </span>
              <button
                className={
                  obligation.reviewerState === "approved" ? "approved" : ""
                }
                onClick={() => toggleReviewer(obligation.id)}
                disabled={obligation.status === "superseded"}
              >
                <Check size={14} />{" "}
                {obligation.reviewerState === "approved"
                  ? "Approved"
                  : "Approve"}
              </button>
            </div>
          </article>
        ))}
        {obligations.length === 0 && (
          <div className="empty-state">No obligations match this filter.</div>
        )}
      </div>
    </div>
  );
}

function RevisionTab() {
  const amendment = revisions[0];
  const original = demoObligations.find(
    (item) => item.id === amendment.originalObligationId,
  )!;
  const replacement = demoObligations.find(
    (item) => item.id === amendment.replacementObligationId,
  )!;
  return (
    <div className="tab-stack">
      <div className="content-header">
        <div>
          <span>Revision intelligence</span>
          <h3>Current duty, complete history</h3>
        </div>
        <div className="citation-score">
          <GitCompareArrows size={14} /> 1 resolved chain
        </div>
      </div>
      <div className="revision-explainer">
        <Network size={20} />
        <p>
          The resolver connects a replacement clause to its predecessor, then
          marks only the earlier obligation as superseded. Unchanged approval
          conditions remain active.
        </p>
      </div>
      <div className="revision-graph">
        <article className="revision-document">
          <div>
            <FileText size={20} />
            <span>Final approval</span>
          </div>
          <small>15 May 2025 · Regional Office, MoEFCC</small>
          <h4>{original.requirement}</h4>
          <StatusPill status="superseded" />
          <Citation obligation={original} />
        </article>
        <div className="revision-edge">
          <span />
          <div>
            <GitCompareArrows size={18} />
            <strong>Replaced by amendment</strong>
            <small>Effective 03 September 2025</small>
          </div>
          <span />
        </div>
        <article className="revision-document current">
          <div>
            <FileCheck2 size={20} />
            <span>Amendment</span>
          </div>
          <small>03 September 2025 · Integrated Regional Office</small>
          <h4>{replacement.requirement}</h4>
          <StatusPill status="missing_evidence" />
          <Citation obligation={replacement} />
        </article>
      </div>
      <section className="revision-reasoning">
        <div>
          <span>Resolver rationale</span>
          <h4>Why this is one chain—not two active duties</h4>
        </div>
        <ol>
          <li>
            <span>1</span>
            Both clauses address the same identified 9.54-hectare non-forest
            parcel.
          </li>
          <li>
            <span>2</span>
            The later document explicitly modifies the treatment of that parcel.
          </li>
          <li>
            <span>3</span>
            The amendment preserves conditions that it does not change.
          </li>
          <li>
            <span>4</span>
            The earlier parcel treatment is retained for history and excluded
            from the active count.
          </li>
        </ol>
        <div className="revision-guardrail">
          <ShieldCheck size={16} />
          This is document-state resolution, not a legal compliance conclusion.
        </div>
      </section>
    </div>
  );
}

function InspectionTab({ tasks }: { tasks: InspectionTask[] }) {
  const [checked, setChecked] = useState(new Set<string>());
  return (
    <div className="tab-stack">
      <div className="content-header">
        <div>
          <span>Inspection planner</span>
          <h3>A focused checklist, not a generic visit</h3>
        </div>
        <div className="as-of">
          <Bot size={14} /> Deterministic priority rules
        </div>
      </div>
      <div className="planner-callout">
        <div>
          <Sparkles size={18} />
        </div>
        <p>
          <strong>Why these tasks?</strong> Unresolved obligations are ranked by
          ecological importance, evidence gap, deadline, and expected
          verification effort. Edit and approve before field use.
        </p>
      </div>
      <div className="task-list">
        {tasks.map((task, index) => (
          <article className="task-card" key={task.id}>
            <button
              className={`task-check ${
                checked.has(task.id) ? "checked" : ""
              }`}
              aria-label={`Mark ${task.title} complete`}
              onClick={() =>
                setChecked((current) => {
                  const next = new Set(current);
                  if (next.has(task.id)) next.delete(task.id);
                  else next.add(task.id);
                  return next;
                })
              }
            >
              {checked.has(task.id) ? <Check size={16} /> : index + 1}
            </button>
            <div className="task-body">
              <div>
                <span className={`priority priority-${task.priority}`}>
                  P{task.priority}
                </span>
                <h4>{task.title}</h4>
              </div>
              <p>
                <MapPin size={14} /> {task.location}
              </p>
              <ul>
                {task.requiredEvidence.map((evidence) => (
                  <li key={evidence}>{evidence}</li>
                ))}
              </ul>
              <small>{task.safetyNote}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="planner-footer">
        <span>
          {checked.size} of {tasks.length} tasks completed in this session
        </span>
        <button
          className="primary-button small"
          onClick={() => window.print()}
        >
          <Download size={14} /> Print field checklist
        </button>
      </div>
    </div>
  );
}

function DocumentsTab() {
  return (
    <div className="tab-stack">
      <div className="content-header">
        <div>
          <span>Source documents</span>
          <h3>Public records behind every finding</h3>
        </div>
        <div className="as-of">
          <ShieldCheck size={14} /> Contact details excluded
        </div>
      </div>
      <div className="document-list">
        {sourceDocuments.map((document) => (
          <a
            href={document.sourceUrl}
            target="_blank"
            rel="noreferrer"
            key={document.id}
          >
            <div className={`document-icon ${document.role}`}>
              <FileText size={21} />
            </div>
            <div>
              <span>{document.role.replace("_", " ")}</span>
              <h4>{document.title}</h4>
              <p>
                {document.authority} · {document.date} · {document.pages}{" "}
                {document.pages === 1 ? "record" : "pages"}
              </p>
            </div>
            <ExternalLink size={16} />
          </a>
        ))}
      </div>
      <section className="panel evidence-panel">
        <div className="panel-heading">
          <div>
            <span>Evidence lineage</span>
            <h4>What is—and is not—available</h4>
          </div>
          <Fingerprint size={18} />
        </div>
        {evidenceItems.map((evidence) => (
          <div className="evidence-row" key={evidence.id}>
            <CheckCircle2 size={16} />
            <div>
              <strong>{evidence.title}</strong>
              <p>{evidence.note}</p>
              <small>{evidence.integrity}</small>
            </div>
          </div>
        ))}
      </section>
      <div className="research-validation-link">
        <FileSearch size={18} />
        <div>
          <strong>Benchmark status</strong>
          <p>{benchmark.note}</p>
        </div>
        <a href="/research">
          View methodology <ArrowRight size={13} />
        </a>
      </div>
    </div>
  );
}
