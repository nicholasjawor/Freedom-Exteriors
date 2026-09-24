import { useRef, useState } from "react";
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
      let items;
      if (pdfFile) {
        setProgress("Uploading PDF…");
        pdfPath = `${job.id}/${reviewId}.pdf`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfFile, { contentType: "application/pdf" });
        if (upErr) throw new Error("PDF upload failed: " + upErr.message);
        setProgress("Reading PDF…");
        ({ items } = await callScope(job.id, "extractPdf", { pdfPath }));
      } else {
        setProgress("Reading line items…");
        ({ items } = await callScope(job.id, "extract", { scopeText }));
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
        <button onClick={onClose} disabled={working} style={{ ...ghostBtn, opacity: working ? 0.5 : 1 }}>✕ Close</button>
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
    </div>
  );
}
