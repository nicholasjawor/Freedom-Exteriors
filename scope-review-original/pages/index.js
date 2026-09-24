import { useState, useEffect } from "react";

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8MB, comfortably under the API route's body limit
const STRENGTH_RANK = { high: 0, medium: 1, low: 2 };
const CATEGORY_RANK = { cascade: 0, rebuttal: 0, note: 1 };

async function postJson(mode, payload) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === "string" ? result.split(",")[1] : "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sortByLeverage(items) {
  return [...items]
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ca = CATEGORY_RANK[a.r.category] ?? 1;
      const cb = CATEGORY_RANK[b.r.category] ?? 1;
      if (ca !== cb) return ca - cb;
      const ra = STRENGTH_RANK[a.r.strength] ?? 1;
      const rb = STRENGTH_RANK[b.r.strength] ?? 1;
      if (ra !== rb) return ra - rb;
      return a.i - b.i;
    })
    .map((x) => x.r);
}

function StrengthBadge({ strength, category }) {
  if (category === "note") return null;
  const map = {
    high: ["HIGH LEVERAGE", "strength-high"],
    medium: ["MEDIUM", "strength-medium"],
    low: ["LOW", "strength-low"],
  };
  const [label, cls] = map[strength] || map.medium;
  return <span className={"strength " + cls}>{label}</span>;
}

function Tag({ category }) {
  const map = {
    cascade: ["CASCADE", "tag-cascade"],
    rebuttal: ["REBUTTAL", "tag-rebuttal"],
    note: ["NOTE", "tag-note"],
  };
  const [label, cls] = map[category] || map.note;
  return <span className={"tag " + cls}>{label}</span>;
}

function ResultItem({ item }) {
  return (
    <div className={"item cat-" + item.category}>
      <div className="item-top">
        <span className="item-ref">
          Line {item.ref}
          {item.tradeCategory ? <span className="item-trade"> · {item.tradeCategory}</span> : null}
        </span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <StrengthBadge strength={item.strength} category={item.category} />
          <Tag category={item.category} />
        </span>
      </div>
      <div className="item-text">{item.itemText}</div>
      <div className="item-body">{item.explanation}</div>
      <div className={"item-conf" + (item.confidence === "needs_info" ? " needs-info" : "")}>
        {item.confidence === "needs_info" ? "⚠ Needs more info to confirm" : "✓ Confirmed logic"}
      </div>
    </div>
  );
}

function SupplementItem({ item }) {
  return (
    <div className="item cat-supplement">
      <div className="item-top">
        <span className="item-ref">{item.itemLabel}</span>
        <span className="tag tag-supplement">SUPPLEMENT</span>
      </div>
      <div className="item-text">{item.suggestedLineItem}</div>
      <div className="item-body">{item.justification}</div>
      <div className={"item-conf" + (item.confidence === "needs_info" ? " needs-info" : "")}>
        {item.confidence === "needs_info"
          ? "⚠ Needs more info: " + item.whatToConfirm
          : "✓ Confirmed logic"}
      </div>
    </div>
  );
}

export default function Home() {
  const [claimLabel, setClaimLabel] = useState("");
  const [scopeText, setScopeText] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [results, setResults] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | extracting | analyzing | done | error
  const [progress, setProgress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [coverParagraph, setCoverParagraph] = useState("");
  const [coverStatus, setCoverStatus] = useState("idle");
  const [homeownerSummary, setHomeownerSummary] = useState("");
  const [homeownerStatus, setHomeownerStatus] = useState("idle");
  const [sortMode, setSortMode] = useState("leverage"); // "leverage" | "order"
  const [supplementNotes, setSupplementNotes] = useState("");
  const [supplementItems, setSupplementItems] = useState(null);
  const [supplementStatus, setSupplementStatus] = useState("idle");
  const [supplementLetter, setSupplementLetter] = useState("");
  const [letterStatus, setLetterStatus] = useState("idle");

  const refreshHistory = async () => {
    setHistoryError("");
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load history");
      setHistory(data.list || []);
    } catch (e) {
      setHistoryError(e.message || "Could not load past analyses.");
      setHistory([]);
    }
    setHistoryLoaded(true);
  };

  const toggleHistory = async () => {
    if (!historyLoaded) await refreshHistory();
    setShowHistory((s) => !s);
  };

  useEffect(() => {
    // Preload quietly so "Past analyses" opens instantly the first time it's clicked.
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePdfSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (file.type !== "application/pdf") {
      setErrorMsg("That doesn't look like a PDF. Try again or paste the text instead.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setErrorMsg("That PDF is larger than 8MB — try a smaller export, or paste the text instead.");
      return;
    }
    setErrorMsg("");
    setPdfFile(file);
    setScopeText("");
  };

  const clearPdf = () => setPdfFile(null);

  const runAnalysis = async () => {
    setErrorMsg("");
    setResults(null);
    setCoverParagraph("");
    setHomeownerSummary("");
    setSupplementNotes("");
    setSupplementItems(null);
    setSupplementLetter("");
    setSupplementStatus("idle");
    setLetterStatus("idle");
    if (!pdfFile && !scopeText.trim()) {
      setErrorMsg("Paste a scope of work or upload a PDF first.");
      return;
    }
    try {
      setStatus("extracting");
      let items;
      if (pdfFile) {
        setProgress("Reading PDF…");
        const pdfBase64 = await readFileAsBase64(pdfFile);
        const extracted = await postJson("extractPdf", {
          pdfBase64,
          mediaType: pdfFile.type || "application/pdf",
        });
        items = extracted.items;
      } else {
        setProgress("Reading line items…");
        const extracted = await postJson("extract", { scopeText });
        items = extracted.items;
      }
      if (!items || items.length === 0) {
        throw new Error("Couldn't find any line items in that.");
      }

      setStatus("analyzing");
      const batches = chunk(items, 3);
      const allResults = [];
      for (let i = 0; i < batches.length; i++) {
        setProgress(
          "Analyzing item " + Math.min((i + 1) * 3, items.length) + " of " + items.length + "…"
        );
        const batch = batches[i];
        const { results: batchResults } = await postJson("analyze", { items: batch });
        batchResults.forEach((r, idx) => {
          allResults.push({
            ref: r.ref || batch[idx].ref,
            itemText: r.itemText || batch[idx].text,
            tradeCategory: r.tradeCategory || "",
            category: ["cascade", "rebuttal", "note"].includes(r.category) ? r.category : "note",
            strength: ["high", "medium", "low"].includes(r.strength) ? r.strength : "medium",
            explanation: r.explanation || "",
            confidence: r.confidence === "needs_info" ? "needs_info" : "confirmed",
          });
        });
      }
      setResults(allResults);
      setStatus("done");
      setProgress("");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "Something went wrong during analysis.");
    }
  };

  const generateCover = async (audience) => {
    if (!results) return;
    const setBusy = audience === "homeowner" ? setHomeownerStatus : setCoverStatus;
    setBusy("working");
    try {
      const cascadeItems = results.filter((r) => r.category === "cascade").map((r) => r.itemText);
      const rebuttalItems = results.filter((r) => r.category === "rebuttal").map((r) => r.itemText);
      const { text } = await postJson("cover", { claimLabel, cascadeItems, rebuttalItems, audience });
      if (audience === "homeowner") setHomeownerSummary(text);
      else setCoverParagraph(text);
      setBusy("done");
    } catch (e) {
      setErrorMsg(e.message || "Could not generate that summary.");
      setBusy("idle");
    }
  };

  const generateSupplementItems = async () => {
    if (!supplementNotes.trim()) {
      setErrorMsg("Describe the additional damage or findings first.");
      return;
    }
    setErrorMsg("");
    setSupplementStatus("working");
    setSupplementItems(null);
    setSupplementLetter("");
    try {
      const originalItems = (results || []).map((r) => ({ category: r.category, itemText: r.itemText }));
      const { items } = await postJson("supplementItems", { supplementNotes, originalItems });
      setSupplementItems(
        (items || []).map((it) => ({
          itemLabel: it.itemLabel || "Supplement item",
          suggestedLineItem: it.suggestedLineItem || "",
          justification: it.justification || "",
          confidence: it.confidence === "needs_info" ? "needs_info" : "confirmed",
          whatToConfirm: it.whatToConfirm || "",
        }))
      );
      setSupplementStatus("done");
    } catch (e) {
      setSupplementStatus("idle");
      setErrorMsg(e.message || "Could not generate the supplement items.");
    }
  };

  const generateSupplementLetter = async () => {
    if (!supplementItems || supplementItems.length === 0) return;
    setLetterStatus("working");
    try {
      const { text } = await postJson("supplementLetter", { claimLabel, supplementItems });
      setSupplementLetter(text);
      setLetterStatus("done");
    } catch (e) {
      setErrorMsg(e.message || "Could not generate the supplement letter.");
      setLetterStatus("idle");
    }
  };

  const copySupplementLetter = () => {
    if (!supplementLetter) return;
    navigator.clipboard.writeText(supplementLetter).catch(() => {});
  };
  const copyReport = () => {
    if (!results) return;
    const ordered = sortByLeverage(results);
    const groups = { cascade: [], rebuttal: [], note: [] };
    ordered.forEach((r) => groups[r.category].push(r));
    let out =
      (claimLabel ? claimLabel + "\n" : "") +
      "Scope Review — generated " + new Date().toLocaleDateString() + "\n\n";
    if (coverParagraph) out += "Adjuster paragraph:\n" + coverParagraph + "\n\n";
    if (homeownerSummary) out += "Homeowner summary:\n" + homeownerSummary + "\n\n";
    if (groups.cascade.length) {
      out += "CASCADE — approved work that disturbs adjacent systems\n";
      groups.cascade.forEach((r) => {
        out += "  Line " + r.ref + " [" + r.tradeCategory + "] (" + r.strength + ") — " + r.itemText + "\n  " + r.explanation + "\n\n";
      });
    }
    if (groups.rebuttal.length) {
      out += "REBUTTAL — denied, missing, or undervalued items\n";
      groups.rebuttal.forEach((r) => {
        out += "  Line " + r.ref + " [" + r.tradeCategory + "] (" + r.strength + ") — " + r.itemText + "\n  " + r.explanation + "\n\n";
      });
    }
    if (groups.note.length) {
      out += "NOTE — routine, not in dispute\n";
      groups.note.forEach((r) => {
        out += "  Line " + r.ref + " — " + r.itemText + "\n  " + r.explanation + "\n\n";
      });
    }
    if (supplementItems && supplementItems.length) {
      out += "SUPPLEMENT — additional items requested\n";
      supplementItems.forEach((it) => {
        out += "  " + it.itemLabel + " — " + it.suggestedLineItem + "\n  " + it.justification + "\n\n";
      });
    }
    if (supplementLetter) out += "Supplement letter:\n" + supplementLetter + "\n\n";
    navigator.clipboard.writeText(out).catch(() => {});
  };

  const saveCurrent = async () => {
    if (!results || results.length === 0) return;
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          claimLabel: claimLabel || "Untitled",
          scopeText,
          results,
          coverParagraph,
          homeownerSummary,
          supplementNotes,
          supplementItems,
          supplementLetter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      await refreshHistory();
    } catch (e) {
      setErrorMsg(e.message || "Could not save this analysis.");
    }
  };

  const loadRecord = async (rec) => {
    try {
      const res = await fetch("/api/history?id=" + encodeURIComponent(rec.id));
      const data = await res.json();
      if (!res.ok || !data.record) throw new Error(data.error || "Could not open that analysis");
      const full = data.record;
      setClaimLabel(full.claim_label);
      setScopeText(full.scope_text || "");
      setPdfFile(null);
      setResults(full.results);
      setCoverParagraph(full.cover_paragraph || "");
      setHomeownerSummary(full.homeowner_summary || "");
      setSupplementNotes(full.supplement_notes || "");
      setSupplementItems(full.supplement_items || null);
      setSupplementLetter(full.supplement_letter || "");
      setSupplementStatus(full.supplement_items ? "done" : "idle");
      setLetterStatus(full.supplement_letter ? "done" : "idle");
      setStatus("done");
      setShowHistory(false);
    } catch (e) {
      setErrorMsg(e.message || "Could not open that analysis.");
    }
  };

  const deleteRecord = async (rec) => {
    try {
      const res = await fetch("/api/history?id=" + encodeURIComponent(rec.id), { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete");
      await refreshHistory();
    } catch (e) {
      setErrorMsg(e.message || "Could not delete that analysis.");
    }
  };

  const startNew = () => {
    setClaimLabel("");
    setScopeText("");
    setPdfFile(null);
    setResults(null);
    setCoverParagraph("");
    setHomeownerSummary("");
    setSupplementNotes("");
    setSupplementItems(null);
    setSupplementLetter("");
    setSupplementStatus("idle");
    setLetterStatus("idle");
    setStatus("idle");
    setErrorMsg("");
  };

  const counts = results
    ? {
        cascade: results.filter((r) => r.category === "cascade").length,
        rebuttal: results.filter((r) => r.category === "rebuttal").length,
        note: results.filter((r) => r.category === "note").length,
      }
    : null;

  const busy = status === "extracting" || status === "analyzing";
  const displayResults = results ? (sortMode === "leverage" ? sortByLeverage(results) : results) : null;

  return (
    <div id="app">
      <div className="head">
        <div className="mark">
          FREEDOM<span>·</span>EXTERIORS <span>Scope Review</span>
        </div>
        <div className="sub">
          Paste a carrier's scope of work, or upload a PDF. Get a line-by-line rebuttal or trade-sequence explanation for each item.
        </div>
      </div>

      <div className="wrap">
        <div className="panel">
          <label htmlFor="claimLabel">Claim reference (optional)</label>
          <input
            id="claimLabel"
            type="text"
            placeholder="e.g. Lawson — 061935816-01"
            value={claimLabel}
            onChange={(e) => setClaimLabel(e.target.value)}
          />
          <div style={{ height: 14 }} />
          <label htmlFor="scopeText">Scope of work</label>
          <textarea
            id="scopeText"
            placeholder={
              "Paste the carrier's line items here, e.g.:\n2  Remove - Roof Vent, Static Box/Turtle, Aluminum   3 EA\n3  Replace - Roof Vent, Static Box/Turtle, Aluminum  3 EA  $81.24"
            }
            value={scopeText}
            onChange={(e) => {
              setScopeText(e.target.value);
              if (pdfFile) setPdfFile(null);
            }}
            disabled={!!pdfFile}
          />
          <div className="pdf-row">
            <span className="or-label">— or —</span>
            {!pdfFile ? (
              <label className="btn-ghost file-btn">
                Upload a PDF
                <input type="file" accept="application/pdf" onChange={handlePdfSelect} style={{ display: "none" }} />
              </label>
            ) : (
              <span className="pdf-chip">
                📄 {pdfFile.name}
                <button className="pdf-remove" onClick={clearPdf} aria-label="Remove PDF">
                  ✕
                </button>
              </span>
            )}
          </div>
          <div className="row">
            <button className="btn-primary" onClick={runAnalysis} disabled={busy}>
              {busy ? "Working…" : "Analyze scope"}
            </button>
            <button className="btn-ghost" onClick={toggleHistory}>
              {showHistory ? "Hide history" : "Past analyses"}
            </button>
            {results && (
              <button className="btn-ghost" onClick={startNew}>
                New
              </button>
            )}
            {busy && <span className="progress">{progress}</span>}
          </div>
        </div>

        {errorMsg && <div className="error-box">{errorMsg}</div>}

        {showHistory && (
          <div className="panel">
            <label>Saved analyses (shared with your team)</label>
            {historyError && <div className="error-box" style={{ marginTop: 0 }}>{historyError}</div>}
            {!historyError && history.length === 0 && (
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Nothing saved yet.</div>
            )}
            <div className="history-list">
              {history.map((rec) => (
                <div className="history-row" key={rec.id}>
                  <span>
                    {rec.claim_label} — {new Date(rec.created_at).toLocaleDateString()}
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <button className="btn-ghost" onClick={() => loadRecord(rec)}>
                      Open
                    </button>
                    <button className="btn-ghost" onClick={() => deleteRecord(rec)}>
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {results && counts && (
          <>
            <div className="summary-bar">
              <div className="summary-cell cell-cascade">
                <span className="num">{counts.cascade}</span>
                <span className="lbl">Cascade</span>
              </div>
              <div className="summary-cell cell-rebuttal">
                <span className="num">{counts.rebuttal}</span>
                <span className="lbl">Rebuttal</span>
              </div>
              <div className="summary-cell cell-note">
                <span className="num">{counts.note}</span>
                <span className="lbl">Note</span>
              </div>
            </div>

            <div className="row" style={{ marginTop: -4, marginBottom: 6 }}>
              <button className="btn-ghost" onClick={copyReport}>
                Copy report as text
              </button>
              <button className="btn-ghost" onClick={saveCurrent}>
                Save this analysis
              </button>
            </div>
            <div className="row" style={{ marginTop: 0, marginBottom: 14 }}>
              <button className="btn-ghost" onClick={() => generateCover("adjuster")} disabled={coverStatus === "working"}>
                {coverStatus === "working" ? "Writing…" : "Generate adjuster cover paragraph"}
              </button>
              <button className="btn-ghost" onClick={() => generateCover("homeowner")} disabled={homeownerStatus === "working"}>
                {homeownerStatus === "working" ? "Writing…" : "Generate homeowner summary"}
              </button>
            </div>

            {coverParagraph && (
              <div className="panel cover-panel">
                <label>For the adjuster — rebuttal letter opening paragraph</label>
                <div className="cover-text">{coverParagraph}</div>
              </div>
            )}

            {homeownerSummary && (
              <div className="panel homeowner-panel">
                <label>For the homeowner — plain-language summary</label>
                <div className="cover-text">{homeownerSummary}</div>
              </div>
            )}

            <div className="sort-row">
              <span className="sort-label">Sort:</span>
              <button
                className={"chip" + (sortMode === "leverage" ? " chip-active" : "")}
                onClick={() => setSortMode("leverage")}
              >
                By leverage
              </button>
              <button
                className={"chip" + (sortMode === "order" ? " chip-active" : "")}
                onClick={() => setSortMode("order")}
              >
                Estimate order
              </button>
            </div>

            {displayResults.map((r, i) => (
              <ResultItem key={i} item={r} />
            ))}

            <div className="panel supplement-panel">
              <label>Found something new? Request a supplement</label>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 10, lineHeight: 1.5 }}>
                Describe damage or findings the original estimate doesn't cover — e.g. "skylight has
                cracked glazing from hail, not just flashing damage" or "found rotted decking under
                the tear-off." Freeform is fine; mention specific locations if you can.
              </div>
              <textarea
                placeholder="e.g. The skylight above the kitchen has visible hail-fractured glazing on the outer pane, confirmed during the site visit — this needs full unit replacement, not the flashing-kit repair the carrier scoped."
                value={supplementNotes}
                onChange={(e) => setSupplementNotes(e.target.value)}
                style={{ minHeight: 100 }}
              />
              <div className="row">
                <button className="btn-primary" onClick={generateSupplementItems} disabled={supplementStatus === "working"}>
                  {supplementStatus === "working" ? "Working…" : "Generate supplement items"}
                </button>
              </div>

              {supplementItems && supplementItems.length > 0 && (
                <>
                  <div style={{ height: 16 }} />
                  {supplementItems.map((it, i) => (
                    <SupplementItem key={i} item={it} />
                  ))}
                  <div className="row" style={{ marginTop: 6 }}>
                    <button className="btn-ghost" onClick={generateSupplementLetter} disabled={letterStatus === "working"}>
                      {letterStatus === "working" ? "Writing…" : "Generate supplement letter"}
                    </button>
                  </div>
                  {supplementLetter && (
                    <div className="panel cover-panel" style={{ marginTop: 14 }}>
                      <label>Supplement request letter — draft, review before sending</label>
                      <div className="cover-text" style={{ whiteSpace: "pre-wrap" }}>{supplementLetter}</div>
                      <div className="row" style={{ marginTop: 10 }}>
                        <button className="btn-ghost" onClick={copySupplementLetter}>
                          Copy letter
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {!results && status === "idle" && (
          <div className="empty">
            Paste a scope of work above (or upload a PDF) and hit Analyze. Each line item comes back
            tagged as a cascade item (approved work that disturbs surrounding systems), a rebuttal
            target (denied, missing, or undervalued), or a routine note — plus a leverage score.
          </div>
        )}
      </div>

      <div className="foot-note">
        Every finding here is a starting argument for review, not a final word — confirm anything
        marked "needs more info" against photos, measurements, or product specs before it goes in
        writing. This tool does not address insurance policy language or coverage; that stays with
        the homeowner. Saved analyses are shared with everyone on your team who has this link.
      </div>
    </div>
  );
}
