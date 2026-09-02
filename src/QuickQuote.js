import { useState } from "react";
import { calcGoodBetterBest } from "./GoodBetterBest";

const TEAL = "#1a9e99"; const GOLD = "#e8a820"; const DARK = "#080d14";
const PANEL = "#0f1923"; const PANEL2 = "#162030"; const BORDER = "#1e3048";
const TEXT = "#e2eaf4"; const MUTED = "#6b8099"; const GREEN = "#10b981";

function Field({ label, value, onChange, prefix, suffix, type }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{label}</label>
      <div style={{ position: "relative" }}>
        {prefix && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 14 }}>{prefix}</span>}
        <input
          type={type || "number"} value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, padding: `10px ${suffix ? 26 : 10}px 10px ${prefix ? 22 : 10}px`, fontSize: 15, fontFamily: type ? "inherit" : "monospace", boxSizing: "border-box" }}
        />
        {suffix && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 13 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function fmt(n) {
  return "$" + Math.round(n).toLocaleString();
}

// ─── Quick Quote — no job attached, just an address in / pricing out ────────
export default function QuickQuote({ pricing, onClose }) {
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("MN");
  const [sqFt, setSqFt] = useState("");
  const [pitch, setPitch] = useState("");
  const [stories, setStories] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchInfo, setFetchInfo] = useState(null);
  const [lowConfidence, setLowConfidence] = useState(false);

  const result = calcGoodBetterBest({ sqFt, pitch, stories, pricing });

  const autoFillFromGoogle = async () => {
    if (!address || !city || !state) { setFetchError("Enter an address, city, and state first."); return; }
    setFetching(true);
    setFetchError(null);
    setFetchInfo(null);
    setLowConfidence(false);
    try {
      const res = await fetch(`/api/solar?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
      const data = await res.json();
      if (!res.ok || !data.success) { setFetchError(data.error || "Couldn't fetch roof data for this address."); setFetching(false); return; }
      setSqFt(data.totalAreaSqFt);
      setPitch(data.pitchRisePerTwelve);
      setLowConfidence(data.lowConfidence);
      const base = `Pulled ${data.totalAreaSqFt.toLocaleString()} sq ft across ${data.segmentCount} roof segment${data.segmentCount===1?"":"s"} · avg pitch ${data.pitchRisePerTwelve}/12${data.imageryDate ? ` · imagery from ${data.imageryDate.year}` : ""}.`;
      if (data.corrected) {
        setFetchInfo(`⚠️ Google's raw detection (${data.rawSegmentAreaSqFt.toLocaleString()} sq ft) was smaller than what's geometrically possible for a roof at this pitch on this footprint — bumped to ${data.totalAreaSqFt.toLocaleString()} sq ft as a mathematical floor. Real complexity is likely still higher. Verify with Hover.`);
      } else if (data.lowConfidence) {
        setFetchInfo(`${base} ⚠️ ${data.imageryQuality === "LOW" || data.imageryQuality === "BASE" ? `Imagery quality is ${data.imageryQuality}` : `Only ${data.segmentCount} facet${data.segmentCount===1?"":"s"} detected`} — treat this as low-confidence and verify with Hover before quoting.`);
      } else {
        setFetchInfo(`${base} Verify against the actual roof — this is a satellite estimate, not a measured takeoff.`);
      }
    } catch (e) {
      setFetchError("Network error reaching the roof data service.");
    }
    setFetching(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: DARK, zIndex: 300, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ position: "sticky", top: 0, background: PANEL2, borderBottom: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: 1 }}>
          <span style={{ color: TEAL }}>FREEDOM </span><span style={{ color: GOLD }}>EXTERIORS</span>
          <span style={{ color: MUTED, fontWeight: 500, fontSize: 13, marginLeft: 10 }}>Quick Quote</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 7, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: 18 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: 1, color: TEXT }}>QUICK QUOTE</div>
          <div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>No job created — just a driveway estimate</div>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: GOLD, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Address</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr", gap: 12 }}>
            <Field label="Street Address" value={address} onChange={setAddress} type="text" />
            <Field label="City" value={city} onChange={setCity} type="text" />
            <Field label="State" value={state} onChange={setState} type="text" />
          </div>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: GOLD, textTransform: "uppercase", letterSpacing: 1 }}>Roof Details</div>
            <button onClick={autoFillFromGoogle} disabled={fetching} style={{ background: fetching ? "#2a3a4a" : "#4285f422", border: `1px solid ${fetching ? BORDER : "#4285f4"}`, color: fetching ? MUTED : "#4285f4", borderRadius: 7, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: fetching ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              {fetching ? "⟳ Fetching…" : "🛰️ Auto-Fill from Google"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 14 }}>Instant satellite estimate — good for a driveway quote. For a formal contract, verify with Hover.</div>
          {fetchError && <div style={{ background: "#7c2d1222", border: "1px solid #f8717166", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#fca5a5", marginBottom: 12 }}>⚠️ {fetchError}</div>}
          {fetchInfo && (
            <div style={{
              background: lowConfidence ? "#e8a82018" : "#4285f411",
              border: `1px solid ${lowConfidence ? "#e8a82077" : "#4285f444"}`,
              borderRadius: 7, padding: "8px 12px", fontSize: 11.5,
              color: lowConfidence ? "#fbbf24" : "#93c5fd",
              marginBottom: 12, lineHeight: 1.5, fontWeight: lowConfidence ? 600 : 400
            }}>
              🛰️ {fetchInfo}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Roof Area" value={sqFt} onChange={setSqFt} suffix="sq ft" />
            <Field label="Pitch (rise/12)" value={pitch} onChange={setPitch} suffix="/12" />
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Stories</label>
              <select value={stories} onChange={e => setStories(e.target.value)}
                style={{ width: "100%", background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, padding: "10px", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }}>
                <option value="1">1 Story</option>
                <option value="2">2 Story</option>
                <option value="3">3+ Story</option>
              </select>
            </div>
          </div>
        </div>

        {sqFt > 0 && (
          <>
            <div style={{ background: PANEL2, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: MUTED, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span><strong style={{ color: TEXT }}>{result.squares.toFixed(2)}</strong> squares (incl. waste)</span>
              <span>Pitch surcharge: <strong style={{ color: result.pitchPct > 0 ? GOLD : TEXT }}>+{result.pitchPct}%</strong></span>
              <span>Story surcharge: <strong style={{ color: result.storyPct > 0 ? GOLD : TEXT }}>+{result.storyPct}%</strong></span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { key: "good", label: "GOOD", color: "#38bdf8", data: result.good },
                { key: "better", label: "BETTER", color: GOLD, data: result.better },
                { key: "best", label: "BEST", color: GREEN, data: result.best },
              ].map(t => (
                <div key={t.key} style={{ background: PANEL, border: `2px solid ${t.color}66`, borderRadius: 10, padding: 16, textAlign: "center" }}>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: t.color, letterSpacing: 1, marginBottom: 10 }}>{t.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: TEXT, fontFamily: "monospace" }}>{fmt(t.data.total)}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>{fmt(t.data.perSquare)}/sq</div>
                </div>
              ))}
            </div>
          </>
        )}

        {!(sqFt > 0) && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 40, textAlign: "center", color: MUTED }}>
            Enter roof area above to see Good / Better / Best pricing.
          </div>
        )}

        <div style={{ textAlign: "center", paddingBottom: 30, fontSize: 11, color: MUTED }}>
          This quote isn't saved anywhere — jot the numbers down or start a job if it moves forward.
        </div>
      </div>
    </div>
  );
}