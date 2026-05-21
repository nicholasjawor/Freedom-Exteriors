import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const TEAL = "#1a9e99"; const GOLD = "#e8a820"; const DARK = "#080d14";
const PANEL = "#0f1923"; const PANEL2 = "#162030"; const BORDER = "#1e3048";
const TEXT = "#e2eaf4"; const MUTED = "#6b8099";

const STAGES = [
  { id: "lead",       label: "New Lead",    icon: "📥" },
  { id: "inspection", label: "Inspection",  icon: "🔍" },
  { id: "claim",      label: "Claim Filed", icon: "📋" },
  { id: "approved",   label: "Approved",    icon: "✅" },
  { id: "scheduled",  label: "Scheduled",   icon: "📅" },
  { id: "installed",  label: "Installed",   icon: "🔨" },
  { id: "collected",  label: "Collected",   icon: "💰" },
];

export default function Portal({ token }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("status");
  const [message, setMessage] = useState("");
  const [msgSent, setMsgSent] = useState(false);
  const [signature, setSignature] = useState("");
  const [sigSaved, setSigSaved] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("portal_token", token)
        .single();
      if (!error && data) setJob(data.data);
      setLoading(false);
    }
    load();
  }, [token]);

  const stageIdx = job ? STAGES.findIndex(s => s.id === job.stage) : 0;

  const sendMessage = async () => {
    if (!message.trim()) return;
    await supabase.from("messages").insert({
      portal_token: token,
      homeowner_name: job?.name || "Homeowner",
      message: message.trim(),
      read: false,
    });
    setMessage("");
    setMsgSent(true);
  };

  const saveSignature = async () => {
    if (!signature.trim()) return;
    const { data: row } = await supabase
      .from("jobs")
      .select("id, data")
      .eq("portal_token", token)
      .single();
    if (row) {
      const updated = { ...row.data, portalSignature: signature, portalSignedAt: new Date().toISOString() };
      await supabase.from("jobs").update({ data: updated }).eq("id", row.id);
      setJob(updated);
      setSigSaved(true);
    }
  };

  const uploadPhotos = async (files) => {
    setPhotoUploading(true);
    const readers = Array.from(files).map(file => new Promise(res => {
      const r = new FileReader();
      r.onload = e => res({ id: Date.now() + Math.random(), url: e.target.result, name: file.name, cat: "Homeowner Upload", added: new Date().toLocaleDateString() });
      r.readAsDataURL(file);
    }));
    const newPhotos = await Promise.all(readers);
    const { data: row } = await supabase.from("jobs").select("id, data").eq("portal_token", token).single();
    if (row) {
      const updated = { ...row.data, photos: [...(row.data.photos || []), ...newPhotos] };
      await supabase.from("jobs").update({ data: updated }).eq("id", row.id);
      setJob(updated);
      setPhotos(prev => [...prev, ...newPhotos]);
    }
    setPhotoUploading(false);
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:DARK, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10, fontFamily:"'Barlow Condensed',sans-serif" }}>
      <div style={{ fontWeight:800, fontSize:28, letterSpacing:4 }}><span style={{ color:TEAL }}>FREEDOM </span><span style={{ color:GOLD }}>EXTERIORS</span></div>
      <div style={{ color:TEAL, fontWeight:700, letterSpacing:3, fontSize:11 }}>LOADING YOUR JOB…</div>
    </div>
  );

  if (!job) return (
    <div style={{ minHeight:"100vh", background:DARK, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10, fontFamily:"'Barlow Condensed',sans-serif", padding:20 }}>
      <div style={{ fontWeight:800, fontSize:28, letterSpacing:4 }}><span style={{ color:TEAL }}>FREEDOM </span><span style={{ color:GOLD }}>EXTERIORS</span></div>
      <div style={{ color:"#f87171", fontWeight:700, fontSize:14, marginTop:10 }}>Portal link not found or expired.</div>
      <div style={{ color:MUTED, fontSize:12 }}>Please contact us at (651) 283-1689</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:DARK, color:TEXT, fontFamily:"'Barlow','Segoe UI',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&family=Barlow+Condensed:wght@700;800&display=swap" rel="stylesheet"/>
      <header style={{ background:PANEL, borderBottom:`2px solid ${BORDER}`, padding:"0 20px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:22, letterSpacing:4 }}>
            <span style={{ color:TEAL }}>FREEDOM </span><span style={{ color:GOLD }}>EXTERIORS</span>
          </div>
          <div style={{ fontSize:9, letterSpacing:3, color:TEAL, fontWeight:700 }}>HOMEOWNER PORTAL</div>
        </div>
        <a href="tel:6512831689" style={{ color:GOLD, fontWeight:700, fontSize:13, textDecoration:"none" }}>📞 (651) 283-1689</a>
      </header>
      <div style={{ background:PANEL2, borderBottom:`1px solid ${BORDER}`, padding:"16px 20px" }}>
        <div style={{ fontWeight:800, fontSize:22 }}>{job.name}</div>
        <div style={{ color:MUTED, fontSize:13 }}>{job.address}, {job.city}, {job.state}</div>
        <div style={{ marginTop:10, display:"flex", gap:6, flexWrap:"wrap" }}>
          <span style={{ background:TEAL+"22", color:TEAL, borderRadius:5, padding:"3px 10px", fontSize:12, fontWeight:700 }}>{job.type}</span>
          {job.insurer && <span style={{ background:PANEL, color:MUTED, borderRadius:5, padding:"3px 10px", fontSize:12 }}>{job.insurer}</span>}
          {job.claimNum && <span style={{ background:GOLD+"22", color:GOLD, borderRadius:5, padding:"3px 10px", fontSize:12, fontFamily:"monospace" }}>{job.claimNum}</span>}
        </div>
      </div>
      <div style={{ padding:"16px 20px", background:PANEL, borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Job Progress</div>
        <div style={{ display:"flex", alignItems:"center" }}>
          {STAGES.map((s, i) => (
            <div key={s.id} style={{ display:"flex", alignItems:"center", flex:1 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:i<=stageIdx?TEAL:BORDER, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, border:`2px solid ${i===stageIdx?GOLD:i<stageIdx?TEAL:BORDER}` }}>
                  {i < stageIdx ? "✓" : s.icon}
                </div>
                <div style={{ fontSize:8, color:i<=stageIdx?TEAL:MUTED, marginTop:3, textAlign:"center", fontWeight:i===stageIdx?800:400, whiteSpace:"nowrap" }}>{s.label}</div>
              </div>
              {i < STAGES.length-1 && <div style={{ height:2, flex:1, background:i<stageIdx?TEAL:BORDER, marginBottom:14 }}/>}
            </div>
          ))}
        </div>
        <div style={{ marginTop:12, background:PANEL2, borderRadius:8, padding:"10px 14px", border:`1px solid ${GOLD}44` }}>
          <div style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1 }}>Current Stage</div>
          <div style={{ fontSize:18, fontWeight:800, color:GOLD, marginTop:2 }}>{STAGES[stageIdx]?.icon} {STAGES[stageIdx]?.label}</div>
        </div>
      </div>
      <div style={{ background:PANEL2, borderBottom:`1px solid ${BORDER}`, padding:"0 20px", display:"flex", gap:2 }}>
        {[{id:"status",label:"📋 Status"},{id:"contracts",label:"✍️ Sign"},{id:"photos",label:"📷 Photos"},{id:"message",label:"💬 Message"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background:"none", border:"none", color:tab===t.id?GOLD:MUTED, borderBottom:tab===t.id?`2px solid ${GOLD}`:"2px solid transparent", padding:"12px 14px", cursor:"pointer", fontSize:12, fontWeight:tab===t.id?700:500, fontFamily:"inherit" }}>{t.label}</button>
        ))}
      </div>
      <div style={{ padding:"16px 20px", maxWidth:600, margin:"0 auto" }}>
        {tab==="status" && (
          <div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>Your Job Details</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
              {[["Job Type",job.type],["Assigned Rep",job.assigned],["Insurance",job.insurer],["Claim #",job.claimNum||"Not filed"],["Date Added",job.added],["Install Date",job.installDate||"TBD"]].map(([l,v]) => (
                <div key={l} style={{ background:PANEL, borderRadius:7, padding:"9px 12px", border:`1px solid ${BORDER}` }}>
                  <div style={{ color:MUTED, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>{l}</div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{v||"—"}</div>
                </div>
              ))}
            </div>
            {job.estimate?.total > 0 && (
              <div style={{ background:PANEL, borderRadius:8, padding:14, border:`1px solid ${BORDER}`, marginBottom:14 }}>
                <div style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Estimate Summary</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, textAlign:"center" }}>
                  {[["Contract Value",`$${(job.estimate.total||0).toLocaleString()}`,"#10b981"],["Down Payment",`$${(job.estimate.downPayment||0).toLocaleString()}`,GOLD],["Deductible",`$${(job.estimate.deductible||0).toLocaleString()}`,"#f87171"]].map(([l,v,c]) => (
                    <div key={l}><div style={{ fontSize:9, color:MUTED }}>{l}</div><div style={{ fontSize:18, fontWeight:800, color:c }}>{v}</div></div>
                  ))}
                </div>
              </div>
            )}
            {job.notes && (
              <div style={{ background:PANEL, borderRadius:7, padding:"10px 12px", border:`1px solid ${BORDER}` }}>
                <div style={{ color:MUTED, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>Notes from your rep</div>
                <div style={{ fontSize:13, lineHeight:1.6 }}>{job.notes}</div>
              </div>
            )}
          </div>
        )}
        {tab==="contracts" && (
          <div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>✍️ Sign Your Contract</div>
            <div style={{ color:MUTED, fontSize:12, marginBottom:14 }}>Type your full legal name below to provide your electronic signature.</div>
            {job.portalSignature ? (
              <div style={{ background:TEAL+"22", border:`1px solid ${TEAL}`, borderRadius:8, padding:16, textAlign:"center" }}>
                <div style={{ fontSize:20 }}>✅</div>
                <div style={{ fontWeight:700, color:TEAL, marginTop:6 }}>Contract Signed</div>
                <div style={{ color:MUTED, fontSize:12, marginTop:4 }}>Signed by: {job.portalSignature}</div>
                <div style={{ color:MUTED, fontSize:11 }}>{new Date(job.portalSignedAt).toLocaleString()}</div>
              </div>
            ) : (
              <div>
                {job.estimate?.scope && (
                  <div style={{ background:PANEL, borderRadius:8, padding:12, border:`1px solid ${BORDER}`, marginBottom:14, fontSize:12, lineHeight:1.7, color:MUTED }}>
                    <div style={{ color:TEXT, fontWeight:700, marginBottom:6 }}>Scope of Work:</div>
                    {job.estimate.scope}
                  </div>
                )}
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:6 }}>Type your full legal name to sign</label>
                  <input value={signature} onChange={e => setSignature(e.target.value)} placeholder="Your full legal name"
                    style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"12px 14px", fontSize:16, fontFamily:"Georgia, serif", boxSizing:"border-box" }}/>
                </div>
                <div style={{ color:MUTED, fontSize:11, marginBottom:14 }}>By typing your name above, you agree to the scope of work and terms outlined by Freedom Exteriors LLC. This constitutes a legally binding electronic signature.</div>
                <button onClick={saveSignature} disabled={!signature.trim()} style={{ width:"100%", background:signature.trim()?GOLD:"#333", color:signature.trim()?"#000":MUTED, border:"none", borderRadius:8, padding:"12px", fontWeight:800, fontSize:14, cursor:signature.trim()?"pointer":"default", fontFamily:"inherit" }}>
                  ✍️ Sign Contract
                </button>
                {sigSaved && <div style={{ color:TEAL, fontWeight:700, textAlign:"center", marginTop:10 }}>✅ Signature saved!</div>}
              </div>
            )}
          </div>
        )}
        {tab==="photos" && (
          <div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>📷 Upload Photos</div>
            <div style={{ color:MUTED, fontSize:12, marginBottom:14 }}>Upload photos of damage, your roof, or anything relevant to your claim.</div>
            <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, cursor:"pointer", background:PANEL2, border:`2px dashed ${BORDER}`, borderRadius:9, padding:"20px", marginBottom:14 }}>
              <input type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e => uploadPhotos(e.target.files)}/>
              <span style={{ fontSize:28 }}>📷</span>
              <div><div style={{ fontWeight:700, fontSize:14 }}>{photoUploading?"Uploading…":"Tap to Upload Photos"}</div><div style={{ color:MUTED, fontSize:11 }}>JPG, PNG — multiple allowed</div></div>
            </label>
            {(job.photos||[]).filter(p => p.cat==="Homeowner Upload").length > 0 && (
              <div>
                <div style={{ fontSize:11, color:GOLD, fontWeight:700, marginBottom:8 }}>Your Uploads</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                  {(job.photos||[]).filter(p => p.cat==="Homeowner Upload").map(ph => (
                    <img key={ph.id} src={ph.url} alt={ph.name} style={{ width:"100%", height:90, objectFit:"cover", borderRadius:7, border:`1px solid ${BORDER}` }}/>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {tab==="message" && (
          <div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>💬 Message Your Rep</div>
            <div style={{ color:MUTED, fontSize:12, marginBottom:14 }}>Send a message directly to your Freedom Exteriors representative.</div>
            {msgSent ? (
              <div style={{ background:TEAL+"22", border:`1px solid ${TEAL}`, borderRadius:8, padding:20, textAlign:"center" }}>
                <div style={{ fontSize:24 }}>✅</div>
                <div style={{ fontWeight:700, color:TEAL, marginTop:6 }}>Message Sent!</div>
                <div style={{ color:MUTED, fontSize:12, marginTop:4 }}>Your rep will follow up with you shortly.</div>
                <button onClick={() => { setMsgSent(false); setMessage(""); }} style={{ marginTop:12, background:"none", border:`1px solid ${TEAL}`, color:TEAL, borderRadius:7, padding:"7px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>Send Another</button>
              </div>
            ) : (
              <div>
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message here..." rows={5}
                  style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"10px 12px", fontSize:13, fontFamily:"inherit", boxSizing:"border-box", resize:"vertical", marginBottom:10 }}/>
                <button onClick={sendMessage} disabled={!message.trim()} style={{ width:"100%", background:message.trim()?TEAL:"#333", color:message.trim()?TEXT:MUTED, border:"none", borderRadius:8, padding:"12px", fontWeight:800, fontSize:14, cursor:message.trim()?"pointer":"default", fontFamily:"inherit" }}>
                  Send Message →
                </button>
              </div>
            )}
            <div style={{ marginTop:20, background:PANEL, borderRadius:8, padding:14, border:`1px solid ${BORDER}` }}>
              <div style={{ fontSize:11, color:MUTED, marginBottom:6 }}>Or reach us directly:</div>
              <a href="tel:6512831689" style={{ color:GOLD, fontWeight:700, fontSize:14, textDecoration:"none", display:"block" }}>📞 (651) 283-1689</a>
              <a href="mailto:nick@freedom-exteriors.com" style={{ color:TEAL, fontSize:12, textDecoration:"none", display:"block", marginTop:4 }}>✉️ nick@freedom-exteriors.com</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}