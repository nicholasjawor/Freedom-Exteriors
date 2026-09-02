import { useState, useRef, useCallback } from "react";
import { exportSDCancellationNotice } from "./pdfExport";

const TEAL = "#1a9e99"; const GOLD = "#e8a820"; const DARK = "#080d14";
const PANEL = "#0f1923"; const PANEL2 = "#162030"; const BORDER = "#1e3048";
const TEXT = "#e2eaf4"; const MUTED = "#6b8099";

function SignatureBox({ label, signature, onSign, onClear }) {
  const canvasRef = useRef(null);
  const lastPos = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [typedName, setTypedName] = useState("");

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const startDraw = useCallback((e) => { e.preventDefault(); const canvas = canvasRef.current; if (!canvas) return; setIsDrawing(true); lastPos.current = getPos(e, canvas); }, []);
  const draw = useCallback((e) => {
    e.preventDefault(); if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a2535"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    lastPos.current = pos; setHasDrawn(true);
  }, [isDrawing]);
  const stopDraw = useCallback((e) => { e?.preventDefault(); setIsDrawing(false); lastPos.current = null; }, []);
  const clearCanvas = () => { const canvas = canvasRef.current; if (canvas) canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height); setHasDrawn(false); setTypedName(""); onClear && onClear(); };
  const confirmSign = () => { if (!typedName.trim() || !hasDrawn) return; onSign({ name: typedName.trim(), image: canvasRef.current.toDataURL("image/png"), signedAt: new Date().toISOString() }); };

  if (signature?.image) return (
    <div>
      <label style={{ display:"block", fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{label}</label>
      <div style={{ background:"#fff", borderRadius:8, padding:8 }}><img src={signature.image} alt="sig" style={{ maxWidth:"100%", display:"block" }} /></div>
      <div style={{ fontSize:12, color:MUTED, marginTop:6 }}>Signed by <strong style={{ color:TEXT }}>{signature.name}</strong> · {new Date(signature.signedAt).toLocaleString()}</div>
      <button onClick={clearCanvas} style={{ marginTop:8, background:"none", border:`1px solid ${BORDER}`, color:MUTED, borderRadius:7, padding:"6px 12px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>↻ Re-sign</button>
    </div>
  );

  return (
    <div>
      <label style={{ display:"block", fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{label}</label>
      <canvas ref={canvasRef} width={520} height={150}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
        style={{ width:"100%", maxWidth:520, height:150, background:"#fff", borderRadius:8, touchAction:"none", display:"block" }} />
      <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
        <input value={typedName} onChange={e=>setTypedName(e.target.value)} placeholder="Type full legal name"
          style={{ flex:"1 1 200px", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"10px 12px", fontSize:15, fontFamily:"inherit" }} />
        <button onClick={clearCanvas} style={{ background:"none", border:`1px solid ${BORDER}`, color:MUTED, borderRadius:7, padding:"10px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Clear</button>
        <button onClick={confirmSign} disabled={!typedName.trim()||!hasDrawn}
          style={{ background:(!typedName.trim()||!hasDrawn)?"#2a3a4a":`${TEAL}22`, border:`1px solid ${(!typedName.trim()||!hasDrawn)?BORDER:TEAL}`, color:(!typedName.trim()||!hasDrawn)?MUTED:TEAL, borderRadius:7, padding:"10px 16px", fontSize:12, fontWeight:700, cursor:(!typedName.trim()||!hasDrawn)?"default":"pointer", fontFamily:"inherit" }}>✍️ Sign</button>
      </div>
    </div>
  );
}

const blank = (job) => ({
  type: "sd-cancellation-notice",
  buyerName: job.name || "",
  propertyAddress: job.address ? `${job.address}, ${job.city||""}, ${job.state||""}`.trim().replace(/,\s*$/,"") : "",
  transactionDate: new Date().toISOString().slice(0,10),
  copy1Signature: null,
  copy2Signature: null,
});

export default function SDCancellationNotice({ job, onSave, onClose }) {
  const [data, setData] = useState(job.sdCancellationNotice?.type === "sd-cancellation-notice" ? job.sdCancellationNotice : blank(job));
  const [savedFlash, setSavedFlash] = useState(false);
  const set = (k) => (v) => setData(d => ({ ...d, [k]: v }));
  const save = () => { onSave(data); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800); };
  const allSigned = data.copy1Signature && data.copy2Signature;

  const CopySection = ({ label, sigKey }) => (
    <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:10, padding:18, marginBottom:16 }}>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:14, color:GOLD, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
      <div style={{ fontSize:11, color:MUTED, marginBottom:14 }}>Give this signed copy to the buyer — statute requires the notice be furnished in duplicate</div>
      <div style={{ background:PANEL2, borderRadius:8, padding:14, marginBottom:16 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:13, color:TEXT, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>NOTICE OF CANCELLATION</div>
        <div style={{ fontSize:12.5, color:MUTED, marginBottom:8 }}>Date of Transaction: <strong style={{ color:TEXT }}>{data.transactionDate}</strong></div>
        <div style={{ fontSize:12.5, color:TEXT, fontWeight:700, lineHeight:1.7, marginBottom:10 }}>
          YOU MAY CANCEL THIS TRANSACTION, WITHOUT ANY PENALTY OR OBLIGATION, WITHIN THREE BUSINESS DAYS FROM THE ABOVE DATE.
        </div>
        <div style={{ fontSize:12, color:MUTED, lineHeight:1.7, marginBottom:8 }}>
          If you cancel, any property traded in, any payments made by you under the contract or sale, and any negotiable instrument executed by you will be returned within ten business days following receipt by the seller of your cancellation notice, and any security interest arising out of the transaction will be canceled.
        </div>
        <div style={{ fontSize:12, color:MUTED, lineHeight:1.7, marginBottom:8 }}>
          If you cancel, you must make available to the seller, at your residence, in substantially as good condition as when received, any goods delivered to you under this contract or sale — or you may, if you wish, comply with the instructions of the seller regarding the return shipment of the goods at the seller's expense and risk.
        </div>
        <div style={{ fontSize:12, color:MUTED, lineHeight:1.7, marginBottom:14 }}>
          If you do make the goods available to the seller and the seller does not pick them up within twenty days of the date of your notice of cancellation, you may retain or dispose of the goods without any further obligation. If you fail to make the goods available to the seller, or if you agree to return the goods to the seller and fail to do so, then you remain liable for performance of all obligations under the contract.
        </div>
        <div style={{ fontSize:13, color:TEXT, fontWeight:600 }}>To cancel this transaction, mail or deliver a signed and dated copy of this cancellation notice, or any other written notice, to:</div>
        <div style={{ fontSize:13, color:TEXT, marginTop:6, lineHeight:1.6 }}>
          <strong>Freedom Exteriors LLC</strong><br/>1145 Summit Ave<br/>Mahtomedi, MN 55115
        </div>
        <div style={{ fontSize:13, color:TEXT, fontWeight:600, marginTop:12 }}>I hereby cancel this transaction.</div>
      </div>
      <SignatureBox label={`${label} — Buyer's Signature`} signature={data[sigKey]} onSign={s=>setData(d=>({...d,[sigKey]:s}))} onClear={()=>setData(d=>({...d,[sigKey]:null}))} />
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:DARK, zIndex:300, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
      <div style={{ position:"sticky", top:0, background:PANEL2, borderBottom:`1px solid ${BORDER}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", zIndex:5 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:17, letterSpacing:1 }}>
          <span style={{ color:TEAL }}>FREEDOM </span><span style={{ color:GOLD }}>EXTERIORS</span>
          <span style={{ color:MUTED, fontWeight:500, fontSize:13, marginLeft:10 }}>SD Cancellation Notice</span>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {savedFlash && <span style={{ color:TEAL, fontSize:12, fontWeight:700 }}>✓ Saved</span>}
          {allSigned && <span style={{ color:"#10b981", fontSize:12, fontWeight:700 }}>✓ Both Copies Signed</span>}
          {allSigned && <button onClick={() => exportSDCancellationNotice(data, job)} style={{ background:"#fff2", border:"1px solid #fff4", color:TEXT, borderRadius:7, padding:"9px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>📥 PDF</button>}
          <button onClick={save} style={{ background:`${TEAL}22`, border:`1px solid ${TEAL}`, color:TEAL, borderRadius:7, padding:"9px 16px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>💾 Save</button>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${BORDER}`, color:MUTED, borderRadius:7, padding:"9px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>✕ Close</button>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:18 }}>
        <div style={{ textAlign:"center", marginBottom:18 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, letterSpacing:1, color:TEXT }}>NOTICE OF CANCELLATION</div>
          <div style={{ color:GOLD, fontWeight:700, fontSize:14, marginTop:2 }}>South Dakota — SDCL § 37-24-5.3 &amp; 5.4</div>
          <div style={{ color:MUTED, fontSize:13, marginTop:4 }}>Furnished to buyer in duplicate at time of signing — 3 business day right to cancel</div>
        </div>

        <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:10, padding:18, marginBottom:16 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:14, color:GOLD, marginBottom:14, textTransform:"uppercase", letterSpacing:1 }}>Buyer Information</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>Buyer Name</label>
              <input value={data.buyerName||""} onChange={e=>set("buyerName")(e.target.value)}
                style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"12px", fontSize:16, fontFamily:"inherit", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>Property Address</label>
              <input value={data.propertyAddress||""} onChange={e=>set("propertyAddress")(e.target.value)}
                style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"12px", fontSize:16, fontFamily:"inherit", boxSizing:"border-box" }} />
            </div>
          </div>
          <div style={{ marginTop:14 }}>
            <label style={{ display:"block", fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>Date of Transaction</label>
            <input type="date" value={data.transactionDate||""} onChange={e=>set("transactionDate")(e.target.value)}
              style={{ width:"100%", maxWidth:220, background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"12px", fontSize:16, fontFamily:"inherit", boxSizing:"border-box" }} />
          </div>
        </div>

        <CopySection label="Copy 1" sigKey="copy1Signature" />
        <CopySection label="Copy 2" sigKey="copy2Signature" />

        <div style={{ textAlign:"center", paddingBottom:30 }}>
          <button onClick={save} style={{ background:`${TEAL}22`, border:`1px solid ${TEAL}`, color:TEAL, borderRadius:8, padding:"14px 28px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>💾 Save Notice</button>
        </div>
      </div>
    </div>
  );
}