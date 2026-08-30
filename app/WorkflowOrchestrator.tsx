"use client";

import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CloudUpload,
  FileCheck2,
  FileText,
  FolderUp,
  Gauge,
  GitBranch,
  History,
  Link2,
  LockKeyhole,
  Mail,
  MapPinned,
  Mic,
  MicOff,
  MoreHorizontal,
  Network,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Unplug,
  UploadCloud,
  UserCheck,
  Webhook,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  recordedWorkflowRun,
  workflowRunSchema,
  workflowTemplates,
  type WorkflowRun,
  type WorkflowStepRun,
} from "@/lib/workflow";

type PilotSession = {
  authenticated: boolean;
  configured: boolean;
  displayName: string;
  email?: string;
  csrfToken?: string;
};

type Connection = {
  provider: "gmail" | "drive" | "webhook";
  status: "connected" | "expired" | "revoked";
  displayName: string;
};

const subscribeToBrowserCapabilities = () => () => undefined;

const getVoiceCapability = () => {
  const browserWindow = window as typeof window & {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  };
  return Boolean(
    browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition,
  );
};

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
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type VoiceRecognitionConstructor = new () => VoiceRecognition;

const TOUR_KEY = "verdatrace.workflow-tour.v1";
const WORKSPACE_STORAGE_KEY = "verdatrace.demo.workspace.v3";
const REPLAY_DELAY_MS = 720;
const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const CHUNK_BYTES = 3 * 1024 * 1024;

const stepIcon = {
  intake: CloudUpload,
  validation: ShieldCheck,
  document_analysis: FileText,
  citation_gate: FileCheck2,
  revision_resolution: GitBranch,
  evidence_assessment: Gauge,
  spatial_analysis: MapPinned,
  review_signals: Activity,
  inspection_plan: UserCheck,
  workspace_approval: LockKeyhole,
  report_generation: FileCheck2,
  share_draft: Send,
  alphaearth_preview: Network,
} as const;

const templateIcon = [Network, GitBranch, UserCheck, MapPinned] as const;

const tourSteps = [
  {
    selector: "[data-workflow-tour='templates']",
    title: "Start from a controlled workflow",
    description:
      "Choose a dependency-safe template. Optional steps can be changed before a run begins.",
  },
  {
    selector: "[data-workflow-tour='timeline']",
    title: "Follow every measured operation",
    description:
      "The timeline separates completed work, active processing, human gates, failures, and steps that were never invoked.",
  },
  {
    selector: "[data-workflow-tour='inspector']",
    title: "Inspect provenance before acting",
    description:
      "Open a step to see its inputs, output, citation boundary, timing, and exact workspace destination.",
  },
  {
    selector: "[data-workflow-tour='integrations']",
    title: "Connect delivery only when needed",
    description:
      "Gmail, Drive, and webhooks remain disconnected until a signed-in user grants the specific capability.",
  },
  {
    selector: "[data-workflow-tour='composer']",
    title: "Describe the outcome, then review",
    description:
      "Type or speak an instruction, attach evidence, and review the generated workflow before starting it.",
  },
];

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return "Duration not recorded";
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} sec`;
}

function formatStatus(status: WorkflowStepRun["status"]) {
  return status.replaceAll("_", " ");
}

async function uploadWorkflowFile(
  file: File,
  session: PilotSession,
): Promise<string> {
  const createResponse = await fetch("/api/workflow-uploads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrfToken ?? "",
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      chunkCount: Math.ceil(file.size / CHUNK_BYTES),
    }),
  });
  const created = await createResponse.json();
  if (!createResponse.ok) {
    throw new Error(created.error ?? "Could not prepare the upload.");
  }

  for (let index = 0; index < created.chunkCount; index += 1) {
    const start = index * CHUNK_BYTES;
    const response = await fetch(
      `/api/workflow-uploads/${created.id}/chunks/${index}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/octet-stream",
          "x-csrf-token": session.csrfToken ?? "",
          "idempotency-key": `${created.id}-${index}`,
        },
        body: file.slice(start, Math.min(file.size, start + CHUNK_BYTES)),
      },
    );
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error ?? `Upload stopped at chunk ${index + 1}.`);
    }
  }

  const completeResponse = await fetch(
    `/api/workflow-uploads/${created.id}/complete`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": session.csrfToken ?? "",
        "idempotency-key": `${created.id}-complete`,
      },
      body: JSON.stringify({}),
    },
  );
  const complete = await completeResponse.json();
  if (!completeResponse.ok) {
    throw new Error(complete.error ?? "The uploaded file could not be finalized.");
  }
  return complete.id;
}

export function WorkflowOrchestrator() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    "complete-project-review",
  );
  const [selectedRun, setSelectedRun] = useState<WorkflowRun>(
    recordedWorkflowRun,
  );
  const [selectedStepId, setSelectedStepId] = useState("spatial");
  const [instruction, setInstruction] = useState(recordedWorkflowRun.instruction);
  const [files, setFiles] = useState<File[]>([]);
  const [disabledSteps, setDisabledSteps] = useState<Set<string>>(new Set());
  const [stepOrder, setStepOrder] = useState(() => workflowTemplates[0].steps.map((step) => step.id));
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [replayPaused, setReplayPaused] = useState(false);
  const [session, setSession] = useState<PilotSession>({
    authenticated: false,
    configured: false,
    displayName: "Demo reviewer",
  });
  const [recentRuns, setRecentRuns] = useState<WorkflowRun[]>([
    recordedWorkflowRun,
  ]);
  const [runError, setRunError] = useState("");
  const [starting, setStarting] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionRationale, setDecisionRationale] = useState("");
  const [deliveryProvider, setDeliveryProvider] = useState<Connection["provider"]>("drive");
  const [deliveryRecipients, setDeliveryRecipients] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const voiceSupported = useSyncExternalStore(
    subscribeToBrowserCapabilities,
    getVoiceCapability,
    () => false,
  );
  const [voiceActive, setVoiceActive] = useState(false);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [tourWaiting, setTourWaiting] = useState(false);
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const replayTimer = useRef<number | null>(null);
  const tourTimer = useRef<number | null>(null);

  const selectedTemplate =
    workflowTemplates.find((template) => template.id === selectedTemplateId) ??
    workflowTemplates[0];
  const recommendedTemplate = useMemo(() => {
    const normalized = instruction.toLowerCase();
    const id = /amend|revision|supersed/.test(normalized)
      ? "amendment-impact"
      : /inspection|evidence gap|field review/.test(normalized)
        ? "evidence-to-inspection"
        : /spatial|boundary|land cover|map|geojson|kml/.test(normalized)
          ? "spatial-report-update"
          : "complete-project-review";
    return workflowTemplates.find((template) => template.id === id) ?? workflowTemplates[0];
  }, [instruction]);
  const selectedStep =
    selectedRun.steps.find((step) => step.id === selectedStepId) ??
    selectedRun.steps[0];
  const totalFileBytes = files.reduce((total, file) => total + file.size, 0);

  const displayedSteps = useMemo(() => {
    if (replayIndex === null) return selectedRun.steps;
    return selectedRun.steps.map((step, index) => {
      if (index < replayIndex) return step;
      if (index === replayIndex) {
        return {
          ...step,
          status: step.status === "skipped" ? "skipped" : "running",
        } as WorkflowStepRun;
      }
      return { ...step, status: "pending" } as WorkflowStepRun;
    });
  }, [replayIndex, selectedRun.steps]);

  const completionPercent = Math.round(
    (selectedRun.steps.filter((step) =>
      ["completed", "skipped"].includes(step.status),
    ).length /
      selectedRun.steps.length) *
      100,
  );

  useEffect(() => {
    fetch("/api/workflow-session", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => setSession(result as PilotSession))
      .catch(() => undefined);

    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const requested = new URL(window.location.href).searchParams.get("step");
      if (
        requested &&
        recordedWorkflowRun.steps.some((step) => step.id === requested)
      ) {
        setSelectedStepId(requested);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!session.authenticated) return;
    Promise.all([
      fetch("/api/workflow-runs", { cache: "no-store" }).then((response) => response.ok ? response.json() : { runs: [] }),
      fetch("/api/workflow-integrations", { cache: "no-store" }).then((response) => response.ok ? response.json() : { connections: [] }),
    ]).then(([runResult, connectionResult]) => {
      const runs = Array.isArray(runResult.runs)
        ? runResult.runs.map((item: unknown) => workflowRunSchema.parse(item))
        : [];
      setRecentRuns([recordedWorkflowRun, ...runs].slice(0, 8));
      setConnections(Array.isArray(connectionResult.connections) ? connectionResult.connections : []);
      const url = new URL(window.location.href);
      const requestedRun = url.searchParams.get("run");
      const requested = runs.find((run: WorkflowRun) => run.id === requestedRun);
      if (requested) {
        setSelectedRun(requested);
        const requestedStep = url.searchParams.get("step");
        if (
          requestedStep &&
          requested.steps.some((step: WorkflowStepRun) => step.id === requestedStep)
        ) {
          setSelectedStepId(requestedStep);
        }
      }
    }).catch(() => undefined);
  }, [session.authenticated]);

  useEffect(() => {
    if (selectedRun.source !== "user_run" || ["completed", "failed", "cancelled"].includes(selectedRun.status)) return;
    let stopped = false;
    let timer: number | null = null;
    const poll = async () => {
      try {
        const response = await fetch(`/api/workflow-runs/${selectedRun.id}`, { cache: "no-store" });
        if (response.ok && !stopped) {
          const next = workflowRunSchema.parse((await response.json()).run);
          setSelectedRun(next);
          setRecentRuns((current) => current.map((run) => run.id === next.id ? next : run));
        }
      } finally {
        if (!stopped) timer = window.setTimeout(poll, document.hidden ? 10_000 : 2_000);
      }
    };
    timer = window.setTimeout(poll, document.hidden ? 10_000 : 2_000);
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [selectedRun.id, selectedRun.source, selectedRun.status]);

  useEffect(() => {
    const restoreUrlState = () => {
      const url = new URL(window.location.href);
      const runId = url.searchParams.get("run");
      const stepId = url.searchParams.get("step");
      const run = recentRuns.find((item) => item.id === runId);
      if (run) setSelectedRun(run);
      const target = run ?? selectedRun;
      if (stepId && target.steps.some((step) => step.id === stepId)) setSelectedStepId(stepId);
    };
    window.addEventListener("popstate", restoreUrlState);
    return () => window.removeEventListener("popstate", restoreUrlState);
  }, [recentRuns, selectedRun]);

  useEffect(() => {
    if (replayIndex === null || replayPaused) return;
    replayTimer.current = window.setTimeout(() => {
      setReplayIndex((current) => {
        if (current === null || current >= selectedRun.steps.length - 1) {
          return null;
        }
        return current + 1;
      });
    }, REPLAY_DELAY_MS);
    return () => {
      if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
    };
  }, [replayIndex, replayPaused, selectedRun.steps.length]);

  useEffect(() => {
    let seen = false;
    try {
      seen = Boolean(window.localStorage.getItem(TOUR_KEY));
    } catch {
      seen = false;
    }
    if (seen) return;

    const section = document.querySelector("#workflow-orchestrator");
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        tourTimer.current = window.setTimeout(() => {
          setTourIndex(0);
          observer.disconnect();
        }, 2600);
      },
      { threshold: 0.18 },
    );
    observer.observe(section);
    return () => {
      observer.disconnect();
      if (tourTimer.current !== null) window.clearTimeout(tourTimer.current);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({
          version: 3,
          selectedTemplateId,
          selectedStepId,
          replayDismissed: replayIndex === null,
        }),
      );
    } catch {
      // Device-local preferences are optional.
    }
  }, [replayIndex, selectedStepId, selectedTemplateId]);

  const selectStep = (step: WorkflowStepRun) => {
    setSelectedStepId(step.id);
    const url = new URL(window.location.href);
    url.searchParams.set("screen", "orchestrator");
    url.searchParams.set("run", selectedRun.id);
    url.searchParams.set("step", step.id);
    window.history.pushState(
      { ...window.history.state, screen: "orchestrator", step: step.id },
      "",
      url,
    );
  };

  const openOutput = (outputRef: string | null) => {
    if (!outputRef) return;
    if (outputRef.startsWith("/api/workflow-artifacts/")) {
      window.open(outputRef, "_blank", "noopener,noreferrer");
      return;
    }
    const [queryPart, hashPart] = outputRef.startsWith("?")
      ? outputRef.split("#")
      : ["", outputRef.replace(/^#/, "")];
    const url = new URL(window.location.href);
    if (queryPart) {
      const params = new URLSearchParams(queryPart.slice(1));
      params.forEach((value, key) => url.searchParams.set(key, value));
    }
    url.searchParams.set("run", selectedRun.id);
    url.hash = hashPart ? `#${hashPart}` : "";
    window.history.pushState({ ...window.history.state, run: selectedRun.id }, "", url);
    if (hashPart) {
      document.querySelector(`#${hashPart}`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files ?? []);
    setRunError("");
    if (next.length + files.length > MAX_FILES) {
      setRunError(`Attach no more than ${MAX_FILES} files to one workflow.`);
      event.target.value = "";
      return;
    }
    if (next.some((file) => file.size > 15 * 1024 * 1024)) {
      setRunError("Each workflow file must be 15 MB or smaller.");
      event.target.value = "";
      return;
    }
    if (
      totalFileBytes + next.reduce((total, file) => total + file.size, 0) >
      MAX_TOTAL_BYTES
    ) {
      setRunError("Workflow attachments may total no more than 50 MB.");
      event.target.value = "";
      return;
    }
    setFiles((current) => [...current, ...next]);
    event.target.value = "";
  };

  const moveConfiguredStep = (stepId: string, offset: -1 | 1) => {
    setStepOrder((current) => {
      const from = current.indexOf(stepId);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      const position = new Map(next.map((id, index) => [id, index]));
      const safe = selectedTemplate.steps.every((step) =>
        step.dependsOn.every((dependency) => (position.get(dependency) ?? -1) < (position.get(step.id) ?? -1)),
      );
      return safe ? next : current;
    });
  };

  const startVoice = () => {
    if (voiceActive) {
      recognitionRef.current?.stop();
      return;
    }
    const browserWindow = window as typeof window & {
      SpeechRecognition?: VoiceRecognitionConstructor;
      webkitSpeechRecognition?: VoiceRecognitionConstructor;
    };
    const Recognition =
      browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-IN";
    recognition.onstart = () => setVoiceActive(true);
    recognition.onend = () => setVoiceActive(false);
    recognition.onerror = () => setVoiceActive(false);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? "";
      }
      if (transcript.trim()) setInstruction(transcript.trim());
    };
    recognition.start();
  };

  const startRun = async (event: FormEvent) => {
    event.preventDefault();
    setRunError("");
    if (!session.authenticated) {
      if (!session.configured) {
        setRunError(
          "Custom durable workflows are not configured in this local runtime. Explore or replay the recorded sample.",
        );
        return;
      }
      window.location.assign(`/api/workflow-auth/google?returnTo=${encodeURIComponent("/demo#workflow-orchestrator")}`);
      return;
    }

    setStarting(true);
    try {
      const uploadIds: string[] = [];
      for (const file of files) {
        uploadIds.push(await uploadWorkflowFile(file, session));
      }
      const response = await fetch("/api/workflow-runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": session.csrfToken ?? "",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          projectId: "FP/KA/ROAD/7440/2014",
          projectName: "Zeenath approach road",
          instruction,
          disabledStepIds: Array.from(disabledSteps),
          stepOrder,
          uploadIds,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Workflow could not start.");
      const run = workflowRunSchema.parse(result.run);
      setSelectedRun(run);
      setRecentRuns((current) => [run, ...current].slice(0, 8));
      setSelectedStepId(run.steps[0]?.id ?? "intake");
      setFiles([]);
    } catch (caught) {
      setRunError(caught instanceof Error ? caught.message : "Workflow could not start.");
    } finally {
      setStarting(false);
    }
  };

  const decideRun = async (decision: "approve" | "reject") => {
    if (selectedRun.source !== "user_run" || !selectedStep || selectedStep.status !== "needs_review") return;
    if (decisionRationale.trim().length < 3) {
      setRunError("Add a short rationale before recording this decision.");
      return;
    }
    const recipients = deliveryRecipients.split(",").map((value) => value.trim()).filter(Boolean);
    if (decision === "approve" && selectedStep.kind === "share_draft" && deliveryProvider === "gmail" && recipients.length === 0) {
      setRunError("Add at least one reviewed Gmail recipient before approving delivery.");
      return;
    }
    setDecisionBusy(true);
    setRunError("");
    try {
      const response = await fetch(`/api/workflow-runs/${selectedRun.id}/${decision}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": session.csrfToken ?? "",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          stepId: selectedStep.id,
          rationale: decisionRationale,
          ...(selectedStep.kind === "share_draft" ? {
            delivery: { provider: deliveryProvider, recipients },
          } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The decision could not be recorded.");
      const run = workflowRunSchema.parse(result.run);
      setSelectedRun(run);
      setRecentRuns((current) => current.map((item) => item.id === run.id ? run : item));
      setDecisionRationale("");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "The decision could not be recorded.");
    } finally {
      setDecisionBusy(false);
    }
  };

  const advanceTour = () => {
    if (tourIndex === null) return;
    setTourWaiting(true);
    window.setTimeout(() => {
      if (tourIndex >= tourSteps.length - 1) {
        setTourIndex(null);
        try {
          window.localStorage.setItem(TOUR_KEY, "completed");
        } catch {
          // Tour completion remains in memory.
        }
      } else {
        setTourIndex((current) => (current === null ? null : current + 1));
      }
      setTourWaiting(false);
    }, 4600);
  };

  const dismissTour = () => {
    setTourIndex(null);
    try {
      window.localStorage.setItem(TOUR_KEY, "skipped");
    } catch {
      // Tour dismissal remains in memory.
    }
  };

  return (
    <section className="workflow-section" id="workflow-orchestrator">
      <div className="workflow-section-heading">
        <div>
          <span className="workflow-screen-tag">
            <Sparkles size={13} /> Guided sandbox demo · Orchestrate evidence into approved action
          </span>
          <small>Screen 03 · Workflow orchestrator</small>
          <h2>One workspace. Every review step. Human-controlled.</h2>
          <p>
            Move from source evidence to an approved action through one clear,
            measurable workflow.
          </p>
        </div>
        <div className="workflow-heading-status">
          <span><ShieldCheck size={16} /><b>3</b><small>approval gates</small></span>
          <span><History size={16} /><b>13</b><small>traceable stages</small></span>
        </div>
      </div>

      <div className="workflow-window">
        <header className="workflow-titlebar">
          <div className="workflow-window-dots" aria-hidden="true">
            <i /><i /><i />
          </div>
          <div className="workflow-titlebar-project">
            <Bot size={15} />
            <span>
              <strong>VerdaTrace · Operations Agent</strong>
              <small>FP/KA/ROAD/7440/2014</small>
            </span>
          </div>
          <div className="workflow-titlebar-status">
            <span className="is-recorded"><i /> Recorded sample</span>
            <span>{completionPercent}% complete</span>
            <button aria-label="More workflow actions"><MoreHorizontal size={17} /></button>
          </div>
        </header>

        <div className="workflow-layout">
          <aside className="workflow-left-rail" data-workflow-tour="templates">
            <section>
              <header>
                <span>Workflow templates</span>
                <Settings2 size={14} />
              </header>
              <div className="workflow-template-list">
                {workflowTemplates.map((template, index) => (
                  (() => {
                    const TemplateIcon = templateIcon[index] ?? Network;
                    return (
                      <button
                        key={template.id}
                        data-template={template.id}
                        className={selectedTemplateId === template.id ? "active" : ""}
                        aria-pressed={selectedTemplateId === template.id}
                        title={template.description}
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setDisabledSteps(new Set());
                          setStepOrder(template.steps.map((step) => step.id));
                        }}
                      >
                        <span className="workflow-template-icon"><TemplateIcon size={16} /></span>
                        <span>
                          <strong>{template.name}</strong>
                          <small>{template.steps.length} steps · {template.estimatedMinutes} min</small>
                        </span>
                        <ChevronDown size={13} />
                      </button>
                    );
                  })()
                ))}
              </div>
            </section>

            <section className="workflow-run-history">
              <header><span>Recent runs</span><History size={14} /></header>
              {recentRuns.map((run) => (
                <button
                  key={run.id}
                  className={selectedRun.id === run.id ? "active" : ""}
                  onClick={() => {
                    setSelectedRun(run);
                    setSelectedStepId(run.steps[0]?.id ?? "intake");
                  }}
                >
                  <span className={`run-state state-${run.status}`}><i /></span>
                  <span>
                    <strong>{run.source === "recorded_sample" ? "Sample · complete review" : run.templateName}</strong>
                    <small>{run.status.replace("_", " ")} · {run.steps.length} steps</small>
                  </span>
                </button>
              ))}
            </section>

            <section className="workflow-integrations" data-workflow-tour="integrations">
              <header><span>Connections</span><Link2 size={14} /></header>
              <div>
                <span data-provider="gmail"><i><Mail size={14} /></i><b>Gmail</b><em>{connections.find((item) => item.provider === "gmail")?.status ?? "Off"}</em></span>
                <span data-provider="drive"><i><FolderUp size={14} /></i><b>Drive</b><em>{connections.find((item) => item.provider === "drive")?.status ?? "Off"}</em></span>
                <span data-provider="webhook"><i><Webhook size={14} /></i><b>Webhook</b><em>{connections.find((item) => item.provider === "webhook")?.status ?? "Off"}</em></span>
              </div>
              <div className="workflow-connection-actions">
                {(["gmail", "drive"] as const).map((provider) => (
                  <button
                    key={provider}
                    onClick={() => {
                      if (!session.configured) {
                        setRunError("Google connections are unavailable in this local runtime.");
                        return;
                      }
                      window.location.assign(session.authenticated
                        ? `/api/workflow-integrations/${provider}/connect?returnTo=%2Fdemo%23workflow-orchestrator`
                        : "/api/workflow-auth/google?returnTo=%2Fdemo%23workflow-orchestrator");
                    }}
                  >
                    <Unplug size={12} /> <span>{connections.some((item) => item.provider === provider && item.status === "connected") ? "Reconnect" : "Connect"} {provider}</span>
                  </button>
                ))}
              </div>
            </section>

            <div className="workflow-quota-card">
              <Gauge size={15} />
              <span><strong>{session.authenticated ? "2 runs / hour" : "Demo replay"}</strong><small>{session.authenticated ? "10 daily · one active" : "Replay does not consume quota"}</small></span>
            </div>
          </aside>

          <main className="workflow-main" data-workflow-tour="timeline">
            <header className="workflow-run-header">
              <div>
                <span>{selectedRun.source === "recorded_sample" ? "Recorded sample run" : "User workflow"}</span>
                <h3>{selectedRun.templateName}</h3>
                <p>{selectedRun.projectName} · workspace v{selectedRun.workspaceVersion}</p>
              </div>
              <div className="workflow-run-actions">
                {replayIndex === null ? (
                  <button
                    className="workflow-replay"
                    onClick={() => {
                      setReplayIndex(0);
                      setReplayPaused(false);
                    }}
                  >
                    <Play size={14} /> Replay recorded run
                  </button>
                ) : (
                  <>
                    <button onClick={() => setReplayPaused((current) => !current)}>
                      {replayPaused ? <Play size={14} /> : <Pause size={14} />}
                      {replayPaused ? "Continue" : "Pause"}
                    </button>
                    <button onClick={() => setReplayIndex(null)} aria-label="Stop replay">
                      <Square size={13} />
                    </button>
                  </>
                )}
                <button
                  className="workflow-clone"
                  onClick={() => {
                    setSelectedTemplateId("complete-project-review");
                    document.querySelector(".workflow-composer")?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }}
                >
                  <RotateCcw size={14} /> Clone workflow
                </button>
              </div>
            </header>

            {replayIndex !== null && (
              <div className="workflow-replay-banner" role="status">
                <Play size={13} /> Recorded replay · no live service is running
                <span>{Math.min(replayIndex + 1, selectedRun.steps.length)} / {selectedRun.steps.length}</span>
              </div>
            )}

            <ol className="workflow-timeline">
              {displayedSteps.map((step, index) => {
                const Icon = stepIcon[step.kind];
                const isSelected = step.id === selectedStepId;
                return (
                  <li key={step.id} className={`state-${step.status} ${isSelected ? "selected" : ""}`}>
                    <button
                      data-kind={step.kind}
                      title={`${step.label} — ${step.outputSummary ?? step.description}`}
                      aria-label={`${step.label}, ${formatStatus(step.status)}`}
                      onClick={() => selectStep(step)}
                      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                        if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
                        event.preventDefault();
                        const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
                        const next = displayedSteps[index + direction];
                        if (next) selectStep(next);
                      }}
                    >
                      <span className="workflow-step-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="workflow-step-icon">
                        {step.status === "completed" ? <Check size={15} /> : <Icon size={15} />}
                        {step.status === "running" && <i />}
                      </span>
                      <span className="workflow-step-copy">
                        <small>{step.kind.replaceAll("_", " ")}</small>
                        <strong>{step.label}</strong>
                        <em>{step.outputSummary ?? step.description}</em>
                      </span>
                      <span className="workflow-step-meta">
                        <small>{formatDuration(step.durationMs)}</small>
                        <b>{formatStatus(step.status)}</b>
                      </span>
                    </button>
                    {index < displayedSteps.length - 1 && <span className="workflow-edge" aria-hidden="true"><i /></span>}
                  </li>
                );
              })}
            </ol>
          </main>

          <aside className="workflow-inspector" data-workflow-tour="inspector">
            {selectedStep && (
              <>
                <header>
                  <span>Step inspector</span>
                  <strong className={`state-${selectedStep.status}`}>
                    <i /> {formatStatus(selectedStep.status)}
                  </strong>
                </header>
                <div className="workflow-inspector-title">
                  {(() => {
                    const Icon = stepIcon[selectedStep.kind];
                    return <i data-kind={selectedStep.kind}><Icon size={19} /></i>;
                  })()}
                  <span>
                    <small>{selectedStep.kind.replaceAll("_", " ")}</small>
                    <h3>{selectedStep.label}</h3>
                  </span>
                </div>
                <p>{selectedStep.description}</p>

                <div className="workflow-inspector-metrics">
                  <span><small>Processing</small><strong>{formatDuration(selectedStep.durationMs)}</strong></span>
                  <span><small>Items</small><strong>{selectedStep.itemCount ?? "Not recorded"}</strong></span>
                  <span><small>Attempt</small><strong>{selectedStep.attempt || "Not invoked"}</strong></span>
                  <span><small>Source</small><strong>{selectedRun.source === "recorded_sample" ? "Recorded sample" : "Measured run"}</strong></span>
                </div>

                <section className="workflow-output-card">
                  <span>Recorded output</span>
                  <p>{selectedStep.outputSummary ?? "No output has been produced."}</p>
                  {selectedStep.outputRef && (
                    <button onClick={() => openOutput(selectedStep.outputRef)}>
                      Open workspace result <ArrowRight size={13} />
                    </button>
                  )}
                </section>

                {selectedStep.approvalRequired && (
                  <section className="workflow-approval-card">
                    <ShieldCheck size={16} />
                    <span>
                      <strong>Human approval boundary</strong>
                      <p>This action cannot alter the workspace or send data without a recorded decision.</p>
                    </span>
                    {selectedRun.source === "recorded_sample" && (
                      <em><CheckCircle2 size={12} /> Recorded sample decision</em>
                    )}
                    {selectedRun.source === "user_run" && selectedStep.status === "needs_review" && (
                      <div className="workflow-decision-controls">
                        {selectedStep.kind === "share_draft" && (
                          <div className="workflow-delivery-fields">
                            <label>
                              Delivery capability
                              <select value={deliveryProvider} onChange={(event) => setDeliveryProvider(event.target.value as Connection["provider"])}>
                                <option value="gmail">Gmail · send approved email</option>
                                <option value="drive">Drive · upload approved report</option>
                                <option value="webhook">Webhook · signed derived payload</option>
                              </select>
                            </label>
                            {deliveryProvider === "gmail" && (
                              <label>
                                Reviewed recipients
                                <input value={deliveryRecipients} onChange={(event) => setDeliveryRecipients(event.target.value)} placeholder="reviewer@example.org" />
                              </label>
                            )}
                            <small>{connections.some((item) => item.provider === deliveryProvider && item.status === "connected") ? "Connected capability available." : "Connect this capability before approving delivery."}</small>
                          </div>
                        )}
                        <label>
                          Decision rationale
                          <textarea
                            value={decisionRationale}
                            onChange={(event) => setDecisionRationale(event.target.value)}
                            maxLength={1000}
                            rows={3}
                            placeholder="Record what you checked and why…"
                          />
                        </label>
                        <div>
                          <button type="button" disabled={decisionBusy} onClick={() => decideRun("reject")}>Reject proposal</button>
                          <button type="button" disabled={decisionBusy} onClick={() => decideRun("approve")}><UserCheck size={13} /> Approve and resume</button>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {selectedStep.kind === "share_draft" && selectedRun.shareDraft && (
                  <section className="workflow-share-preview">
                    <header><span>Internal share draft</span><Mail size={14} /></header>
                    <strong>{selectedRun.shareDraft.subject}</strong>
                    <p>{selectedRun.shareDraft.message}</p>
                    {selectedRun.shareDraft.attachmentLabels.map((label) => (
                      <span key={label}><FileText size={12} /> {label}</span>
                    ))}
                    <small>No external delivery was invoked.</small>
                  </section>
                )}

                {selectedStep.kind === "alphaearth_preview" && (
                  <section className="workflow-alpha-boundary">
                    <CircleAlert size={16} />
                    <span>
                      <strong>Recorded preview · not invoked</strong>
                      <p>Screen 04 similarity computation remains calibration pending. No score or result is shown.</p>
                    </span>
                  </section>
                )}
              </>
            )}
          </aside>
        </div>

        <form className="workflow-composer" onSubmit={startRun} data-workflow-tour="composer">
          <div className="workflow-composer-topline">
            <span><Sparkles size={14} /> Configure a controlled run</span>
            <small>{selectedTemplate.steps.length - disabledSteps.size} active steps · {files.length}/{MAX_FILES} files</small>
          </div>

          {recommendedTemplate.id !== selectedTemplate.id && (
            <div className="workflow-template-recommendation">
              <span><Bot size={13} /> Suggested from your instruction: <strong>{recommendedTemplate.name}</strong></span>
              <button type="button" onClick={() => {
                setSelectedTemplateId(recommendedTemplate.id);
                setDisabledSteps(new Set());
                setStepOrder(recommendedTemplate.steps.map((step) => step.id));
              }}>Review this template</button>
            </div>
          )}

          <details className="workflow-config-drawer">
            <summary>
              <span><Settings2 size={13} /> Run settings</span>
              <small>{selectedTemplate.steps.length - disabledSteps.size} enabled</small>
              <ChevronDown size={13} />
            </summary>
            <div className="workflow-config-body">
              <div className="workflow-optional-steps">
                {selectedTemplate.steps.filter((step) => step.optional).map((step) => (
                  <label key={step.id}>
                    <input
                      type="checkbox"
                      checked={!disabledSteps.has(step.id)}
                      onChange={(event) => {
                        setDisabledSteps((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.delete(step.id);
                          else next.add(step.id);
                          return next;
                        });
                      }}
                    />
                    <span><i /> {step.label}</span>
                  </label>
                ))}
              </div>
              <details className="workflow-step-order">
                <summary>Step order <ChevronDown size={13} /></summary>
                <ol>
                  {stepOrder.map((stepId, index) => {
                    const step = selectedTemplate.steps.find((item) => item.id === stepId)!;
                    return (
                      <li key={stepId}>
                        <span>{String(index + 1).padStart(2, "0")} · {step.label}</span>
                        <div>
                          <button type="button" onClick={() => moveConfiguredStep(stepId, -1)} aria-label={`Move ${step.label} earlier`}><ChevronUp size={12} /></button>
                          <button type="button" onClick={() => moveConfiguredStep(stepId, 1)} aria-label={`Move ${step.label} later`}><ChevronDown size={12} /></button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <small>Dependency-breaking moves are ignored.</small>
              </details>
            </div>
          </details>

          {files.length > 0 && (
            <div className="workflow-file-tray">
              {files.map((file, index) => (
                <span key={`${file.name}-${index}`}>
                  <FileText size={12} />
                  {file.name}
                  <button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="workflow-composer-row">
            <label className="workflow-attach-button">
              <UploadCloud size={17} />
              <span>Attach evidence</span>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.rtf,.txt,.csv,.json,.md,.png,.jpg,.jpeg,.webp,.tif,.tiff,.geojson,.kml"
                onChange={handleFiles}
              />
            </label>
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Describe the review outcome you need…"
              rows={2}
              maxLength={2000}
            />
            <button
              type="button"
              className={`workflow-voice ${voiceActive ? "active" : ""}`}
              onClick={startVoice}
              disabled={!voiceSupported}
              aria-label={voiceActive ? "Stop voice instruction" : "Speak workflow instruction"}
            >
              {voiceSupported ? <Mic size={17} /> : <MicOff size={17} />}
              {voiceActive && <i />}
            </button>
            <button className="workflow-run-button" disabled={starting || !instruction.trim()}>
              {starting ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
              <span>
                <strong>{session.authenticated ? "Review and run" : "Sign in to run"}</strong>
                <small>{session.authenticated ? "Human gates remain active" : "Recorded sample stays available"}</small>
              </span>
              <ArrowRight size={15} />
            </button>
          </div>
          {runError && <div className="workflow-run-error" role="alert"><CircleAlert size={14} /> {runError}</div>}
        </form>
      </div>

      {tourIndex !== null && !tourWaiting && (
        <div className="workflow-tour-backdrop" role="presentation">
          <section className="workflow-tour-card" role="dialog" aria-modal="true" aria-label="Screen 3 guided tour">
            <button className="workflow-tour-close" onClick={dismissTour} aria-label="Skip workflow tour"><X size={15} /></button>
            <span>{String(tourIndex + 1).padStart(2, "0")} / {String(tourSteps.length).padStart(2, "0")}</span>
            <h3>{tourSteps[tourIndex]?.title}</h3>
            <p>{tourSteps[tourIndex]?.description}</p>
            <button onClick={advanceTour}>
              Show me <ArrowRight size={14} />
            </button>
          </section>
        </div>
      )}

      {tourIndex !== null && tourWaiting && (
        <div className="workflow-tour-wait" role="status">
          <Check size={13} /> Explore this area. The next guide appears in 4–5 seconds.
        </div>
      )}
    </section>
  );
}
