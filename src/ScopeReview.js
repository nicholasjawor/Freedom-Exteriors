import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { apiFetch } from "./apiFetch";

// Scope Review (ported from the standalone scope-review app). Every analysis
// and supplement round is kept on the job in job.scopeReviews; carrier PDFs go
// to the private "scope-documents" bucket at {jobId}/{reviewId}.pdf.

const TEAL = "#1a9e99"; const GOLD = "#e8a820"; const DARK = "#080d14";
const PANEL = "#0f1923"; const PANEL2 = "#162030"; const BORDER = "#1e3048";
const TEXT = "#e2eaf4"; const MUTED = "#6b8099"; const GREEN = "#10b981";
const CAT_COLORS = { cascade: "#38bdf8", rebuttal: "#f87171", note: MUTED, supplement: "#a78bfa" };
const STRENGTH_COLORS = { high: GOLD, medium: "#94a3b8", low: MUTED };

const BUCKET = "scope-documents";
const REFERENCES_ID = -3; // reserved jobs row: admin-maintained reference library
const MAX_PDF_BYTES = 25 * 1024 * 1024; // matches the bucket's file size limit
const BATCH_SIZE = 3; // the original app's tuned analyze batch size
const STRENGTH_RANK = { high: 0, medium: 1, low: 2 };
const CATEGORY_RANK = { cascade: 0, rebuttal: 0, note: 1 };

const btn = (color, filled) => ({
  background: filled ? color : `${color}22`, border: `1px solid ${color}`, color: filled ? "#000" : color,
  borderRadius: 7, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
});
const ghostBtn = { background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 7, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const panel = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 14 };
const sectionTitle = { fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 };
const inputStyle = { width: "100%", background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, padding: 10, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };

const newId = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const chunk = (arr, size) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; };

function sortByLeverage(items) {
  return [...items].map((r, i) => ({ r, i })).sort((a, b) => {
    const ca = CATEGORY_RANK[a.r.category] ?? 1, cb = CATEGORY_RANK[b.r.category] ?? 1;
    if (ca !== cb) return ca - cb;
    const ra = STRENGTH_RANK[a.r.strength] ?? 1, rb = STRENGTH_RANK[b.r.strength] ?? 1;
    if (ra !== rb) return ra - rb;
    return a.i - b.i;
  }).map(x => x.r);
}

async function callScope(jobId, mode, payload) {
  const res = await apiFetch("/api/scope-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, jobId, payload }),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function Badge({ color, children }) {
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}55`, borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>{children}</span>;
}

function Confidence({ confidence, detail }) {
  const needs = confidence === "needs_info";
  return <div style={{ fontSize: 11, marginTop: 6, color: needs ? GOLD : GREEN, fontWeight: 600 }}>
    {needs ? `⚠ Needs more info${detail ? ": " + detail : " to confirm"}` : "✓ Confirmed logic"}
  </div>;
}

function ResultItem({ item }) {
  const color = CAT_COLORS[item.category] || MUTED;
  return (
    <div style={{ ...panel, borderLeft: `3px solid ${color}`, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>Line {item.ref}{item.tradeCategory ? ` · ${item.tradeCategory}` : ""}</span>
        <span style={{ display: "flex", gap: 6 }}>
          {item.category !== "note" && <Badge color={STRENGTH_COLORS[item.strength] || MUTED}>{item.strength === "high" ? "HIGH LEVERAGE" : (item.strength || "medium").toUpperCase()}</Badge>}
          <Badge color={color}>{(item.category || "note").toUpperCase()}</Badge>
        </span>
      </div>
      <div style={{ color: TEXT, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{item.itemText}</div>
      <div style={{ color: "#b8c7d9", fontSize: 13, lineHeight: 1.5 }}>{item.explanation}</div>
      <Confidence confidence={item.confidence} />
    </div>
  );
}

function SupplementItem({ item }) {
  return (
    <div style={{ ...panel, borderLeft: `3px solid ${CAT_COLORS.supplement}`, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}>{item.itemLabel}</span>
        <Badge color={CAT_COLORS.supplement}>SUPPLEMENT</Badge>
      </div>
      <div style={{ color: TEXT, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{item.suggestedLineItem}</div>
      <div style={{ color: "#b8c7d9", fontSize: 13, lineHeight: 1.5 }}>{item.justification}</div>
      <Confidence confidence={item.confidence} detail={item.whatToConfirm} />
    </div>
  );
}

function Measurements({ m }) {
  if (!m || !m.totalRoofArea) {
    return <div style={{ ...panel, color: MUTED, fontSize: 13 }}>
      📐 No Hover measurements on this job yet. Close this, click <b>Fetch Measurements</b> on the job page, then come back — the gap check uses them to catch under-measured items.
    </div>;
  }
  const cells = [
    ["Roof area", `${m.totalRoofArea.toLocaleString()} sq ft (${m.squares} SQ)`],
    ["+10% waste", m.areaWithWaste?.plus10 ? `${m.areaWithWaste.plus10.toLocaleString()} sq ft` : "—"],
    ["Pitch", (m.pitches || []).map(p => `${p.pitch} ${Math.round(p.percentage)}%`).join(", ") || m.predominantPitch || "—"],
    ["Low slope (<4/12)", m.lowSlopeArea ? `${m.lowSlopeArea} sq ft` : "none"],
    ["Eaves / rakes", `${m.eavesLength} / ${m.rakeLength} LF`],
    ["Drip edge (eaves+rakes)", `${m.dripEdgeLength} LF`],
    ["Ridges + hips", `${m.ridgeHipLength} LF`],
    ["Valleys", `${m.valleyLength} LF`],
    ["Step flashing", `${m.stepFlashingLength} LF`],
  ];
  return (
    <div style={panel}>
      <div style={{ ...sectionTitle, display: "flex", justifyContent: "space-between" }}>
        <span>📐 Hover measurements</span>
        <span style={{ color: MUTED, fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 11 }}>fetched {new Date(m.fetchedAt).toLocaleDateString()}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
        {cells.map(([k, v]) => (
          <div key={k} style={{ background: PANEL2, borderRadius: 7, padding: "7px 10px" }}>
            <div style={{ color: MUTED, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{k}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GapFinding({ f }) {
  const color = f.type === "missing" ? "#f97316" : GOLD;
  return (
    <div style={{ ...panel, borderLeft: `3px solid ${color}`, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}>{f.title}{f.carrierRef ? <span style={{ color: MUTED, fontWeight: 600 }}> · Line {f.carrierRef}</span> : null}</span>
        <span style={{ display: "flex", gap: 6 }}>
          <Badge color={STRENGTH_COLORS[f.strength] || MUTED}>{f.strength === "high" ? "HIGH LEVERAGE" : (f.strength || "medium").toUpperCase()}</Badge>
          <Badge color={color}>{f.type === "missing" ? "MISSING" : "UNDER-MEASURED"}</Badge>
        </span>
      </div>
      {(f.carrierQuantity || f.measuredQuantity) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div style={{ background: PANEL2, borderRadius: 7, padding: "7px 10px" }}><div style={{ color: MUTED, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Carrier</div><div style={{ fontSize: 13 }}>{f.carrierQuantity || "Not in scope"}</div></div>
          <div style={{ background: PANEL2, borderRadius: 7, padding: "7px 10px" }}><div style={{ color: MUTED, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Measured</div><div style={{ fontSize: 13 }}>{f.measuredQuantity || "—"}</div></div>
        </div>
      )}
      <div style={{ color: TEXT, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{f.suggestedLineItem}</div>
      <div style={{ color: "#b8c7d9", fontSize: 13, lineHeight: 1.5 }}>{f.justification}</div>
      <Confidence confidence={f.confidence} detail={f.whatToConfirm} />
    </div>
  );
}

// Admin-maintained facts Claude may quote verbatim (manufacturer install
// requirements, local code language...). Stored in reserved jobs row -3.
function ReferenceLibrary({ onClose }) {
  const [refs, setRefs] = useState(null);
  const [status, setStatus] = useState("");
  useEffect(() => {
    supabase.from("jobs").select("data").eq("job_id", REFERENCES_ID).maybeSingle()
      .then(({ data, error }) => { if (error) setStatus("Could not load: " + error.message); setRefs(data?.data?.references || []); });
  }, []);
  const update = (i, k, v) => setRefs(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const save = async () => {
    setStatus("Saving…");
    const clean = refs.map(r => ({ title: (r.title || "").trim(), source: (r.source || "").trim(), text: (r.text || "").trim() })).filter(r => r.title && r.text);
    const { error } = await supabase.from("jobs").upsert(
      [{ job_id: REFERENCES_ID, user_email: "config", data: { id: REFERENCES_ID, references: clean } }], { onConflict: "job_id" });
    if (error) { setStatus("Save failed: " + error.message); return; }
    setRefs(clean); setStatus("✓ Saved");
    setTimeout(() => setStatus(""), 1600);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: DARK, zIndex: 400, overflowY: "auto", color: TEXT }}>
      <div style={{ position: "sticky", top: 0, background: PANEL2, borderBottom: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>📚 Reference library</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {status && <span style={{ color: status.startsWith("✓") ? GREEN : MUTED, fontSize: 12 }}>{status}</span>}
          <button onClick={save} disabled={!refs} style={btn(TEAL)}>💾 Save</button>
          <button onClick={onClose} style={ghostBtn}>✕ Close</button>
        </div>
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: 18 }}>
        <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
          Facts you've verified yourself — manufacturer installation requirements, code language you've confirmed with your inspector, and so on. The gap check may quote these word-for-word (naming the title); it will not cite any code, statute, or manufacturer requirement that isn't here. Paste the exact wording and where it came from.
        </div>
        {refs === null ? <div style={{ color: MUTED }}>Loading…</div> : refs.map((r, i) => (
          <div key={i} style={panel}>
            <input value={r.title || ""} onChange={e => update(i, "title", e.target.value)} placeholder="Title, e.g. GAF Timberline HDZ — starter strip requirement" style={{ ...inputStyle, fontWeight: 700, marginBottom: 8 }} />
            <input value={r.source || ""} onChange={e => update(i, "source", e.target.value)} placeholder="Source, e.g. GAF installation instructions, 2025 edition, p. 3" style={{ ...inputStyle, marginBottom: 8, fontSize: 13 }} />
            <textarea value={r.text || ""} onChange={e => update(i, "text", e.target.value)} rows={3} placeholder="Exact wording…" style={{ ...inputStyle, resize: "vertical" }} />
            <button onClick={() => setRefs(rs => rs.filter((_, j) => j !== i))} style={{ ...ghostBtn, marginTop: 8, padding: "5px 10px", fontSize: 12 }}>Remove</button>
          </div>
        ))}
        {refs !== null && <button onClick={() => setRefs(rs => [...rs, { title: "", source: "", text: "" }])} style={btn(GOLD)}>+ Add reference</button>}
      </div>
    </div>
  );
}

export default function ScopeReview({ job, onSave, onClose }) {
  const [reviews, setReviews] = useState(() => (Array.isArray(job.scopeReviews) ? job.scopeReviews : []));
  const [activeId, setActiveId] = useState(() => (Array.isArray(job.scopeReviews) && job.scopeReviews.length ? job.scopeReviews[job.scopeReviews.length - 1].id : null));
  const [creating, setCreating] = useState(!(Array.isArray(job.scopeReviews) && job.scopeReviews.length));
  const [claimLabel, setClaimLabel] = useState([job.name, job.claimNum].filter(Boolean).join(" — "));
  const [scopeText, setScopeText] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [busy, setBusy] = useState(""); // "" | "analysis" | "adjuster" | "homeowner" | "supplement" | "letter:<roundId>"
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [sortMode, setSortMode] = useState("leverage");
  const [supplementNotes, setSupplementNotes] = useState("");
  const [copied, setCopied] = useState("");
  const [fieldNotes, setFieldNotes] = useState("");
  const [showRefs, setShowRefs] = useState(false);

  const review = reviews.find(r => r.id === activeId) || null;

  // Latest list, so saves made after an await never build on a stale copy.
  const reviewsRef = useRef(reviews);
  const saveReviews = (next) => { reviewsRef.current = next; setReviews(next); onSave({ scopeReviews: next }); };
  const updateReview = (id, patch) => saveReviews(reviewsRef.current.map(r => r.id === id ? { ...r, ...patch } : r));
  const flash = (what) => { setCopied(what); setTimeout(() => setCopied(""), 1600); };
  const copy = (text, what) => navigator.clipboard.writeText(text).then(() => flash(what)).catch(() => {});

  const handlePdfSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { setError("That doesn't look like a PDF. Try again or paste the text instead."); return; }
    if (file.size > MAX_PDF_BYTES) { setError("That PDF is larger than 25MB — try a smaller export, or paste the text instead."); return; }
    setError(""); setPdfFile(file); setScopeText("");
  };

  const runAnalysis = async () => {
    setError("");
    if (!pdfFile && !scopeText.trim()) { setError("Paste a scope of work or upload a PDF first."); return; }
    const reviewId = newId();
    let pdfPath = null;
    setBusy("analysis");
    try {
      let items, documentType;
      if (pdfFile) {
        setProgress("Uploading PDF…");
        pdfPath = `${job.id}/${reviewId}.pdf`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfFile, { contentType: "application/pdf" });
        if (upErr) throw new Error("PDF upload failed: " + upErr.message);
        setProgress("Reading PDF…");
        ({ items, documentType } = await callScope(job.id, "extractPdf", { pdfPath }));
      } else {
        setProgress("Reading line items…");
        ({ items, documentType } = await callScope(job.id, "extract", { scopeText }));
      }
      if (documentType === "coverage_summary") {
        throw new Error("This looks like a coverage letter or payment summary (coverage totals like Dwelling, Deductible, Depreciation) — not the itemized estimate. Upload the carrier's full estimate with numbered repair line items (usually titled \"Estimate\" or \"Statement of Loss\", 5-20 pages).");
      }
      if (!items || items.length === 0) throw new Error("Couldn't find any line items in that.");

      const results = [];
      const batches = chunk(items, BATCH_SIZE);
      for (let i = 0; i < batches.length; i++) {
        setProgress(`Analyzing item ${Math.min((i + 1) * BATCH_SIZE, items.length)} of ${items.length}…`);
        const batch = batches[i];
        const { results: batchResults } = await callScope(job.id, "analyze", { items: batch });
        (batchResults || []).forEach((r, idx) => results.push({
          ref: r.ref || batch[idx]?.ref || "",
          itemText: r.itemText || batch[idx]?.text || "",
          tradeCategory: r.tradeCategory || "",
          category: ["cascade", "rebuttal", "note"].includes(r.category) ? r.category : "note",
          strength: ["high", "medium", "low"].includes(r.strength) ? r.strength : "medium",
          explanation: r.explanation || "",
          confidence: r.confidence === "needs_info" ? "needs_info" : "confirmed",
        }));
      }

      const newReview = {
        id: reviewId,
        createdAt: new Date().toISOString(),
        claimLabel: claimLabel.trim() || job.name || "Untitled",
        source: pdfFile ? { kind: "pdf", pdfPath, fileName: pdfFile.name } : { kind: "text", text: scopeText },
        results,
        coverParagraph: "",
        homeownerSummary: "",
        shareSummaryWithHomeowner: false,
        supplements: [],
      };
      saveReviews([...reviewsRef.current, newReview]);
      setActiveId(reviewId);
      setCreating(false);
      setScopeText(""); setPdfFile(null); setSupplementNotes("");
    } catch (e) {
      if (pdfPath) supabase.storage.from(BUCKET).remove([pdfPath]).catch(() => {});
      setError(e.message || "Something went wrong during analysis.");
    } finally {
      setBusy(""); setProgress("");
    }
  };

  const generateCover = async (audience) => {
    if (!review) return;
    setError(""); setBusy(audience);
    try {
      const cascadeItems = review.results.filter(r => r.category === "cascade").map(r => r.itemText);
      const rebuttalItems = review.results.filter(r => r.category === "rebuttal").map(r => r.itemText);
      const { text } = await callScope(job.id, "cover", { claimLabel: review.claimLabel, cascadeItems, rebuttalItems, audience });
      updateReview(review.id, audience === "homeowner"
        ? { homeownerSummary: text, shareSummaryWithHomeowner: false } // a new summary must be re-approved before it shows in the portal
        : { coverParagraph: text });
    } catch (e) {
      setError(e.message || "Could not generate that summary.");
    } finally { setBusy(""); }
  };

  const generateSupplementItems = async () => {
    if (!review) return;
    if (!supplementNotes.trim()) { setError("Describe the additional damage or findings first."); return; }
    setError(""); setBusy("supplement");
    try {
      const originalItems = review.results.map(r => ({ category: r.category, itemText: r.itemText }));
      const { items } = await callScope(job.id, "supplementItems", { supplementNotes, originalItems });
      const round = {
        id: newId(),
        createdAt: new Date().toISOString(),
        notes: supplementNotes,
        items: (items || []).map(it => ({
          itemLabel: it.itemLabel || "Supplement item",
          suggestedLineItem: it.suggestedLineItem || "",
          justification: it.justification || "",
          confidence: it.confidence === "needs_info" ? "needs_info" : "confirmed",
          whatToConfirm: it.whatToConfirm || "",
        })),
        letter: "",
      };
      updateReview(review.id, { supplements: [...(review.supplements || []), round] });
      setSupplementNotes("");
    } catch (e) {
      setError(e.message || "Could not generate the supplement items.");
    } finally { setBusy(""); }
  };

  const generateSupplementLetter = async (round) => {
    if (!review || !round.items.length) return;
    setError(""); setBusy("letter:" + round.id);
    try {
      const { text } = await callScope(job.id, "supplementLetter", { claimLabel: review.claimLabel, supplementItems: round.items });
      updateReview(review.id, { supplements: (review.supplements || []).map(s => s.id === round.id ? { ...s, letter: text } : s) });
    } catch (e) {
      setError(e.message || "Could not generate the supplement letter.");
    } finally { setBusy(""); }
  };

  const runGapCheck = async () => {
    if (!review) return;
    setError(""); setBusy("gap");
    try {
      const { findings, usedMeasurements, usedReferences } = await callScope(job.id, "gapCheck", {
        items: review.results.map(r => ({ ref: r.ref, itemText: r.itemText })),
        fieldNotes,
      });
      const check = {
        id: newId(),
        createdAt: new Date().toISOString(),
        fieldNotes,
        usedMeasurements: !!usedMeasurements,
        usedReferences: usedReferences || [],
        findings: (findings || []).map(f => ({
          type: f.type === "missing" ? "missing" : "quantity",
          title: f.title || "Finding",
          carrierRef: f.carrierRef || "",
          carrierQuantity: f.carrierQuantity || "",
          measuredQuantity: f.measuredQuantity || "",
          suggestedLineItem: f.suggestedLineItem || "",
          justification: f.justification || "",
          strength: ["high", "medium", "low"].includes(f.strength) ? f.strength : "medium",
          confidence: f.confidence === "needs_info" ? "needs_info" : "confirmed",
          whatToConfirm: f.whatToConfirm || "",
        })).sort((a, b) => (STRENGTH_RANK[a.strength] ?? 1) - (STRENGTH_RANK[b.strength] ?? 1)),
      };
      const current = reviewsRef.current.find(r => r.id === review.id);
      updateReview(review.id, { gapChecks: [...(current?.gapChecks || []), check] });
      setFieldNotes("");
    } catch (e) {
      setError(e.message || "Could not run the gap check.");
    } finally { setBusy(""); }
  };

  const openOriginalPdf = async () => {
    if (!review?.source?.pdfPath) return;
    const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(review.source.pdfPath, 120);
    if (signErr || !data?.signedUrl) { setError("Could not open the original PDF."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const buildReport = () => {
    if (!review) return "";
    const groups = { cascade: [], rebuttal: [], note: [] };
    sortByLeverage(review.results).forEach(r => (groups[r.category] || groups.note).push(r));
    let out = (review.claimLabel ? review.claimLabel + "\n" : "") + "Scope Review — generated " + new Date(review.createdAt).toLocaleDateString() + "\n\n";
    if (review.coverParagraph) out += "Adjuster paragraph:\n" + review.coverParagraph + "\n\n";
    if (review.homeownerSummary) out += "Homeowner summary:\n" + review.homeownerSummary + "\n\n";
    const section = (title, list, detailed) => {
      if (!list.length) return;
      out += title + "\n";
      list.forEach(r => { out += "  Line " + r.ref + (detailed ? " [" + r.tradeCategory + "] (" + r.strength + ")" : "") + " — " + r.itemText + "\n  " + r.explanation + "\n\n"; });
    };
    section("CASCADE — approved work that disturbs adjacent systems", groups.cascade, true);
    section("REBUTTAL — denied, missing, or undervalued items", groups.rebuttal, true);
    section("NOTE — routine, not in dispute", groups.note, false);
    const lastGap = (review.gapChecks || []).at(-1);
    if (lastGap?.findings?.length) {
      out += "SCOPE GAPS & MEASUREMENT DISCREPANCIES (" + new Date(lastGap.createdAt).toLocaleDateString() + ")\n";
      lastGap.findings.forEach(f => {
        out += "  " + (f.type === "missing" ? "[MISSING] " : "[UNDER-MEASURED] ") + f.title + (f.carrierRef ? " (Line " + f.carrierRef + ")" : "") + " (" + f.strength + ")\n";
        if (f.carrierQuantity || f.measuredQuantity) out += "  Carrier: " + (f.carrierQuantity || "not in scope") + " | Measured: " + (f.measuredQuantity || "—") + "\n";
        out += "  Suggested: " + f.suggestedLineItem + "\n  " + f.justification + "\n\n";
      });
    }
    (review.supplements || []).forEach((s, i) => {
      out += `SUPPLEMENT ROUND ${i + 1} (${new Date(s.createdAt).toLocaleDateString()}) — additional items requested\n`;
      s.items.forEach(it => { out += "  " + it.itemLabel + " — " + it.suggestedLineItem + "\n  " + it.justification + "\n\n"; });
      if (s.letter) out += "Supplement letter:\n" + s.letter + "\n\n";
    });
    return out;
  };

  const counts = review ? {
    cascade: review.results.filter(r => r.category === "cascade").length,
    rebuttal: review.results.filter(r => r.category === "rebuttal").length,
    note: review.results.filter(r => r.category === "note").length,
  } : null;
  const displayResults = review ? (sortMode === "leverage" ? sortByLeverage(review.results) : review.results) : [];
  const working = !!busy;

  return (
    <div style={{ position: "fixed", inset: 0, background: DARK, zIndex: 300, overflowY: "auto", WebkitOverflowScrolling: "touch", color: TEXT }}>
      <div style={{ position: "sticky", top: 0, background: PANEL2, borderBottom: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5, gap: 10 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: 1 }}>
          <span style={{ color: TEAL }}>FREEDOM </span><span style={{ color: GOLD }}>EXTERIORS</span>
          <span style={{ color: MUTED, fontWeight: 500, fontSize: 13, marginLeft: 10 }}>Scope Review</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowRefs(true)} disabled={working} style={ghostBtn}>📚 References</button>
          <button onClick={onClose} disabled={working} style={{ ...ghostBtn, opacity: working ? 0.5 : 1 }}>✕ Close</button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: 18 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ color: MUTED, fontSize: 13 }}>{job.name} · {job.address}, {job.city}, {job.state}{job.insurer ? ` · ${job.insurer}` : ""}</div>
        </div>

        {reviews.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <select value={creating ? "" : (activeId || "")} disabled={working}
              onChange={e => { setActiveId(e.target.value); setCreating(false); setError(""); }}
              style={{ ...inputStyle, flex: 1, minWidth: 200, width: "auto" }}>
              {creating && <option value="">New analysis…</option>}
              {[...reviews].reverse().map(r => (
                <option key={r.id} value={r.id}>
                  {new Date(r.createdAt).toLocaleString()} — {r.claimLabel} ({r.results.length} items{r.supplements?.length ? `, ${r.supplements.length} supplement round${r.supplements.length === 1 ? "" : "s"}` : ""})
                </option>
              ))}
            </select>
            {!creating && <button onClick={() => { setCreating(true); setError(""); }} disabled={working} style={btn(TEAL)}>+ New analysis</button>}
          </div>
        )}

        {creating && (
          <div style={panel}>
            <div style={sectionTitle}>New analysis</div>
            <label style={{ display: "block", color: MUTED, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Claim reference</label>
            <input value={claimLabel} onChange={e => setClaimLabel(e.target.value)} style={inputStyle} />
            <label style={{ display: "block", color: MUTED, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: "12px 0 4px" }}>Carrier scope of work</label>
            <textarea value={scopeText} disabled={!!pdfFile} rows={8}
              onChange={e => { setScopeText(e.target.value); if (pdfFile) setPdfFile(null); }}
              placeholder={"Paste the carrier's line items here, e.g.:\n2  Remove - Roof Vent, Static Box/Turtle, Aluminum   3 EA\n3  Replace - Roof Vent, Static Box/Turtle, Aluminum  3 EA  $81.24"}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0", flexWrap: "wrap" }}>
              <span style={{ color: MUTED, fontSize: 12 }}>— or —</span>
              {!pdfFile ? (
                <label style={{ ...ghostBtn, display: "inline-block" }}>
                  📄 Upload carrier PDF
                  <input type="file" accept="application/pdf" onChange={handlePdfSelect} style={{ display: "none" }} />
                </label>
              ) : (
                <span style={{ background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "7px 10px", fontSize: 13 }}>
                  📄 {pdfFile.name} <button onClick={() => setPdfFile(null)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer" }} aria-label="Remove PDF">✕</button>
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={runAnalysis} disabled={working} style={{ ...btn(GOLD, true), opacity: working ? 0.6 : 1 }}>{busy === "analysis" ? "Working…" : "Analyze scope"}</button>
              {reviews.length > 0 && <button onClick={() => { setCreating(false); setError(""); }} disabled={working} style={ghostBtn}>Cancel</button>}
              {progress && <span style={{ color: MUTED, fontSize: 12 }}>{progress}</span>}
            </div>
          </div>
        )}

        {error && <div style={{ background: "#7c2d1222", border: "1px solid #7c2d12", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13, marginBottom: 14, whiteSpace: "pre-wrap" }}>{error}</div>}

        {!creating && review && (
          <>
            <Measurements m={job.hoverMeasurements} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
              {[["cascade", "Cascade"], ["rebuttal", "Rebuttal"], ["note", "Note"]].map(([k, label]) => (
                <div key={k} style={{ ...panel, marginBottom: 0, textAlign: "center", borderTop: `3px solid ${CAT_COLORS[k]}` }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: CAT_COLORS[k] }}>{counts[k]}</div>
                  <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button onClick={() => copy(buildReport(), "report")} style={ghostBtn}>{copied === "report" ? "✓ Copied" : "📋 Copy report as text"}</button>
              <button onClick={() => generateCover("adjuster")} disabled={working} style={btn(TEAL)}>{busy === "adjuster" ? "Writing…" : review.coverParagraph ? "↻ Adjuster paragraph" : "Generate adjuster paragraph"}</button>
              <button onClick={() => generateCover("homeowner")} disabled={working} style={btn(GREEN)}>{busy === "homeowner" ? "Writing…" : review.homeownerSummary ? "↻ Homeowner summary" : "Generate homeowner summary"}</button>
              {review.source?.kind === "pdf" && <button onClick={openOriginalPdf} style={ghostBtn}>📄 Original PDF</button>}
            </div>

            {review.coverParagraph && (
              <div style={panel}>
                <div style={sectionTitle}>For the adjuster — rebuttal letter opening paragraph</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{review.coverParagraph}</div>
                <button onClick={() => copy(review.coverParagraph, "cover")} style={{ ...ghostBtn, marginTop: 10 }}>{copied === "cover" ? "✓ Copied" : "Copy"}</button>
              </div>
            )}

            {review.homeownerSummary && (
              <div style={{ ...panel, borderColor: review.shareSummaryWithHomeowner ? GREEN : BORDER }}>
                <div style={sectionTitle}>For the homeowner — plain-language summary</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{review.homeownerSummary}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => updateReview(review.id, { shareSummaryWithHomeowner: !review.shareSummaryWithHomeowner })} style={btn(review.shareSummaryWithHomeowner ? GREEN : MUTED, review.shareSummaryWithHomeowner)}>
                    {review.shareSummaryWithHomeowner ? "✓ Shown in customer portal" : "Share with homeowner (portal)"}
                  </button>
                  <button onClick={() => copy(review.homeownerSummary, "homeowner")} style={ghostBtn}>{copied === "homeowner" ? "✓ Copied" : "Copy"}</button>
                </div>
                <div style={{ color: MUTED, fontSize: 11, marginTop: 8 }}>
                  {review.shareSummaryWithHomeowner ? "The homeowner sees this summary on their portal page. Click again to hide it." : "Not visible to the homeowner until you share it."}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <span style={{ color: MUTED, fontSize: 12 }}>Sort:</span>
              {[["leverage", "By leverage"], ["order", "Estimate order"]].map(([k, label]) => (
                <button key={k} onClick={() => setSortMode(k)} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12, ...(sortMode === k ? { color: GOLD, borderColor: GOLD } : {}) }}>{label}</button>
              ))}
            </div>
            {displayResults.map((r, i) => <ResultItem key={i} item={r} />)}

            <div style={{ ...panel, marginTop: 18, borderColor: "#f9731655" }}>
              <div style={sectionTitle}>Scope gaps & measurement check</div>
              <div style={{ color: MUTED, fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>
                Reviews the carrier's whole scope against this roof{job.hoverMeasurements?.totalRoofArea ? " and its Hover measurements" : ""}: items a complete scope needs that aren't there, and quantities lower than measured. Add anything you saw on site that the estimate can't show (layers, decking, vents, satellite dish, gutter guards…).
              </div>
              {(review.gapChecks || []).map((g, i, all) => (
                <div key={g.id} style={{ marginBottom: 14, opacity: i === all.length - 1 ? 1 : 0.75 }}>
                  <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Check {i + 1} · {new Date(g.createdAt).toLocaleString()} · {g.usedMeasurements ? "with Hover measurements" : "no measurements"}{g.usedReferences?.length ? ` · ${g.usedReferences.length} reference${g.usedReferences.length === 1 ? "" : "s"}` : ""}
                  </div>
                  {g.fieldNotes && <div style={{ color: "#b8c7d9", fontSize: 12, fontStyle: "italic", marginBottom: 8, whiteSpace: "pre-wrap" }}>“{g.fieldNotes}”</div>}
                  {g.findings.length ? g.findings.map((f, j) => <GapFinding key={j} f={f} />) : <div style={{ color: GREEN, fontSize: 13, marginBottom: 8 }}>✓ No gaps or under-measured items found.</div>}
                </div>
              ))}
              <textarea value={fieldNotes} onChange={e => setFieldNotes(e.target.value)} rows={3}
                placeholder="Optional site notes, e.g. 2 layers of shingles on the garage, soft decking at the north eave, 3 box vents + 1 power vent, satellite dish on the south slope."
                style={{ ...inputStyle, resize: "vertical" }} />
              <button onClick={runGapCheck} disabled={working} style={{ ...btn("#f97316", true), marginTop: 10, opacity: working ? 0.6 : 1 }}>
                {busy === "gap" ? "Checking…" : (review.gapChecks || []).length ? "↻ Run gap check again" : "🔍 Run gap & measurement check"}
              </button>
            </div>

            <div style={{ ...panel, marginTop: 18 }}>
              <div style={sectionTitle}>Supplements</div>
              {(review.supplements || []).map((round, i) => (
                <div key={round.id} style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 14, marginBottom: 14 }}>
                  <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Round {i + 1} · {new Date(round.createdAt).toLocaleString()}</div>
                  <div style={{ color: "#b8c7d9", fontSize: 12, fontStyle: "italic", marginBottom: 10, whiteSpace: "pre-wrap" }}>“{round.notes}”</div>
                  {round.items.map((it, j) => <SupplementItem key={j} item={it} />)}
                  {round.letter ? (
                    <div style={{ background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
                      <div style={{ color: MUTED, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Supplement request letter — draft, review before sending</div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{round.letter}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={() => copy(round.letter, "letter:" + round.id)} style={ghostBtn}>{copied === "letter:" + round.id ? "✓ Copied" : "Copy letter"}</button>
                        <button onClick={() => generateSupplementLetter(round)} disabled={working} style={ghostBtn}>{busy === "letter:" + round.id ? "Writing…" : "↻ Rewrite"}</button>
                      </div>
                    </div>
                  ) : round.items.length > 0 && (
                    <button onClick={() => generateSupplementLetter(round)} disabled={working} style={btn(CAT_COLORS.supplement)}>{busy === "letter:" + round.id ? "Writing…" : "Generate supplement letter"}</button>
                  )}
                </div>
              ))}
              <div style={{ color: MUTED, fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
                {(review.supplements || []).length ? "Found more? Start another round." : "Found something new?"} Describe damage or findings the original estimate doesn't cover — e.g. "skylight has cracked glazing from hail, not just flashing damage" or "found rotted decking under the tear-off." Mention specific locations if you can.
              </div>
              <textarea value={supplementNotes} onChange={e => setSupplementNotes(e.target.value)} rows={4}
                placeholder="e.g. The skylight above the kitchen has visible hail-fractured glazing on the outer pane, confirmed during the site visit — this needs full unit replacement, not the flashing-kit repair the carrier scoped."
                style={{ ...inputStyle, resize: "vertical" }} />
              <button onClick={generateSupplementItems} disabled={working} style={{ ...btn(GOLD, true), marginTop: 10, opacity: working ? 0.6 : 1 }}>{busy === "supplement" ? "Working…" : "Generate supplement items"}</button>
            </div>
          </>
        )}

        <div style={{ color: MUTED, fontSize: 11, lineHeight: 1.6, marginTop: 20, textAlign: "center" }}>
          Every finding here is a starting argument for review, not a final word — confirm anything marked "needs more info" against photos, measurements, or product specs before it goes in writing. This tool does not address insurance policy language or coverage; that stays with the homeowner.
        </div>
      </div>
      {showRefs && <ReferenceLibrary onClose={() => setShowRefs(false)} />}
    </div>
  );
}
