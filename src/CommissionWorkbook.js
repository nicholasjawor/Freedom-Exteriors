import { useState } from "react";
import { exportCommissionWorkbook } from "./pdfExport";

const TEAL = "#1a9e99"; const GOLD = "#e8a820"; const DARK = "#080d14";
const PANEL = "#0f1923"; const PANEL2 = "#162030"; const BORDER = "#1e3048";
const TEXT = "#e2eaf4"; const MUTED = "#6b8099"; const GREEN = "#10b981";

const OP_ALLOC_PCT = 0.15;

const TIERS = [
  { value: 30, label: "30%", desc: "Paid Lead / Entry Rep" },
  { value: 35, label: "35%", desc: "Call Company Lead (PAR)", callCompany: true },
  { value: 40, label: "40%", desc: "Start-to-Finish, Own Lead" },
  { value: 50, label: "50%", desc: "Team Leader / $1M Sold" },
];

const COST_LINES = [
  { key: "xactimate",      label: "A. Xactimate" },
  { key: "permits",        label: "B. Permits" },
  { key: "roofMaterials",  label: "C. Roofing Materials" },
  { key: "roofLabor",      label: "D. Roofing Labor" },
  { key: "sidingMaterials",label: "E. Siding / Wrap Materials" },
  { key: "sidingLabor",    label: "F. Siding / Wrap Labor" },
  { key: "gutterMat",      label: "G. Gutter Materials" },
  { key: "gutterLabor",    label: "H. Gutter Labor" },
  { key: "windows",        label: "I. Windows" },
  { key: "electrical",     label: "J. Electrical" },
  { key: "dumpster",       label: "K. Dumpster Fees" },
  { key: "hoverCost",      label: "L. Hover Cost" },
  { key: "chargeback",     label: "M. Chargeback" },
  { key: "insNegFee",      label: "N. Insurance Negotiation Fee" },
  { key: "supplementFee",  label: "O. Supplement Negotiation Fee" },
  { key: "materialReturn", label: "P. Material Return Credit (−)" },
  { key: "other",          label: "Q. Other" },
];

function calc(c) {
  const gross = parseFloat(c?.grossRevenue) || 0;
  const opAlloc = gross * OP_ALLOC_PCT;
  const netRev = gross - opAlloc;
  const costs = COST_LINES.reduce((sum, { key }) => {
    const v = parseFloat(c?.[key]) || 0;
    return key === "materialReturn" ? sum - v : sum + v;
  }, 0);
  const commNet = netRev - costs;
  const tier = parseFloat(c?.tier) || 30;
  const isCallCompany = tier === 35;
  const commission = commNet * (tier / 100);
  const callCompanyFee = isCallCompany ? commission : 0;
  const repCommission = isCallCompany ? 0 : commission;
  return { gross, opAlloc, netRev, costs, commNet, tier, commission, callCompanyFee, repCommission, isCallCompany };
}

function fmt(n) {
  if (isNaN(n) || n === 0) return "$0.00";
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Row({ label, value, isCredit, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${BORDER}33` }}>
      <span style={{ fontSize: 13, color: bold ? TEXT : MUTED, fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: isCredit ? "#f87171" : bold ? GOLD : TEXT, fontFamily: "monospace", minWidth: 90, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function CostInput({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${BORDER}33` }}>
      <label style={{ flex: 1, fontSize: 13, color: MUTED }}>{label}</label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 14 }}>$</span>
        <input
          type="number" min="0" step="0.01"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder="0.00"
          style={{ width: 110, background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, padding: "9px 10px 9px 22px", fontSize: 14, fontFamily: "monospace", boxSizing: "border-box" }}
        />
      </div>
    </div>
  );
}

export default function CommissionWorkbook({ job, isAdmin, onSave, onClose }) {
  const c = job.commission || {};
  // Auto-set tier to 35 (PAR) if job is a PAR lead and no tier has been set yet
  const defaultTier = job.parLead && !c.tier ? 35 : (c.tier || 30);
  const [local, setLocal] = useState({ ...c, tier: defaultTier });
  const [savedFlash, setSavedFlash] = useState(false);

  const set = (key) => (val) => setLocal(prev => ({ ...prev, [key]: val }));

  const save = () => {
    onSave({ commission: local });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const r = calc(local);

  return (
    <div style={{ position: "fixed", inset: 0, background: DARK, zIndex: 300, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      {/* Header */}
      <div style={{ background: PANEL2, borderBottom: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: 1 }}>
            <span style={{ color: TEAL }}>FREEDOM </span><span style={{ color: GOLD }}>EXTERIORS</span>
          </div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Commission Workbook — {job.name} · {job.address}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {savedFlash && <span style={{ color: TEAL, fontSize: 12, fontWeight: 700 }}>✓ Saved</span>}
          <button onClick={() => exportCommissionWorkbook(local, job)} style={{ background:"#fff2", border:"1px solid #fff4", color:TEXT, borderRadius:7, padding:"9px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>📥 PDF</button>
          <button onClick={save} style={{ background: `${TEAL}22`, border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 7, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>💾 Save</button>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 7, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Step 1: Revenue */}
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: GOLD, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>Step 1 — Job Revenue</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <label style={{ flex: 1, fontSize: 13, color: MUTED }}>A. Gross Job Revenue</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 14 }}>$</span>
              <input
                type="number" min="0" step="0.01"
                value={local.grossRevenue || ""}
                onChange={e => set("grossRevenue")(e.target.value)}
                placeholder="0.00"
                style={{ width: 140, background: PANEL2, border: `1px solid ${TEAL}`, borderRadius: 7, color: TEXT, padding: "11px 10px 11px 22px", fontSize: 16, fontFamily: "monospace", boxSizing: "border-box", fontWeight: 700 }}
              />
            </div>
          </div>
          <Row label={`B. Operating Allocation (${(OP_ALLOC_PCT * 100).toFixed(0)}% of Gross)`} value={fmt(r.opAlloc)} isCredit />
          <Row label="C. Net Revenue (A − B)" value={fmt(r.netRev)} bold />
        </div>

        {/* Step 2: Costs */}
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: GOLD, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>Step 2 — Cost of Revenue</div>
          {COST_LINES.map(({ key, label }) => (
            <CostInput key={key} label={label} value={local[key]} onChange={set(key)} />
          ))}
          <div style={{ marginTop: 12 }}>
            <Row label="R. Total Cost of Revenue" value={fmt(r.costs)} bold />
          </div>
        </div>

        {/* Step 3: Commission */}
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, color: GOLD, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>Step 3 — Commission Calculation</div>
          <Row label="S. Commissionable Net (C − R)" value={fmt(r.commNet)} bold />

          {/* Tier selector — admin only */}
          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              T. Commission Tier {!isAdmin && <span style={{ color: "#f87171", marginLeft: 6 }}>🔒 Set by admin</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {TIERS.map(({ value, label, desc }) => {
                const active = (parseFloat(local.tier) || 30) === value;
                return (
                  <button
                    key={value}
                    onClick={() => isAdmin && set("tier")(value)}
                    style={{
                      flex: 1, padding: "10px 6px", borderRadius: 8, fontFamily: "inherit", cursor: isAdmin ? "pointer" : "default",
                      background: active ? `${GOLD}22` : PANEL2,
                      border: `1px solid ${active ? GOLD : BORDER}`,
                      color: active ? GOLD : MUTED,
                      opacity: !isAdmin && !active ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{label}</div>
                    <div style={{ fontSize: 10, marginTop: 3, lineHeight: 1.3 }}>{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Final commission */}
          <div style={{ background: `${GOLD}11`, border: `1px solid ${GOLD}44`, borderRadius: 10, padding: 18, textAlign: "center", marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>U. Gross Commission (S × T)</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: r.commission >= 0 ? GOLD : "#f87171", fontFamily: "monospace" }}>{fmt(r.commission)}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{r.tier}% of {fmt(r.commNet)} commissionable net</div>
            {r.isCallCompany && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${GOLD}44`, paddingTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "#f87171" }}>− PAR Fee (35% owed to ProAct Resources)</span>
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: "#f87171", fontWeight: 700 }}>− {fmt(r.callCompanyFee)}</span>
                </div>
                <div style={{ background: "#22d3ee11", border: "1px solid #22d3ee44", borderRadius: 7, padding: "10px 14px", textAlign: "left" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#22d3ee", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>⚠️ PAR Fee Due to ProAct Resources</div>
                  <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>Per the ProAct Resources agreement (signed 09/01/2026), {fmt(r.callCompanyFee)} is owed to PAR within <strong style={{ color: TEXT }}>15 days of deposit</strong> or receipt of payment.</div>
                </div>
              </div>
            )}
          </div>

          {/* Transparent breakdown */}
          <div style={{ marginTop: 16, padding: "12px 14px", background: PANEL2, borderRadius: 8, fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700, color: TEXT, marginBottom: 6 }}>Full Breakdown</div>
            <div>Gross Revenue: <span style={{ color: TEXT, fontFamily: "monospace" }}>{fmt(r.gross)}</span></div>
            <div>− Operating Allocation (15%): <span style={{ color: "#f87171", fontFamily: "monospace" }}>{fmt(r.opAlloc)}</span></div>
            <div>= Net Revenue: <span style={{ color: TEXT, fontFamily: "monospace" }}>{fmt(r.netRev)}</span></div>
            <div>− Total Costs: <span style={{ color: "#f87171", fontFamily: "monospace" }}>{fmt(r.costs)}</span></div>
            <div>= Commissionable Net: <span style={{ color: GREEN, fontFamily: "monospace" }}>{fmt(r.commNet)}</span></div>
            <div>× Commission Tier ({r.tier}%): <span style={{ color: GOLD, fontFamily: "monospace", fontWeight: 700 }}>{fmt(r.commission)}</span></div>
            {r.isCallCompany && <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 4, paddingTop: 4 }}>− PAR Fee (35%): <span style={{ color: "#f87171", fontFamily: "monospace" }}>− {fmt(r.callCompanyFee)}</span></div>}
          </div>
        </div>

        <button onClick={save} style={{ background: `${TEAL}22`, border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 8, padding: "14px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginBottom: 20 }}>💾 Save Workbook</button>
      </div>
    </div>
  );
}