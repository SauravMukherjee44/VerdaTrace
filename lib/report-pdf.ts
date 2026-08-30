import type {
  EvidenceItem,
  InspectionTask,
  Obligation,
  Revision,
  SourceDocument,
} from "@/lib/schema";
import type { SpatialAnalysisResult } from "@/lib/spatial";

export type ReportInput = {
  projectId: string;
  projectName: string;
  location: string;
  obligations: Obligation[];
  revisions: Revision[];
  inspectionTasks: InspectionTask[];
  documents: SourceDocument[];
  evidence: EvidenceItem[];
  coverage: number;
  spatialAnalysis?: SpatialAnalysisResult | null;
  uploadedDocumentTitle?: string;
};

const FOREST = [15, 42, 34] as const;
const SAGE = [144, 169, 156] as const;
const AMBER = [200, 139, 58] as const;
const INK = [34, 49, 43] as const;
const MUTED = [101, 119, 109] as const;

export async function createVerdaTraceReport(input: ReportInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 17;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const addPage = () => {
    doc.addPage();
    y = 18;
  };
  const ensure = (height: number) => {
    if (y + height > pageHeight - 18) addPage();
  };
  const text = (
    value: string,
    x: number,
    maxWidth: number,
    size = 9,
    color: readonly number[] = INK,
    style: "normal" | "bold" = "normal",
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(value, maxWidth) as string[];
    doc.text(lines, x, y);
    y += lines.length * (size * 0.42) + 1.5;
    return lines.length;
  };
  const sectionTitle = (eyebrow: string, title: string) => {
    ensure(23);
    doc.setFillColor(FOREST[0], FOREST[1], FOREST[2]);
    doc.roundedRect(margin, y, 3, 17, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
    doc.text(eyebrow.toUpperCase(), margin + 7, y + 4);
    doc.setFontSize(16);
    doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
    doc.text(title, margin + 7, y + 12);
    y += 23;
  };
  const divider = () => {
    doc.setDrawColor(220, 227, 222);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  doc.setFillColor(FOREST[0], FOREST[1], FOREST[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setDrawColor(SAGE[0], SAGE[1], SAGE[2]);
  doc.setLineWidth(0.25);
  for (let gx = 0; gx < pageWidth; gx += 14) doc.line(gx, 0, gx, pageHeight);
  for (let gy = 0; gy < pageHeight; gy += 14) doc.line(0, gy, pageWidth, gy);
  doc.setFillColor(243, 241, 232);
  doc.roundedRect(16, 17, 178, 263, 6, 6, "F");
  doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("VerdaTrace", 28, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("EVERY ECOLOGICAL OBLIGATION, TRACEABLE.", 28, 49);
  doc.setFillColor(FOREST[0], FOREST[1], FOREST[2]);
  doc.roundedRect(28, 68, 154, 82, 4, 4, "F");
  doc.setTextColor(144, 169, 156);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("OBLIGATION INTELLIGENCE REPORT", 39, 86);
  doc.setTextColor(245, 247, 244);
  doc.setFontSize(22);
  const coverTitle = doc.splitTextToSize(input.projectName, 132) as string[];
  doc.text(coverTitle, 39, 103);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${input.projectId}  |  ${input.location}`, 39, 132);
  doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text(String(input.obligations.filter((o) => o.status !== "superseded").length), 28, 182);
  doc.setFontSize(8);
  doc.text("ACTIVE OBLIGATIONS", 28, 190);
  doc.setFontSize(30);
  doc.text(`${input.coverage}%`, 85, 182);
  doc.setFontSize(8);
  doc.text("EVIDENCE COVERAGE", 85, 190);
  doc.setFontSize(30);
  doc.text(
    String(input.obligations.filter((o) => o.status === "missing_evidence").length),
    143,
    182,
  );
  doc.setFontSize(8);
  doc.text("PRIORITY GAPS", 143, 190);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `Generated ${new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date())}`,
    28,
    223,
  );
  if (input.uploadedDocumentTitle) {
    doc.text(`Includes session analysis: ${input.uploadedDocumentTitle}`, 28, 231);
  }
  doc.setFontSize(8);
  const disclaimer = doc.splitTextToSize(
    "Human-reviewed decision support. This report measures evidence coverage and review priority; it is not a legal compliance determination.",
    150,
  ) as string[];
  doc.text(disclaimer, 28, 254);

  addPage();
  sectionTitle("01 · Overview", "Executive review summary");
  text(
    "VerdaTrace converts environmental approvals, amendments, evidence, and spatial records into a source-linked obligation ledger. This report reflects the current workspace state at export time.",
    margin,
    contentWidth,
    10,
    MUTED,
  );
  y += 3;
  const summary = [
    ["Active obligations", String(input.obligations.filter((o) => o.status !== "superseded").length)],
    ["Evidence coverage", `${input.coverage}%`],
    ["Missing evidence", String(input.obligations.filter((o) => o.status === "missing_evidence").length)],
    ["Expert review", String(input.obligations.filter((o) => o.status === "expert_review").length)],
    ["Reviewer approved", String(input.obligations.filter((o) => o.reviewerState === "approved").length)],
    ["Inspection tasks", String(input.inspectionTasks.length)],
  ];
  summary.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = margin + col * 59;
    const boxY = y + row * 26;
    doc.setFillColor(240, 245, 241);
    doc.roundedRect(x, boxY, 54, 21, 2.5, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
    doc.text(value, x + 5, boxY + 9);
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(label.toUpperCase(), x + 5, boxY + 16);
  });
  y += 58;
  sectionTitle("Review priorities", "Signals requiring human attention");
  const priorities = input.obligations
    .filter((item) =>
      ["missing_evidence", "partial", "expert_review"].includes(item.status),
    )
    .slice(0, 8);
  priorities.forEach((item, index) => {
    ensure(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
    doc.text(String(index + 1).padStart(2, "0"), margin, y + 1);
    text(item.requirement, margin + 10, contentWidth - 10, 9, INK, "bold");
    text(
      `${item.status.replaceAll("_", " ")} · ${item.reason}`,
      margin + 10,
      contentWidth - 10,
      7.5,
      MUTED,
    );
    divider();
  });

  addPage();
  sectionTitle("02 · Obligation ledger", "Source-cited findings");
  input.obligations.forEach((item, index) => {
    ensure(36);
    doc.setFillColor(index % 2 === 0 ? 247 : 252, index % 2 === 0 ? 249 : 252, index % 2 === 0 ? 247 : 250);
    doc.roundedRect(margin, y - 3, contentWidth, 4, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
    doc.text(`${item.clause} · ${item.category} · ${item.status.replaceAll("_", " ")}`.toUpperCase(), margin, y);
    y += 5;
    text(item.requirement, margin, contentWidth, 9, INK, "bold");
    const facts = [
      `Owner: ${item.responsibleParty}`,
      item.quantity !== null ? `Quantity: ${item.quantity} ${item.unit ?? ""}` : "",
      item.deadline ? `Due: ${item.deadline}` : "",
      item.geography ? `Place: ${item.geography}` : "",
    ].filter(Boolean);
    text(facts.join("  |  "), margin, contentWidth, 7.5, MUTED);
    text(
      `Source: ${item.citation.documentTitle}, page ${item.citation.page}, ${item.citation.clause} · Confidence ${Math.round(item.confidence * 100)}% · Reviewer ${item.reviewerState.replaceAll("_", " ")}`,
      margin,
      contentWidth,
      7.5,
      MUTED,
    );
    text(`Assessment: ${item.reason}`, margin, contentWidth, 7.5, MUTED);
    divider();
  });

  addPage();
  sectionTitle("03 · Revision graph", "Amendment-aware obligation history");
  input.revisions.forEach((revision) => {
    const original = input.obligations.find(
      (item) => item.id === revision.originalObligationId,
    );
    const replacement = input.obligations.find(
      (item) => item.id === revision.replacementObligationId,
    );
    ensure(65);
    text(
      `Effective ${revision.effectiveDate}`,
      margin,
      contentWidth,
      8,
      AMBER,
      "bold",
    );
    if (original) {
      text(`SUPERSEDED · ${original.clause}`, margin, contentWidth, 7.5, MUTED, "bold");
      text(original.requirement, margin, contentWidth, 9, MUTED);
    }
    text("REPLACED BY", margin, contentWidth, 7, AMBER, "bold");
    if (replacement) {
      text(`CURRENT · ${replacement.clause}`, margin, contentWidth, 7.5, FOREST, "bold");
      text(replacement.requirement, margin, contentWidth, 9, INK, "bold");
    }
    text(`Resolver rationale: ${revision.rationale}`, margin, contentWidth, 8, MUTED);
    text(
      `Amendment source: ${revision.amendmentCitation.documentTitle}, page ${revision.amendmentCitation.page}, ${revision.amendmentCitation.clause}`,
      margin,
      contentWidth,
      7.5,
      MUTED,
    );
    divider();
  });
  sectionTitle("Control boundary", "How current state is protected");
  text(
    "Replacement relationships preserve the complete history while excluding superseded wording from the active count. Unchanged conditions remain active. Every consequential relationship requires expert approval.",
    margin,
    contentWidth,
    9,
    MUTED,
  );

  addPage();
  sectionTitle("04 · Inspection plan", "Prioritized evidence collection");
  input.inspectionTasks.forEach((task, index) => {
    ensure(39);
    doc.setFillColor(task.priority === 1 ? 251 : 241, task.priority === 1 ? 241 : 246, task.priority === 1 ? 228 : 242);
    doc.roundedRect(margin, y - 3, 18, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(task.priority === 1 ? AMBER[0] : FOREST[0], task.priority === 1 ? AMBER[1] : FOREST[1], task.priority === 1 ? AMBER[2] : FOREST[2]);
    doc.text(`P${task.priority} · ${index + 1}`, margin + 4, y + 3);
    y += 12;
    text(task.title, margin, contentWidth, 10, INK, "bold");
    text(`Location: ${task.location}`, margin, contentWidth, 8, MUTED);
    text(`Required evidence: ${task.requiredEvidence.join("; ")}`, margin, contentWidth, 8, MUTED);
    text(`Rationale: ${task.rationale}`, margin, contentWidth, 8, MUTED);
    text(`Safety: ${task.safetyNote}`, margin, contentWidth, 7.5, MUTED);
    divider();
  });

  if (input.spatialAnalysis) {
    const spatial = input.spatialAnalysis;
    addPage();
    sectionTitle("05 · Spatial evidence", "Measured land-cover comparison");
    text(
      `${spatial.geometry.fileName} · ${spatial.geometry.areaHectares.toFixed(2)} ha · ${spatial.baselinePeriod.year} baseline versus ${spatial.currentPeriod.year} comparison`,
      margin,
      contentWidth,
      9,
      INK,
      "bold",
    );
    text(
      `Geometry hash ${spatial.geometry.hash}. Computed ${new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(spatial.computedAt))} in ${spatial.processingMs.toLocaleString()} ms.`,
      margin,
      contentWidth,
      8,
      MUTED,
    );
    y += 4;
    spatial.classes.forEach((item, index) => {
      ensure(22);
      doc.setFillColor(index % 2 === 0 ? 241 : 248, index % 2 === 0 ? 246 : 249, index % 2 === 0 ? 242 : 247);
      doc.roundedRect(margin, y - 3, contentWidth, 17, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
      doc.text(item.label, margin + 5, y + 3);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(
        `${item.baseline.toFixed(1)}%  →  ${item.current.toFixed(1)}%`,
        margin + 75,
        y + 3,
      );
      doc.setFont("helvetica", "bold");
      doc.setTextColor(
        item.delta > 0 ? AMBER[0] : FOREST[0],
        item.delta > 0 ? AMBER[1] : FOREST[1],
        item.delta > 0 ? AMBER[2] : FOREST[2],
      );
      doc.text(
        `${item.delta > 0 ? "+" : ""}${item.delta.toFixed(1)} percentage points`,
        pageWidth - margin - 5,
        y + 3,
        { align: "right" },
      );
      y += 21;
    });
    text(
      `Confidence threshold: ${Math.round(spatial.confidenceThreshold * 100)}%. Coverage ${spatial.coveragePercent.baseline.toFixed(1)}% → ${spatial.coveragePercent.current.toFixed(1)}%. Low-confidence pixels ${spatial.lowConfidencePercent.baseline.toFixed(1)}% → ${spatial.lowConfidencePercent.current.toFixed(1)}%.`,
      margin,
      contentWidth,
      8,
      FOREST,
      "bold",
    );
    y += 3;
    sectionTitle("Evidence boundary", "Interpretation and limitations");
    text(
      spatial.methodology,
      margin,
      contentWidth,
      9,
      MUTED,
    );
    text(
      spatial.evidenceBoundary,
      margin,
      contentWidth,
      9,
      MUTED,
    );
    text(
      `Source attribution: ${spatial.attribution}`,
      margin,
      contentWidth,
      8,
      MUTED,
    );
  }

  addPage();
  sectionTitle("06 · Sources", "Document and evidence lineage");
  input.documents.forEach((item) => {
    ensure(23);
    text(item.title, margin, contentWidth, 9, INK, "bold");
    text(
      `${item.role.replaceAll("_", " ")} · ${item.authority} · ${item.date} · ${item.pages} ${item.pages === 1 ? "record" : "pages"}`,
      margin,
      contentWidth,
      7.5,
      MUTED,
    );
    text(item.sourceUrl, margin, contentWidth, 6.5, MUTED);
    divider();
  });
  sectionTitle("Evidence lineage", "Available artifacts and integrity notes");
  input.evidence.forEach((item) => {
    ensure(28);
    text(item.title, margin, contentWidth, 8.5, INK, "bold");
    text(item.note, margin, contentWidth, 7.5, MUTED);
    text(`Integrity: ${item.integrity}`, margin, contentWidth, 7.5, MUTED);
    divider();
  });

  ensure(65);
  sectionTitle("07 · Assumptions", "Responsible-use statement");
  [
    "Missing proof is reported as missing evidence, not as non-compliance.",
    "No undocumented polygon, field observation, ecological outcome, or deadline is fabricated.",
    "Uploaded documents are processed for the active session and are not represented as part of the public source set.",
    "Automated extraction and prioritization require expert review before operational use.",
    "This report is decision support and does not constitute legal advice or a regulatory determination.",
  ].forEach((item) => text(`• ${item}`, margin, contentWidth, 8, MUTED));

  const pages = doc.getNumberOfPages();
  for (let page = 2; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(222, 228, 223);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
    doc.text("VERDATRACE", margin, pageHeight - 7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      `${input.projectId}  ·  CONFIDENTIAL REVIEW WORKSPACE`,
      pageWidth / 2,
      pageHeight - 7,
      { align: "center" },
    );
    doc.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 7, {
      align: "right",
    });
  }
  return doc;
}

export async function downloadVerdaTraceReport(input: ReportInput) {
  const doc = await createVerdaTraceReport(input);
  const safeId = input.projectId.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  doc.save(`VerdaTrace-${safeId}-report.pdf`);
}
