import { useState } from "react";

const TEAL = "#1a9e99"; const GOLD = "#e8a820"; const DARK = "#080d14";
const PANEL = "#0f1923"; const PANEL2 = "#162030"; const BORDER = "#1e3048";
const TEXT = "#e2eaf4"; const MUTED = "#6b8099"; const GREEN = "#10b981";

const DEFAULT_PRICING = {
  // Base price per square (100 sq ft) for each tier
  baseGood: 650,
  baseBetter: 750,
  baseBest: 850,
  // Pitch surcharge bands — % added to base, keyed by max pitch in the band (12 = 12/12)
  // Based on MN roofing labor data: 3/12–8/12 is baseline walkable pitch; steeper
  // pitches require roof jacks, then harnesses, then scaffolding as slope increases.
  pitchBands: [
    { maxPitch: 2,  label: "0/12 – 2/12 (Low slope — different underlayment)", pct: 20 },
    { maxPitch: 8,  label: "3/12 – 8/12 (Standard, walkable)",                 pct: 0  },
    { maxPitch: 10, label: "9/12 – 10/12 (Roof jacks required)",               pct: 15 },
    { maxPitch: 12, label: "11/12 – 12/12 (Harness required)",                 pct: 25 },
    { maxPitch: 99, label: "13/12+ (Scaffolding required)",                    pct: 45 },
  ],
  // Story surcharge — % added to base for staging, ladder time, and harness setup
  storyBands: [
    { stories: 1, label: "1 Story",  pct: 0  },
    { stories: 2, label: "2 Story",  pct: 12 },
    { stories: 3, label: "3+ Story", pct: 25 },
  ],
  wasteFactorPct: 10, // % added to measured area for cuts/waste
};

function Field({ label, value, onChange, prefix, suffix }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{label}</label>
      <div style={{ position: "relative" }}>
        {prefix && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 14 }}>{prefix}</span>}
        <input
          type="number" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, padding: `10px ${suffix ? 26 : 10}px 10px ${prefix ? 22 : 10}px`, fontSize: 15, fontFamily: "monospace", boxSizing: "border-box" }}
        />
        {suffix && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 13 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function fmt(n) {
  return "$" + Math.round(n).toLocaleString();
}

export function catalogItemLabel(item) {
  const parts = [item.manufacturer, item.style, item.color].filter(Boolean);
  return (parts.join(" — ") || "(unnamed product)") + ` — $${(parseFloat(item.ratePerSq) || 0).toLocaleString()}/sq`;
}

// ─── Materials Catalog (admin configures once, feeds Good/Better/Best) ──────
export function MaterialsCatalogSettings({ catalog, onSave, onClose }) {
  const [local, setLocal] = useState(catalog && catalog.length ? catalog : []);
  const [savedFlash, setSavedFlash] = useState(false);

  const save = () => { onSave(local); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800); };
  const addItem = () => setLocal(items => [...items, { id: Date.now() + Math.random(), manufacturer: "", style: "", color: "", ratePerSq: "" }]);
  const removeItem = (id) => setLocal(items => items.filter(i => i.id !== id));
  const updateItem = (id, key, val) => setLocal(items => items.map(i => i.id === id ? { ...i, [key]: val } : i));

  return (
    <div style={{ position: "fixed", inset: 0, background: DARK, zIndex: 300, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ position: "sticky", top: 0, background: PANEL2, borderBottom: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: 1 }}>
          <span style={{ color: TEAL }}>FREEDOM </span><span style={{ color: GOLD }}>EXTERIORS</span>
          <span style={{ color: MUTED, fontWeight: 500, fontSize: 13, marginLeft: 10 }}>Materials Catalog</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {savedFlash && <span style={{ color: TEAL, fontSize: 12, fontWeight: 700 }}>✓ Saved</span>}
          <button onClick={save} style={{ background: `${TEAL}22`, border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 7, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>💾 Save</button>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 7, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: 18 }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 16, lineHeight: 1.6 }}>
          Real products with real $/sq rates. On any job's Good/Better/Best pricing, you can pick a specific product here for each tier instead of the flat default rate — the surcharge math (pitch, story, waste) still applies exactly like it does today.
        </div>

        {local.map(item => (
          <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 9, padding: 10 }}>
            <input type="text" placeholder="Manufacturer (e.g. GAF)" value={item.manufacturer}
              onChange={e => updateItem(item.id, "manufacturer", e.target.value)}
              style={{ flex: 1.2, background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, padding: "9px 10px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}/>
            <input type="text" placeholder="Style (e.g. Architectural)" value={item.style}
              onChange={e => updateItem(item.id, "style", e.target.value)}
              style={{ flex: 1.2, background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, padding: "9px 10px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}/>
            <input type="text" placeholder="Color" value={item.color}
              onChange={e => updateItem(item.id, "color", e.target.value)}
              style={{ flex: 1, background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, padding: "9px 10px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}/>
            <div style={{ position: "relative", flex: 0.8 }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 13 }}>$</span>
              <input type="number" min="0" step="0.01" placeholder="0" value={item.ratePerSq}
                onChange={e => updateItem(item.id, "ratePerSq", e.target.value)}
                style={{ width: "100%", background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, padding: "9px 8px 9px 18px", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }}/>
            </div>
            <span style={{ color: MUTED, fontSize: 11 }}>/sq</span>
            <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>
          </div>
        ))}

        {local.length === 0 && <div style={{ textAlign: "center", color: MUTED, padding: "20px 0" }}>No products yet — add your first one below.</div>}

        <button onClick={addItem} style={{ width: "100%", background: "none", border: `1px dashed ${BORDER}`, color: MUTED, borderRadius: 9, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>+ Add Product</button>
      </div>
    </div>
  );
}

// ─── Pricing Settings Screen (admin configures once) ────────────────────────
export function PricingSettings({ pricing, onSave, onClose }) {
  const [local, setLocal] = useState(pricing || DEFAULT_PRICING);
  const [savedFlash, setSavedFlash] = useState(false);

  const save = () => { onSave(local); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800); };
  const setPitchBand = (i, key) => (v) => setLocal(d => { const bands = [...d.pitchBands]; bands[i] = { ...bands[i], [key]: v }; return { ...d, pitchBands: bands }; });
  const setStoryBand = (i, key) => (v) => setLocal(d => { const bands = [...d.storyBands]; bands[i] = { ...bands[i], [key]: v }; return { ...d, storyBands: bands }; });

  return (
    <div style={{ position: "fixed", inset: 0, background: DARK, zIndex: 300, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ position: "sticky", top: 0, background: PANEL2, borderBottom: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: 1 }}>
          <span style={{ color: TEAL }}>FREEDOM </span><span style={{ color: GOLD }}>EXTERIORS</span>
          <span style={{ color: MUTED, fontWeight: 500, fontSize: 13, marginLeft: 10 }}>Pricing Settings</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {savedFlash && <span style={{ color: TEAL, fontSize: 12, fontWeight: 700 }}>✓ Saved</span>}
          <button onClick={save} style={{ background: `${TEAL}22`, border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 7, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>💾 Save</button>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 7, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: 18 }}>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: GOLD, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Base Price Per Square</div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 14 }}>One square = 100 sq ft. This is your standard-pitch, single-story rate for each tier.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Good" value={local.baseGood} onChange={v => setLocal(d => ({ ...d, baseGood: v }))} prefix="$" />
            <Field label="Better" value={local.baseBetter} onChange={v => setLocal(d => ({ ...d, baseBetter: v }))} prefix="$" />
            <Field label="Best" value={local.baseBest} onChange={v => setLocal(d => ({ ...d, baseBest: v }))} prefix="$" />
          </div>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: GOLD, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Pitch Surcharge</div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 14 }}>Percent added to the base price as pitch increases (steeper = more labor, more safety gear, slower work).</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {local.pitchBands.map((b, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 13, color: TEXT }}>{b.label}</div>
                <Field value={b.pct} onChange={setPitchBand(i, "pct")} suffix="%" />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: GOLD, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Story Surcharge</div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 14 }}>Percent added to the base price for taller homes (more staging, ladder work, access time).</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {local.storyBands.map((b, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 13, color: TEXT }}>{b.label}</div>
                <Field value={b.pct} onChange={setStoryBand(i, "pct")} suffix="%" />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: GOLD, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Waste Factor</div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 14 }}>Extra material added on top of measured roof area to cover cuts, hips, valleys, and overlap.</div>
          <div style={{ maxWidth: 150 }}>
            <Field value={local.wasteFactorPct} onChange={v => setLocal(d => ({ ...d, wasteFactorPct: v }))} suffix="%" />
          </div>
        </div>

        <div style={{ textAlign: "center", paddingBottom: 30 }}>
          <button onClick={save} style={{ background: `${TEAL}22`, border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 8, padding: "14px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>💾 Save Pricing Settings</button>
        </div>
      </div>
    </div>
  );
}

// ─── Pricing calc ────────────────────────────────────────────────────────────
function pitchSurchargePct(pitch, bands) {
  const p = parseFloat(pitch) || 0;
  const band = bands.find(b => p <= b.maxPitch) || bands[bands.length - 1];
  return band ? parseFloat(band.pct) || 0 : 0;
}
function storySurchargePct(stories, bands) {
  const s = parseInt(stories) || 1;
  const exact = bands.find(b => b.stories === s);
  if (exact) return parseFloat(exact.pct) || 0;
  const capped = bands[bands.length - 1];
  return capped ? parseFloat(capped.pct) || 0 : 0;
}

export function calcGoodBetterBest({ sqFt, pitch, stories, pricing, baseOverrides }) {
  const p = pricing || DEFAULT_PRICING;
  const area = parseFloat(sqFt) || 0;
  const withWaste = area * (1 + (parseFloat(p.wasteFactorPct) || 0) / 100);
  const squares = withWaste / 100;
  const pitchPct = pitchSurchargePct(pitch, p.pitchBands);
  const storyPct = storySurchargePct(stories, p.storyBands);
  const totalMultiplier = 1 + (pitchPct + storyPct) / 100;

  const tier = (base) => {
    const perSquare = (parseFloat(base) || 0) * totalMultiplier;
    return { perSquare, total: perSquare * squares };
  };

  const o = baseOverrides || {};
  return {
    squares, pitchPct, storyPct, totalMultiplier,
    good: tier(o.good != null ? o.good : p.baseGood),
    better: tier(o.better != null ? o.better : p.baseBetter),
    best: tier(o.best != null ? o.best : p.baseBest),
  };
}

// ─── Good/Better/Best Calculator (used on a job) ────────────────────────────
export default function GoodBetterBest({ job, pricing, catalog, onSave, onClose, onOpenSettings, isAdmin }) {
  const [sqFt, setSqFt] = useState(job.gbb?.sqFt || job.hoverMeasurements?.totalArea || "");
  const [pitch, setPitch] = useState(job.gbb?.pitch || "");
  const [stories, setStories] = useState(job.gbb?.stories || 1);
  const [savedFlash, setSavedFlash] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchInfo, setFetchInfo] = useState(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [productIds, setProductIds] = useState(job.gbb?.productIds || { good: "", better: "", best: "" });

  const findProduct = (id) => (catalog || []).find(p => String(p.id) === String(id));
  const baseOverrides = {
    good: productIds.good ? parseFloat(findProduct(productIds.good)?.ratePerSq) : null,
    better: productIds.better ? parseFloat(findProduct(productIds.better)?.ratePerSq) : null,
    best: productIds.best ? parseFloat(findProduct(productIds.best)?.ratePerSq) : null,
  };
  const result = calcGoodBetterBest({ sqFt, pitch, stories, pricing, baseOverrides });

  const save = () => {
    onSave({ gbb: { sqFt, pitch, stories, productIds, result, calculatedAt: new Date().toISOString() } });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const autoFillFromGoogle = async () => {
    if (!job.address || !job.city || !job.state) { setFetchError("This job needs an address, city, and state first."); return; }
    setFetching(true);
    setFetchError(null);
    setFetchInfo(null);
    setLowConfidence(false);
    try {
      const res = await fetch(`/api/solar?address=${encodeURIComponent(job.address)}&city=${encodeURIComponent(job.city)}&state=${encodeURIComponent(job.state)}`);
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
          <span style={{ color: MUTED, fontWeight: 500, fontSize: 13, marginLeft: 10 }}>Good / Better / Best</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {savedFlash && <span style={{ color: TEAL, fontSize: 12, fontWeight: 700 }}>✓ Saved</span>}
          {isAdmin && <button onClick={onOpenSettings} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 7, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>⚙️ Pricing Settings</button>}
          <button onClick={save} style={{ background: `${TEAL}22`, border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 7, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>💾 Save</button>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 7, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: 18 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: 1, color: TEXT }}>ROOF PRICING</div>
          <div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{job.name} · {job.address}, {job.city}, {job.state}</div>
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
          {job.hoverId && !sqFt && (
            <div style={{ fontSize: 11, color: GOLD, marginTop: 10 }}>💡 This job has a Hover ID linked — pull measurements from the Details tab first, or enter area manually.</div>
          )}
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
                { key: "good", baseKey: "baseGood", label: "GOOD", color: "#38bdf8", data: result.good },
                { key: "better", baseKey: "baseBetter", label: "BETTER", color: GOLD, data: result.better },
                { key: "best", baseKey: "baseBest", label: "BEST", color: GREEN, data: result.best },
              ].map(t => {
                const selectedProduct = findProduct(productIds[t.key]);
                return (
                  <div key={t.key} style={{ background: PANEL, border: `2px solid ${t.color}66`, borderRadius: 10, padding: 16, textAlign: "center" }}>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: t.color, letterSpacing: 1, marginBottom: 10 }}>{t.label}</div>
                    {catalog && catalog.length > 0 && (
                      <select value={productIds[t.key]} onChange={e => setProductIds(p => ({ ...p, [t.key]: e.target.value }))}
                        style={{ width: "100%", background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, padding: "6px 4px", fontSize: 10.5, fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" }}>
                        <option value="">Default rate (${(pricing || DEFAULT_PRICING)[t.baseKey]}/sq)</option>
                        {catalog.map(item => <option key={item.id} value={item.id}>{catalogItemLabel(item)}</option>)}
                      </select>
                    )}
                    <div style={{ fontSize: 26, fontWeight: 800, color: TEXT, fontFamily: "monospace" }}>{fmt(t.data.total)}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>{fmt(t.data.perSquare)}/sq</div>
                    {selectedProduct && <div style={{ fontSize: 10, color: t.color, marginTop: 6 }}>{[selectedProduct.manufacturer, selectedProduct.style, selectedProduct.color].filter(Boolean).join(" · ")}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!(sqFt > 0) && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 40, textAlign: "center", color: MUTED }}>
            Enter roof area above to see Good / Better / Best pricing.
          </div>
        )}

        <div style={{ textAlign: "center", paddingBottom: 30 }}>
          <button onClick={save} style={{ background: `${TEAL}22`, border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 8, padding: "14px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>💾 Save Pricing to Job</button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_PRICING };