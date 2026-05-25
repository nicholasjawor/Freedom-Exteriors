import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
/* eslint-disable react-hooks/exhaustive-deps */
const TEAL = "#1a9e99"; const GOLD = "#e8a820"; const DARK = "#080d14";
const PANEL = "#0f1923"; const PANEL2 = "#162030"; const BORDER = "#1e3048";
const TEXT = "#e2eaf4"; const MUTED = "#6b8099";

// ── Constants ─────────────────────────────────────────────────────
const STAGES = [
  { id: "lead",       label: "New Lead",    color: "#64748b", icon: "📥" },
  { id: "inspection", label: "Inspection",  color: "#0ea5e9", icon: "🔍" },
  { id: "claim",      label: "Claim Filed", color: "#8b5cf6", icon: "📋" },
  { id: "approved",   label: "Approved",    color: GOLD,      icon: "✅" },
  { id: "scheduled",  label: "Scheduled",   color: "#f97316", icon: "📅" },
  { id: "installed",  label: "Installed",   color: TEAL,      icon: "🔨" },
  { id: "collected",  label: "Collected",   color: "#10b981", icon: "💰" },
];
const ADMIN_EMAIL = "nicholasjawor@gmail.com";
const USERS = ["Nick", "Victor"];
const JOB_TYPES = ["Roof","Siding","Windows","Roof + Siding","Siding + Windows","Full Exterior"];
const INSURERS = ["State Farm","Allstate","Travelers","Farmers","Liberty Mutual","American Family","Auto-Owners","USAA","Other","None / OOP"];
const STATES = ["MN","WI"];
const PHOTO_CATS = ["Damage","Before","After","Adjuster Visit","Misc"];

const CHECKLIST_ITEMS = [
  { id:"c1",  label:"Schedule Product Meeting — review trades, selections, ACV/RCV basics" },
  { id:"c2",  label:"Color Form completed — manufacturer, product, color confirmed & signed" },
  { id:"c3",  label:"Collect Down Payment — 1st check (ACV), deductible, retail upgrades" },
  { id:"c4",  label:"Letter of Authorization (LOA) — verify lender, all parties signed" },
  { id:"c5",  label:"Skylight — measurements, photos inside/outside, exemption form if needed" },
  { id:"c6",  label:"Retail Agreement / Contract signed" },
  { id:"c7",  label:"Lead Form signed (if home built 1979 or prior)" },
  { id:"c8",  label:"Home Conditions Report (HCR) — photos of damage/deterioration, signed" },
  { id:"c9",  label:"Decking Photos / Attic Inspection — tape measure in each photo" },
  { id:"c10", label:"Pictures + Specs — attic, elevation, fascia, drip edge, sider's edge, heat tape" },
  { id:"c11", label:"Pre-Build Precaution Letter — all 8 items initialed by homeowner" },
  { id:"c12", label:"Contractor Documents Acknowledgement signed" },
  { id:"c13", label:"MN Mandatory Lien Notice delivered & signed" },
  { id:"c14", label:"Cancellation Notice (MN §326B.811) — 2 copies to homeowner" },
  { id:"c15", label:"Permit pulled" },
  { id:"c16", label:"Materials ordered (ABC Supply)" },
  { id:"c17", label:"Dumpster scheduled" },
  { id:"c18", label:"Crew scheduled & confirmed" },
  { id:"c19", label:"Final inspection complete" },
  { id:"c20", label:"Final invoice sent / collected" },
];

const ABC_CATALOG = [
  { id:"a1",  cat:"Shingles",        name:"GAF Timberline HDZ",          unit:"sq",  price:110 },
  { id:"a2",  cat:"Shingles",        name:"GAF Timberline CS",           unit:"sq",  price:98  },
  { id:"a3",  cat:"Shingles",        name:"Owens Corning Duration",      unit:"sq",  price:105 },
  { id:"a4",  cat:"Underlayment",    name:"GAF FeltBuster",              unit:"sq",  price:18  },
  { id:"a5",  cat:"Underlayment",    name:"Ice & Water Shield",          unit:"sq",  price:55  },
  { id:"a6",  cat:"Underlayment",    name:"Synthetic Underlayment",      unit:"sq",  price:22  },
  { id:"a7",  cat:"Ventilation",     name:"GAF Cobra Ridge Vent",        unit:"lf",  price:4.5 },
  { id:"a8",  cat:"Ventilation",     name:"Attic Vent (box)",            unit:"ea",  price:28  },
  { id:"a9",  cat:"Accessories",     name:"Drip Edge (10ft)",            unit:"ea",  price:8   },
  { id:"a10", cat:"Accessories",     name:"Starter Strip",               unit:"sq",  price:35  },
  { id:"a11", cat:"Accessories",     name:"Hip & Ridge Cap",             unit:"bdl", price:65  },
  { id:"a12", cat:"Accessories",     name:"Pipe Boot Flashing",          unit:"ea",  price:22  },
  { id:"a13", cat:"Nails / Fasteners",name:"Roofing Nails (1-3/4\")",   unit:"bx",  price:45  },
  { id:"a14", cat:"Siding",          name:"LP SmartSide 4\" Lap",       unit:"sq",  price:165 },
  { id:"a15", cat:"Siding",          name:"James Hardie HZ5 Plank",     unit:"sq",  price:185 },
  { id:"a16", cat:"Siding",          name:"Alside Mezzo Vinyl Siding",  unit:"sq",  price:125 },
  { id:"a17", cat:"Siding Acc.",     name:"House Wrap / WRB",           unit:"sq",  price:30  },
  { id:"a18", cat:"Siding Acc.",     name:"J-Channel (12ft)",           unit:"ea",  price:6   },
  { id:"a19", cat:"Gutters",         name:"5\" Aluminum Gutter (lf)",   unit:"lf",  price:5   },
  { id:"a20", cat:"Gutters",         name:"Downspout (10ft)",           unit:"ea",  price:12  },
];

const CONTRACT_TEMPLATES = {
  insurance_contingency: {
    label: "Insurance Contingency Contract",
    desc: "Pre-adjuster — null & void if claim denied",
    icon: "🛡️",
    color: "#8b5cf6",
    body: (job) => `RESIDENTIAL ROOFING CONTRACT — INSURANCE CONTINGENCY

Freedom Exteriors LLC · 1145 Summit Ave · Mahtomedi, MN 55115 · 651-283-1689

Property Address: ${job.address}, ${job.city}, ${job.state}
Date of Loss: ___________________
Homeowner(s): ${job.name}    Phone: ${job.phone}
Insurance Company: ${job.insurer}    Claim #: ${job.claimNum || "Pending"}
Adjuster: ${job.adjuster || "TBD"}    Adjuster Phone: ${job.adjPhone || "TBD"}

────────────────────────────────────────────────
HOMEOWNER has hired Freedom Exteriors LLC to perform the following:
• Inspect the roof for signs of damage and offer expert opinion as to serviceability
• Assist in filing the insurance claim
• Provide an inspection report of the roof
• Take photographs of damaged areas and provide insurance with proper documents

IF THE INSURANCE ADJUSTER DENIES THE COST OF REPLACEMENT:
This contract is immediately null and void.
Homeowners shall have no further obligation to contractor.

IF THE INSURANCE ADJUSTER AGREES TO REPLACE THE ROOF:
The homeowner agrees that Freedom Exteriors LLC shall be hired as the sole contractor
to perform the replacement for the entire amount allowed by the insurance summary.

HOMEOWNERS agree that the performance of all these tasks may not be necessary and
that failure to perform any or all the tasks does not relieve the homeowner from agreed
upon obligations.

HOMEOWNERS will be responsible for paying their deductible.
Freedom Exteriors LLC shall not be subjected to competitive bidding with other contractors.

If Contractor is successful in gaining insurance approval, and Homeowner elects not to
hire Contractor, Homeowner shall pay Contractor $1,000.00 in consideration for
Contractor's work. Homeowner will be responsible for all attorney and court costs arising
from Homeowner's non-performance of this contract. Buyer has 3 days from the written
contract to cancel.

────────────────────────────────────────────────
Homeowner Signature: ___________________________ Date: ____________
Printed Name: __________________________________ Date: ____________
Homeowner Signature: ___________________________ Date: ____________
Printed Name: __________________________________ Date: ____________

Freedom Exteriors LLC Representative: _____________ Date: ____________
Printed Name: __________________________________ Date: ____________

Phone: (651) 283-1689`
  },
  residential_roofing: {
    label: "Residential Roofing Contract",
    desc: "Full contract — insurance approved jobs",
    icon: "📋",
    color: TEAL,
    body: (job, est) => `RESIDENTIAL ROOFING CONTRACT NO. ___________

Freedom Exteriors LLC · 1145 Summit Ave · Mahtomedi, MN 55115 · 651-283-1689

Owner's Name: ${job.name}
Owner's Address: ${job.address}, ${job.city}, ${job.state} ${job.zip || ""}
Owner's Phone: ${job.phone}    Owner's Alt. Phone: _______________
Project Name & Address: ${job.address}, ${job.city}, ${job.state}
Email: _______________
Insurance Company: ${job.insurer}    Claim #: ${job.claimNum || "N/A"}

I/WE, the Owner(s) of the premises described above authorize Freedom Exteriors LLC,
hereinafter referred to as "Contractor", to furnish all materials and labor necessary to
roof and/or improve these premises in a good, workmanlike and substantial manner
according to the following terms, specifications and provisions:

a. Description of the work and the materials to be used:
${est?.scope || "[Scope of work to be completed here]"}

b. Description of any areas that will NOT be worked on:
_________________________________________________________________

INSURANCE: THE ONLY COST TO THE PROPERTY OWNER IS THEIR DEDUCTIBLE, PLUS
ANY UPGRADES CHOSEN OR ANY NON-COVERED ITEMS THAT MUST BE REPLACED TO
COMPLETE THE REPAIRS. THE CONTRACT BALANCE IS PAID BY YOUR INSURANCE
COMPANY PER FINAL LOSS INVOICE. THIS AGREEMENT IS NULL AND VOID AND DOES
NOT OBLIGATE ANY PARTY TO IT SHOULD THE INSURANCE COMPANY REFUSE
COVERAGE. OWNER ACKNOWLEDGES CONTRACTOR IS A GENERAL CONTRACTOR AND
AS SUCH IS ENTITLED TO 10% OVERHEAD AND 10% PROFIT AS ALLOWED BY
INSURANCE INDUSTRY STANDARDS.

c. Payment: Contractor proposes to perform the above work for the:
Total Sum of $${est?.total?.toFixed(2) || "____________"}
Down Payment (if any) $${est?.downPayment?.toFixed(2) || "____________"}

Payment Schedule:
1. ___________________________ Amount: $_____________
2. ___________________________ Amount: $_____________
3. ___________________________ Amount: $_____________

d. Approximate Start Date: ${job.installDate || "___________"}
   Approximate Completion Date: _______________

────────────────────────────────────────────────
Approved and accepted (owner): __________________ Date: ____________
Approved and accepted (owner): __________________
Approved (contractor): __________________________ Date: ____________

You, the Buyer, may cancel this transaction at any time prior to midnight of the
third business day after the date of this transaction. You may also cancel within
72 hours after being notified that your insurer has denied your claim.

NOTE: This contract may be withdrawn or renegotiated after _____ days if not
approved and signed by BOTH parties.

General Contractor License #IR813877 | Phone: (651) 283-1689`
  },
  retail: {
    label: "Retail Contract (OOP)",
    desc: "Non-insurance / out-of-pocket jobs",
    icon: "🏠",
    color: "#f97316",
    body: (job, est) => `RESIDENTIAL ROOFING CONTRACT NO. ___________ (RETAIL)

Freedom Exteriors LLC · 1145 Summit Ave · Mahtomedi, MN 55115 · 651-283-1689

Owner's Name: ${job.name}
Owner's Address: ${job.address}, ${job.city}, ${job.state}
Owner's Phone: ${job.phone}
Project Address: ${job.address}, ${job.city}, ${job.state}
Email: _______________
Job Type: ${job.type}

I/WE, the Owner(s) authorize Freedom Exteriors LLC to furnish all materials and labor
necessary to complete the following work in a good, workmanlike and substantial manner:

a. Description of the work and materials:
${est?.scope || "[Scope of work and material specifications]"}

b. Areas NOT to be worked on:
_________________________________________________________________

c. Payment: Total Sum of $${est?.total?.toFixed(2) || "____________"}
Down Payment: $${est?.downPayment?.toFixed(2) || "____________"}

Payment Schedule:
1. ___________________________ Amount: $_____________
2. ___________________________ Amount: $_____________
3. ___________________________ Amount: $_____________

d. Approximate Start Date: ${job.installDate || "___________"}
   Approximate Completion Date: _______________

e. This contract is approved and accepted. No oral agreements or understandings
between the parties exist. Any changes require written change orders approved by both parties.

MINNESOTA MANDATORY LIEN NOTICE (§514.011):
ANY PERSON OR COMPANY SUPPLYING LABOR OR MATERIALS FOR THIS IMPROVEMENT
TO YOUR PROPERTY MAY FILE A LIEN AGAINST YOUR PROPERTY IF THAT PERSON OR
COMPANY IS NOT PAID FOR THE CONTRIBUTIONS.

HOUSING STATUTORY WARRANTY (§327A):
Workmanship: 1 year | Major structural: 10 years | Mechanical systems: 2 years

────────────────────────────────────────────────
Approved and accepted (owner): __________________ Date: ____________
Approved and accepted (owner): __________________
Approved (contractor): __________________________ Date: ____________

You, the Buyer, may cancel this transaction at any time prior to midnight of the
third business day after the date of this transaction.

General Contractor License #IR813877 | Phone: (651) 283-1689`
  },
};

// ── Storage ────────────────────────────────────────────────────────
const SK = "freedom-ext-v3";
async function loadJobs() {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_email", "all");
    if (!error && data?.length) {
      return data.map(r => r.data);
    }
  } catch(_) {}
  try { const r = await window.storage.get(SK); if (r?.value) { const p = JSON.parse(r.value); return p.length ? p : SEED; } } catch(_) {}
  return SEED;
}
async function persistJobs(jobs) {
  try {
    await supabase.from("jobs").delete().eq("user_email", "all");
    if (jobs.length) {
      await supabase.from("jobs").insert(
        jobs.map(j => ({ user_email: "all", data: j }))
      );
    }
  } catch(e) { console.warn(e); }
  try { await window.storage.set(SK, JSON.stringify(jobs)); } catch(_) {}
}

const SEED = [
  { id:1, name:"Mike Harrington", address:"412 Elm St", city:"Blaine", state:"MN", phone:"612-555-0182", type:"Roof", stage:"approved", claimNum:"CLM-2026-8821", insurer:"State Farm", adjuster:"Sarah Cole", adjPhone:"651-555-0291", hoverId:"", notes:"Supplement pending for decking. Drip edge not included.", followUp:true, assigned:"Me", added:"2026-05-01", photos:[], checklist:{}, materials:[], estimate:{total:0,downPayment:0,scope:"",deductible:0}, contract:null, commission:{grossRevenue:0} },
  { id:2, name:"Donna Reyes", address:"88 Birchwood Dr", city:"Coon Rapids", state:"MN", phone:"763-555-0347", type:"Roof + Siding", stage:"claim", claimNum:"CLM-2026-9104", insurer:"Allstate", adjuster:"Tom Walsh", adjPhone:"612-555-0412", hoverId:"", notes:"Adjuster appt Friday 10am.", followUp:true, assigned:"Me", added:"2026-05-08", photos:[], checklist:{}, materials:[], estimate:{total:0,downPayment:0,scope:"",deductible:0}, contract:null, commission:{grossRevenue:0} },
  { id:3, name:"James Pollard", address:"301 Oak Ave", city:"Maple Grove", state:"MN", phone:"763-555-0561", type:"Windows", stage:"lead", claimNum:"", insurer:"Travelers", adjuster:"", adjPhone:"", hoverId:"", notes:"April hail storm.", followUp:false, assigned:"Me", added:"2026-05-15", photos:[], checklist:{}, materials:[], estimate:{total:0,downPayment:0,scope:"",deductible:0}, contract:null, commission:{grossRevenue:0} },
  { id:4, name:"Carla Dietrich", address:"19 Spruce Ln", city:"Plymouth", state:"MN", phone:"952-555-0788", type:"Roof", stage:"scheduled", claimNum:"CLM-2026-7755", insurer:"Farmers", adjuster:"Bill Nguyen", adjPhone:"952-555-0900", hoverId:"", notes:"Install May 26. GAF Timberline HDZ Charcoal.", followUp:false, assigned:"Me", added:"2026-04-22", photos:[], checklist:{}, materials:[], estimate:{total:18500,downPayment:2500,scope:"Full roof replacement - GAF Timberline HDZ Charcoal. Remove existing shingles, install ice & water shield in valleys and eaves, synthetic underlayment, new drip edge, ventilation, starter strip, and shingles.",deductible:2500}, contract:null, commission:{grossRevenue:18500} },
  { id:5, name:"Ray Okonkwo", address:"554 Cedar Blvd", city:"Fridley", state:"MN", phone:"612-555-0234", type:"Siding", stage:"inspection", claimNum:"", insurer:"Liberty Mutual", adjuster:"", adjPhone:"", hoverId:"", notes:"Storm damage May 10.", followUp:true, assigned:"Me", added:"2026-05-16", photos:[], checklist:{}, materials:[], estimate:{total:0,downPayment:0,scope:"",deductible:0}, contract:null, commission:{grossRevenue:0} },
  { id:6, name:"Beth Larson", address:"77 Lake Shore Rd", city:"Hudson", state:"WI", phone:"715-555-0311", type:"Roof", stage:"lead", claimNum:"", insurer:"American Family", adjuster:"", adjPhone:"", hoverId:"", notes:"Referral. Hail damage.", followUp:false, assigned:"Me", added:"2026-05-17", photos:[], checklist:{}, materials:[], estimate:{total:0,downPayment:0,scope:"",deductible:0}, contract:null, commission:{grossRevenue:0} },
];

const blank = () => ({
  id: Date.now(), name:"", address:"", city:"", state:"MN", phone:"", email:"",
  type:"Roof", stage:"lead", claimNum:"", insurer:"State Farm", adjuster:"", adjPhone:"",
  hoverId:"", notes:"", followUp:false, assigned:"Me",
  added: new Date().toISOString().slice(0,10),
  photos:[], checklist:{}, materials:[], estimate:{total:0,downPayment:0,scope:"",deductible:0},
  contract:null, commission:{grossRevenue:0},
});

// ── Logo ──────────────────────────────────────────────────────────


// ── Main App ──────────────────────────────────────────────────────
export default function Pipeline({ session }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [mainView, setMainView] = useState("board");
  const [filterStage, setFilterStage] = useState("all");
  const [filterState, setFilterState] = useState("all");
  const [selected, setSelected] = useState(null);
  const [jobTab, setJobTab] = useState("details");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [contractPreview, setContractPreview] = useState(null);
  const [abcFilter, setAbcFilter] = useState("All");

  useEffect(() => { loadJobs().then(d => { setJobs(d); setLoading(false); }); }, [session?.user?.email]); // eslint-disable-line

  const save = useCallback(async (next) => {
    setSaveStatus("saving");
    try { await persistJobs(next, session?.user?.email); setSaveStatus("saved"); }
    catch { setSaveStatus("error"); }
  }, []);

  const updateJobs = useCallback((updater) => {
    setJobs(prev => { const next = typeof updater === "function" ? updater(prev) : updater; save(next); return next; });
  }, [save]);

  const updateJob = useCallback((id, patch) => {
    updateJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
    setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  }, [updateJobs]);

  const followUps = jobs.filter(j => j.followUp);
  const stageObj = id => STAGES.find(s => s.id === id) || STAGES[0];

  const userEmail = session?.user?.email;
const isAdmin = userEmail === ADMIN_EMAIL;
const userName = userEmail === "nick@freedom-exteriors.com" ? "Nick"
               : userEmail === "victor@freedom-exteriors.com" ? "Victor"
               : null;

const filtered = jobs.filter(j => {
  if (!isAdmin && userName && j.assigned !== userName) return false;
  if (filterStage !== "all" && j.stage !== filterStage) return false;
  if (filterState !== "all" && j.state !== filterState) return false;
  return true;
});
  const openNew = () => { setForm(blank()); setEditing(false); setShowForm(true); setSelected(null); };
  const openEdit = (job) => { setForm({...job}); setEditing(true); setShowForm(true); setSelected(null); };

   const saveJob = () => {
  if (!form.name.trim()) return;
  const isNew = !editing;
  const token = form.id + "-" + Math.random().toString(36).slice(2,8);
  const jobWithToken = isNew ? { ...form, portal_token: token } : form;
  updateJobs(prev => editing ? prev.map(j => j.id === form.id ? jobWithToken : j) : [...prev, jobWithToken]);
  if (isNew && form.email) {
    const portalLink = window.location.origin + "/portal/" + token;
    const emailHtml = "<div style='font-family:Arial,sans-serif;padding:32px;background:#080d14;color:#e2eaf4'><h1 style='text-align:center'><span style='color:#1a9e99'>FREEDOM </span><span style='color:#e8a820'>EXTERIORS</span></h1><h2 style='color:#e8a820'>Hi " + form.name + "!</h2><p>Your " + form.type + " job has been created. View your portal below.</p><div style='text-align:center;margin:32px 0'><a href='" + portalLink + "' style='background:#e8a820;color:#000;padding:14px 32px;border-radius:8px;font-weight:800;text-decoration:none'>View Your Job Portal</a></div><p style='color:#6b8099'>Questions? Call (651) 283-1689</p></div>";
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.REACT_APP_RESEND_KEY,
      },
      body: JSON.stringify({
        from: "Freedom Exteriors <nick@freedom-exteriors.com>",
        to: [form.email],
        subject: "Your Freedom Exteriors Job Portal is Ready",
        html: emailHtml,
      }),
    });
  }
  setShowForm(false);
};
  }
  const removeJob = id => { updateJobs(prev => prev.filter(j => j.id !== id)); setSelected(null); };

  const moveStage = (job, dir) => {
    const idx = STAGES.findIndex(s => s.id === job.stage);
    const next = STAGES[idx + dir];
    if (!next) return;
    updateJob(job.id, { stage: next.id });
  };

  const toggleFollowUp = id => updateJob(id, { followUp: !jobs.find(j => j.id === id)?.followUp });

  const toggleCheck = (jobId, checkId) => {
    const job = jobs.find(j => j.id === jobId);
    const current = job?.checklist || {};
    updateJob(jobId, { checklist: { ...current, [checkId]: !current[checkId] } });
  };

  const addPhotos = (jobId, files) => {
    const job = jobs.find(j => j.id === jobId);
    const readers = Array.from(files).map(file => new Promise(res => {
      const r = new FileReader();
      r.onload = e => res({ id: Date.now() + Math.random(), url: e.target.result, name: file.name, cat: "Damage", added: new Date().toLocaleDateString() });
      r.readAsDataURL(file);
    }));
    Promise.all(readers).then(newPhotos => {
      updateJob(jobId, { photos: [...(job?.photos || []), ...newPhotos] });
    });
  };

  const addMaterial = (jobId, item) => {
    const job = jobs.find(j => j.id === jobId);
    const existing = job?.materials?.find(m => m.id === item.id);
    if (existing) {
      updateJob(jobId, { materials: job.materials.map(m => m.id === item.id ? { ...m, qty: m.qty + 1 } : m) });
    } else {
      updateJob(jobId, { materials: [...(job?.materials || []), { ...item, qty: 1 }] });
    }
  };

  const removeMaterial = (jobId, itemId) => {
    const job = jobs.find(j => j.id === jobId);
    updateJob(jobId, { materials: job.materials.filter(m => m.id !== itemId) });
  };

  const updateMaterialQty = (jobId, itemId, qty) => {
    const job = jobs.find(j => j.id === jobId);
    if (qty <= 0) { removeMaterial(jobId, itemId); return; }
    updateJob(jobId, { materials: job.materials.map(m => m.id === itemId ? { ...m, qty } : m) });
  };

  const materialsTotal = (mats) => (mats || []).reduce((s, m) => s + m.price * m.qty, 0);

  // Commission calculation (your exact workbook formula)
  const calcCommission = (c) => {
    if (!c) return {};
    const gross = parseFloat(c.grossRevenue) || 0;
    const opAlloc = gross * 0.15;
    const netRev = gross - opAlloc;
    const costs = [c.xactimate,c.permits,c.roofMaterials,c.roofLabor,c.sidingMaterials,c.sidingLabor,c.gutterMat,c.gutterLabor,c.windows,c.chargeback,c.electrical,c.dumpster,c.materialReturn,c.insNegFee,c.hoverCost,c.other].reduce((s,v) => s + (parseFloat(v)||0), 0);
    const commNet = netRev - costs;
    const tierPct = parseFloat(c.tier) || 40;
    const commission = commNet * (tierPct / 100);
    return { opAlloc, netRev, costs, commNet, commission };
  };

  const sf = v => v === undefined ? "" : v;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:DARK, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10, fontFamily:"'Barlow Condensed',sans-serif" }}>
      <div style={{ fontWeight:800, fontSize:28, letterSpacing:4 }}><span style={{ color:TEAL }}>FREEDOM </span><span style={{ color:GOLD }}>EXTERIORS</span></div>
      <div style={{ color:TEAL, fontWeight:700, letterSpacing:3, fontSize:11 }}>LOADING YOUR JOBS…</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:DARK, color:TEXT, fontFamily:"'Barlow','Segoe UI',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&family=Barlow+Condensed:wght@700;800&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <header style={{ background:PANEL, borderBottom:`2px solid ${BORDER}`, padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", height:60 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:24, letterSpacing:4, lineHeight:1 }}>
              <span style={{ color:TEAL }}>FREEDOM </span><span style={{ color:GOLD }}>EXTERIORS</span>
            </div>
            <div style={{ fontSize:9, letterSpacing:3, color:TEAL, fontWeight:700, textTransform:"uppercase", marginTop:2 }}>Veteran Owned &amp; Operated · MN &amp; WI</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:11, color: saveStatus==="saved"?"#10b981":saveStatus==="saving"?GOLD:"#f87171", fontWeight:600 }}>
            {saveStatus==="saved"?"☁ Saved":saveStatus==="saving"?"⟳ Saving…":"⚠ Error"}
          </span>
          {followUps.length > 0 && (
            <button onClick={() => setMainView("followups")} style={{ background:"#7c2d1233", border:"1px solid #f9731688", color:"#fed7aa", borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              🔔 {followUps.length} Follow-up{followUps.length!==1?"s":""}
            </button>
          )}
          <button onClick={() => supabase.auth.signOut()} style={{ background:"none", border:`1px solid ${BORDER}`, color:MUTED, borderRadius:8, padding:"8px 14px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Sign Out</button><button onClick={openNew} style={{ background:GOLD, color:"#000", border:"none", borderRadius:8, padding:"8px 18px", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>+ NEW JOB</button>
        </div>
      </header>

      {/* NAV */}
      <nav style={{ background:PANEL2, borderBottom:`1px solid ${BORDER}`, padding:"0 20px", display:"flex", alignItems:"center", gap:2 }}>
        {[{id:"board",label:"📋 Board"},{id:"list",label:"📄 All Jobs"},{id:"followups",label:`🔔 Follow-ups (${followUps.length})`},{id:"commission",label:"💰 Commission"}].map(v => (
          <button key={v.id} onClick={() => setMainView(v.id)} style={{ background:"none", border:"none", color:mainView===v.id?GOLD:MUTED, borderBottom:mainView===v.id?`2px solid ${GOLD}`:"2px solid transparent", padding:"12px 16px", cursor:"pointer", fontSize:13, fontWeight:mainView===v.id?700:500, fontFamily:"inherit" }}>{v.label}</button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          {["all","MN","WI"].map(s => (
            <button key={s} onClick={() => setFilterState(s)} style={{ background:filterState===s?(s==="WI"?GOLD:TEAL)+"22":"none", border:`1px solid ${filterState===s?(s==="WI"?GOLD:TEAL):BORDER}`, color:filterState===s?(s==="WI"?GOLD:TEAL):MUTED, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{s==="all"?"All":s}</button>
          ))}
          <span style={{ color:BORDER }}>|</span>
          <span style={{ color:MUTED, fontSize:12 }}>{jobs.length} jobs</span>
        </div>
      </nav>

      {/* BOARD */}
      {mainView==="board" && (
        <div style={{ display:"flex", gap:8, padding:14, overflowX:"auto", alignItems:"flex-start", minHeight:"calc(100vh - 120px)" }}>
          {STAGES.map(stage => {
            const cols = filtered.filter(j => j.stage === stage.id);
            const checkPct = (job) => { const total = CHECKLIST_ITEMS.length; const done = Object.values(job.checklist||{}).filter(Boolean).length; return Math.round(done/total*100); };
            return (
              <div key={stage.id} style={{ minWidth:210, maxWidth:210, flexShrink:0, background:PANEL, borderRadius:10, border:`1px solid ${BORDER}`, overflow:"hidden" }}>
                <div style={{ padding:"9px 10px", borderBottom:`2px solid ${stage.color}44`, display:"flex", alignItems:"center", gap:6, background:PANEL2 }}>
                  <span style={{ fontSize:13 }}>{stage.icon}</span>
                  <span style={{ fontWeight:700, fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:stage.color, flex:1 }}>{stage.label}</span>
                  <span style={{ background:stage.color+"22", color:stage.color, borderRadius:10, padding:"1px 7px", fontSize:11, fontWeight:800 }}>{cols.length}</span>
                </div>
                <div style={{ padding:6, display:"flex", flexDirection:"column", gap:6 }}>
                  {cols.map(job => {
                    const pct = checkPct(job);
                    return (
                      <div key={job.id} onClick={() => { setSelected(job); setJobTab("details"); }}
                        style={{ background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:8, padding:"9px 10px", cursor:"pointer" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor=TEAL}
                        onMouseLeave={e => e.currentTarget.style.borderColor=BORDER}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:3 }}>
                          <div style={{ fontWeight:700, fontSize:13, flex:1, lineHeight:1.2 }}>{job.name}</div>
                          <button onClick={e => { e.stopPropagation(); toggleFollowUp(job.id); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, padding:0 }}>{job.followUp?"🔔":"🔕"}</button>
                        </div>
                        <div style={{ color:MUTED, fontSize:11, marginBottom:4 }}>{job.city}, <span style={{ color:job.state==="WI"?GOLD:TEAL, fontWeight:700 }}>{job.state}</span></div>
                        <span style={{ background:TEAL+"22", color:TEAL, borderRadius:3, padding:"1px 6px", fontSize:10, fontWeight:600 }}>{job.type}</span>
                        {job.estimate?.total > 0 && <div style={{ fontSize:10, color:"#10b981", marginTop:3, fontWeight:700 }}>${job.estimate.total.toLocaleString()}</div>}
                        {job.hoverId && <div style={{ fontSize:10, color:GOLD, marginTop:2 }}>📐 {job.hoverId}</div>}
                        {job.claimNum && <div style={{ fontSize:10, color:GOLD, marginTop:2, fontFamily:"monospace" }}>{job.claimNum}</div>}
                        {job.photos?.length > 0 && <div style={{ fontSize:10, color:TEAL, marginTop:2 }}>📷 {job.photos.length}</div>}
                        {/* Checklist progress bar */}
                        <div style={{ marginTop:6 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                            <span style={{ fontSize:9, color:MUTED }}>Checklist</span>
                            <span style={{ fontSize:9, color:pct===100?"#10b981":MUTED, fontWeight:700 }}>{pct}%</span>
                          </div>
                          <div style={{ background:BORDER, borderRadius:3, height:4 }}>
                            <div style={{ background:pct===100?"#10b981":TEAL, borderRadius:3, height:4, width:`${pct}%`, transition:"width 0.3s" }}/>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:4, marginTop:6 }}>
                          {(() => { const idx = STAGES.findIndex(s => s.id === job.stage); return (<>
                            <button disabled={idx===0} onClick={e => { e.stopPropagation(); moveStage(job,-1); }} style={{ flex:1, background:"none", border:`1px solid ${idx===0?DARK:BORDER}`, color:idx===0?DARK:MUTED, borderRadius:5, padding:"2px 0", cursor:idx===0?"default":"pointer", fontSize:12 }}>←</button>
                            <button disabled={idx===STAGES.length-1} onClick={e => { e.stopPropagation(); moveStage(job,1); }} style={{ flex:1, background:"none", border:`1px solid ${idx===STAGES.length-1?DARK:BORDER}`, color:idx===STAGES.length-1?DARK:MUTED, borderRadius:5, padding:"2px 0", cursor:idx===STAGES.length-1?"default":"pointer", fontSize:12 }}>→</button>
                          </>); })()}
                        </div>
                      </div>
                    );
                  })}
                  {cols.length===0 && <div style={{ color:BORDER, fontSize:11, textAlign:"center", padding:"16px 0" }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {mainView==="list" && (
        <div style={{ padding:16, maxWidth:1400, margin:"0 auto" }}>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
            {[{id:"all",label:"All",color:MUTED},...STAGES].map(s => (
              <button key={s.id} onClick={() => setFilterStage(s.id)} style={{ background:filterStage===s.id?s.color+"22":"none", border:`1px solid ${filterStage===s.id?s.color:BORDER}`, color:filterStage===s.id?s.color:MUTED, borderRadius:5, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{s.label}</button>
            ))}
          </div>
          <div style={{ background:PANEL, borderRadius:10, border:`1px solid ${BORDER}`, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:PANEL2, borderBottom:`1px solid ${BORDER}` }}>
                  {["Customer","Location","Type","Stage","$Value","Claim #","Adjuster","Checklist","📷","🔔",""].map(h => (
                    <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:10, fontWeight:700, letterSpacing:1, textTransform:"uppercase", color:MUTED }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((job, i) => {
                  const s = stageObj(job.stage);
                  const pct = Math.round(Object.values(job.checklist||{}).filter(Boolean).length / CHECKLIST_ITEMS.length * 100);
                  return (
                    <tr key={job.id} onClick={() => { setSelected(job); setJobTab("details"); }}
                      style={{ borderBottom:`1px solid ${BORDER}`, cursor:"pointer", background:i%2===0?"transparent":PANEL2+"44" }}
                      onMouseEnter={e => e.currentTarget.style.background=TEAL+"11"}
                      onMouseLeave={e => e.currentTarget.style.background=i%2===0?"transparent":PANEL2+"44"}>
                      <td style={{ padding:"10px 12px", fontWeight:700 }}>{job.name}</td>
                      <td style={{ padding:"10px 12px", color:MUTED, fontSize:12 }}>{job.city}, <span style={{ color:job.state==="WI"?GOLD:TEAL, fontWeight:800 }}>{job.state}</span></td>
                      <td style={{ padding:"10px 12px" }}><span style={{ background:TEAL+"22", color:TEAL, borderRadius:3, padding:"2px 7px", fontSize:11 }}>{job.type}</span></td>
                      <td style={{ padding:"10px 12px" }}><span style={{ background:s.color+"22", color:s.color, border:`1px solid ${s.color}44`, borderRadius:3, padding:"2px 7px", fontSize:11, fontWeight:600 }}>{s.icon} {s.label}</span></td>
                      <td style={{ padding:"10px 12px", fontWeight:700, color: job.estimate?.total>0?"#10b981":BORDER }}>{job.estimate?.total>0?`$${job.estimate.total.toLocaleString()}`:"—"}</td>
                      <td style={{ padding:"10px 12px", fontFamily:"monospace", fontSize:11, color:GOLD }}>{job.claimNum||"—"}</td>
                      <td style={{ padding:"10px 12px", fontSize:12, color:MUTED }}>{job.adjuster||"—"}</td>
                      <td style={{ padding:"10px 12px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <div style={{ background:BORDER, borderRadius:3, height:6, width:60 }}><div style={{ background:pct===100?"#10b981":TEAL, borderRadius:3, height:6, width:`${pct}%` }}/></div>
                          <span style={{ fontSize:10, color:pct===100?"#10b981":MUTED }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding:"10px 12px", fontSize:12, color:job.photos?.length?TEAL:BORDER }}>{job.photos?.length?`📷 ${job.photos.length}`:"—"}</td>
                      <td style={{ padding:"10px 12px" }}><button onClick={e => { e.stopPropagation(); toggleFollowUp(job.id); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:15 }}>{job.followUp?"🔔":"🔕"}</button></td>
                      <td style={{ padding:"10px 12px" }}><button onClick={e => { e.stopPropagation(); openEdit(job); }} style={{ background:PANEL2, border:`1px solid ${BORDER}`, color:TEXT, borderRadius:5, padding:"3px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>Edit</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length===0 && <div style={{ padding:32, textAlign:"center", color:MUTED }}>No jobs found.</div>}
          </div>
        </div>
      )}

      {/* FOLLOW-UPS */}
      {mainView==="followups" && (
        <div style={{ padding:16, maxWidth:800, margin:"0 auto" }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:24, letterSpacing:1 }}>🔔 Follow-ups Needed</div>
            <div style={{ color:MUTED, fontSize:13 }}>Tap "Clear" once you've followed up.</div>
          </div>
          {followUps.length===0 && <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:10, padding:40, textAlign:"center" }}><div style={{ fontSize:40 }}>✅</div><div style={{ fontWeight:700, fontSize:18, marginTop:8 }}>All clear!</div></div>}
          {followUps.map(job => {
            const s = stageObj(job.stage);
            return (
              <div key={job.id} onClick={() => { setSelected(job); setJobTab("details"); }} style={{ background:PANEL, border:`1px solid ${BORDER}`, borderLeft:`4px solid ${GOLD}`, borderRadius:10, padding:"14px 18px", marginBottom:8, cursor:"pointer", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:15 }}>{job.name}</div>
                  <div style={{ color:MUTED, fontSize:12, marginTop:2 }}>{job.address}, {job.city}, <span style={{ color:job.state==="WI"?GOLD:TEAL, fontWeight:700 }}>{job.state}</span> · {job.type}</div>
                  <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                    <span style={{ background:s.color+"22", color:s.color, border:`1px solid ${s.color}44`, borderRadius:3, padding:"2px 7px", fontSize:11 }}>{s.icon} {s.label}</span>
                    {job.claimNum && <span style={{ background:PANEL2, color:GOLD, borderRadius:3, padding:"2px 7px", fontSize:11, fontFamily:"monospace" }}>{job.claimNum}</span>}
                  </div>
                  {job.notes && <div style={{ color:TEXT, fontSize:12, marginTop:6, background:PANEL2, borderRadius:5, padding:"5px 8px" }}>📝 {job.notes}</div>}
                </div>
                <button onClick={e => { e.stopPropagation(); toggleFollowUp(job.id); }} style={{ background:TEAL+"22", border:`1px solid ${TEAL}`, color:TEAL, borderRadius:7, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0, fontFamily:"inherit" }}>Clear ✓</button>
              </div>
            );
          })}
        </div>
      )}

      {/* COMMISSION CALCULATOR */}
      {mainView==="commission" && (
        <div style={{ padding:16, maxWidth:900, margin:"0 auto" }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:24, letterSpacing:1, marginBottom:16 }}>💰 Commission Workbook</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {jobs.filter(j => j.estimate?.total > 0 || j.commission?.grossRevenue > 0).map(job => {
              const c = job.commission || {};
              const calc = calcCommission({ ...c, grossRevenue: c.grossRevenue || job.estimate?.total || 0 });
              return (
                <div key={job.id} style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:10, padding:16 }}>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:2 }}>{job.name}</div>
                  <div style={{ color:MUTED, fontSize:12, marginBottom:12 }}>{job.city}, {job.state} · {job.type}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                    {[
                      ["Gross Revenue","grossRevenue"],["Xactimate","xactimate"],["Permits","permits"],
                      ["Roof Materials","roofMaterials"],["Roof Labor","roofLabor"],["Siding Mat.","sidingMaterials"],
                      ["Siding Labor","sidingLabor"],["Gutter Mat/Labor","gutterMat"],["Windows","windows"],
                      ["Chargeback","chargeback"],["Electrical","electrical"],["Dumpster","dumpster"],
                      ["Mat. Return Credit","materialReturn"],["Ins. Neg. Fee","insNegFee"],["Hover Cost","hoverCost"],["Other","other"],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <label style={{ fontSize:9, color:MUTED, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:2 }}>{label}</label>
                        <input type="number" value={sf(c[key])} onChange={e => updateJob(job.id, { commission: { ...c, [key]: e.target.value } })}
                          style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:5, color:TEXT, padding:"5px 8px", fontSize:12, fontFamily:"inherit", boxSizing:"border-box" }} placeholder="0"/>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label style={{ fontSize:9, color:MUTED, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 }}>Commission Tier</label>
                    <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                      {[30,40,50].map(t => (
                        <button key={t} onClick={() => updateJob(job.id, { commission: { ...c, tier: t } })} style={{ flex:1, background:c.tier===t?GOLD+"22":"none", border:`1px solid ${c.tier===t?GOLD:BORDER}`, color:c.tier===t?GOLD:MUTED, borderRadius:5, padding:"5px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{t}%</button>
                      ))}
                    </div>
                  </div>
                  {/* Results */}
                  <div style={{ background:PANEL2, borderRadius:8, padding:12 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                      {[
                        ["Operating Alloc (15%)", calc.opAlloc],
                        ["Net Revenue", calc.netRev],
                        ["Total Costs", calc.costs],
                        ["Commissionable Net", calc.commNet],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <div style={{ fontSize:9, color:MUTED, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
                          <div style={{ fontSize:13, fontWeight:600 }}>${(val||0).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop:10, borderTop:`1px solid ${BORDER}`, paddingTop:10, textAlign:"center" }}>
                      <div style={{ fontSize:10, color:MUTED, letterSpacing:1, textTransform:"uppercase" }}>Total Commission ({c.tier||40}%)</div>
                      <div style={{ fontSize:26, fontWeight:800, color:GOLD }}>${(calc.commission||0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {jobs.filter(j => j.estimate?.total > 0 || j.commission?.grossRevenue > 0).length === 0 && (
              <div style={{ gridColumn:"1/-1", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:10, padding:40, textAlign:"center", color:MUTED }}>
                Jobs with estimates will appear here. Add an estimate to a job to get started.
              </div>
            )}
          </div>
        </div>
      )}

      {/* JOB DETAIL MODAL */}
      {selected && !showForm && (
        <Overlay onClose={() => setSelected(null)}>
          <div style={{ display:"flex", flexDirection:"column", maxHeight:"92vh" }}>
            {/* Modal Header */}
            <div style={{ padding:"20px 24px 0", flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                <div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:24, letterSpacing:1 }}>{selected.name}</div>
                  <div style={{ color:MUTED, fontSize:13 }}>{selected.address}, {selected.city}, <span style={{ color:selected.state==="WI"?GOLD:TEAL, fontWeight:700 }}>{selected.state}</span> · {selected.phone}</div>
                </div>
                {(() => { const s = stageObj(selected.stage); return <span style={{ background:s.color+"22", color:s.color, border:`1px solid ${s.color}55`, borderRadius:7, padding:"5px 12px", fontSize:13, fontWeight:700, flexShrink:0 }}>{s.icon} {s.label}</span>; })()}
              </div>
              {/* Job Sub-tabs */}
              <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${BORDER}` }}>
                {[{id:"details",label:"📋 Details"},{id:"checklist",label:"☑️ Checklist"},{id:"estimate",label:"💵 Estimate"},{id:"materials",label:"🏗️ Materials"},{id:"contracts",label:"📄 Contracts"},{id:"photos",label:"📷 Photos"}].map(t => (
                  <button key={t.id} onClick={() => setJobTab(t.id)} style={{ background:"none", border:"none", color:jobTab===t.id?GOLD:MUTED, borderBottom:jobTab===t.id?`2px solid ${GOLD}`:"2px solid transparent", padding:"8px 12px", cursor:"pointer", fontSize:12, fontWeight:jobTab===t.id?700:500, fontFamily:"inherit", marginBottom:-1 }}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div style={{ overflowY:"auto", flex:1, padding:"16px 24px 20px" }}>

              {/* DETAILS TAB */}
              {jobTab==="details" && (
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                    {[["Job Type",selected.type],["Assigned To",selected.assigned],["Insurance",selected.insurer],["Claim #",selected.claimNum||"Not filed"],["Adjuster",selected.adjuster||"—"],["Adj. Phone",selected.adjPhone||"—"],["Date Added",selected.added]].map(([l,v]) => (
                      <div key={l} style={{ background:PANEL2, borderRadius:7, padding:"9px 12px" }}>
                        <div style={{ color:MUTED, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>{l}</div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{v}</div>
                      </div>
                    ))}
                    <div style={{ background:PANEL2, borderRadius:7, padding:"9px 12px", border:selected.hoverId?`1px solid ${GOLD}44`:`1px solid ${BORDER}` }}>
                      <div style={{ color:MUTED, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>Hover Job ID</div>
                      {selected.hoverId ? <a href={`https://hover.to/jobs/${selected.hoverId}`} target="_blank" rel="noopener noreferrer" style={{ color:GOLD, fontFamily:"monospace", fontSize:13, fontWeight:700, textDecoration:"none" }}>{selected.hoverId} ↗</a> : <div style={{ color:BORDER, fontSize:12 }}>Not linked</div>}
                    </div>
                  </div>
                  {selected.notes && <div style={{ background:PANEL2, borderRadius:7, padding:"10px 12px", marginBottom:14 }}><div style={{ color:MUTED, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>Notes</div><div style={{ fontSize:13, lineHeight:1.6 }}>{selected.notes}</div></div>}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
                    <span style={{ color:MUTED, fontSize:12 }}>Move stage:</span>
                    {(() => { const idx = STAGES.findIndex(s => s.id === selected.stage); return (<>
                      <button disabled={idx===0} onClick={() => moveStage(selected,-1)} style={{ background:PANEL2, border:`1px solid ${BORDER}`, color:idx===0?BORDER:TEXT, borderRadius:7, padding:"6px 14px", cursor:idx===0?"default":"pointer", fontFamily:"inherit", fontSize:13 }}>← Back</button>
                      <button disabled={idx===STAGES.length-1} onClick={() => moveStage(selected,1)} style={{ background:PANEL2, border:`1px solid ${BORDER}`, color:idx===STAGES.length-1?BORDER:TEXT, borderRadius:7, padding:"6px 14px", cursor:idx===STAGES.length-1?"default":"pointer", fontFamily:"inherit", fontSize:13 }}>Forward →</button>
                    </>); })()}
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <button onClick={() => toggleFollowUp(selected.id)} style={{ background:selected.followUp?GOLD+"22":PANEL2, border:`1px solid ${selected.followUp?GOLD:BORDER}`, color:selected.followUp?GOLD:MUTED, borderRadius:7, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600 }}>{selected.followUp?"🔔 Unmark":"🔕 Mark Follow-up"}</button>
                    <button onClick={async () => {
  const token = selected.id + "-" + Math.random().toString(36).slice(2,8);
  const { data: row } = await supabase.from("jobs").select("id,data").eq("user_email","all").then(r => ({ data: r.data?.find(j => j.data?.id === selected.id) }));
  if (row) await supabase.from("jobs").update({ portal_token: token }).eq("id", row.id);
  const link = `${window.location.origin}/portal/${token}`;
  navigator.clipboard.writeText(link);
  alert("Portal link copied! Send it to: " + selected.name);
}} style={{ background:GOLD+"22", border:`1px solid ${GOLD}`, color:GOLD, borderRadius:7, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>🔗 Copy Portal Link</button><button onClick={() => openEdit(selected)} style={{ background:TEAL+"22", border:`1px solid ${TEAL}`, color:TEAL, borderRadius:7, padding:"7px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>Edit Job</button>
<button onClick={async () => { const token = selected.id + "-" + Math.random().toString(36).slice(2,8); const { data: rows } = await supabase.from("jobs").select("id,data").eq("user_email","all"); const row = rows?.find(j => j.data?.id === selected.id); if (row) await supabase.from("jobs").update({ portal_token: token }).eq("id", row.id); const link = `${window.location.origin}/portal/${token}`; navigator.clipboard.writeText(link); alert("Portal link copied! Send it to: " + selected.name); }} style={{ background:GOLD+"22", border:`1px solid ${GOLD}`, color:GOLD, borderRadius:7, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>🔗 Portal Link</button>
                    <button onClick={() => removeJob(selected.id)} style={{ background:"#7c2d1222", border:"1px solid #7c2d12", color:"#f87171", borderRadius:7, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, marginLeft:"auto" }}>Delete</button>
                  </div>
                </div>
              )}

              {/* CHECKLIST TAB */}
              {jobTab==="checklist" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>Job Checklist</div>
                    {(() => { const done = Object.values(selected.checklist||{}).filter(Boolean).length; const pct = Math.round(done/CHECKLIST_ITEMS.length*100); return <span style={{ color:pct===100?"#10b981":GOLD, fontWeight:700 }}>{done}/{CHECKLIST_ITEMS.length} complete ({pct}%)</span>; })()}
                  </div>
                  {/* Progress */}
                  {(() => { const pct = Math.round(Object.values(selected.checklist||{}).filter(Boolean).length/CHECKLIST_ITEMS.length*100); return <div style={{ background:BORDER, borderRadius:4, height:8, marginBottom:16 }}><div style={{ background:pct===100?"#10b981":TEAL, borderRadius:4, height:8, width:`${pct}%`, transition:"width 0.3s" }}/></div>; })()}
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {CHECKLIST_ITEMS.map(item => {
                      const checked = selected.checklist?.[item.id] || false;
                      return (
                        <div key={item.id} onClick={() => toggleCheck(selected.id, item.id)} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 12px", background:checked?TEAL+"11":PANEL2, border:`1px solid ${checked?TEAL:BORDER}`, borderRadius:7, cursor:"pointer", transition:"all 0.15s" }}>
                          <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${checked?TEAL:BORDER}`, background:checked?TEAL:"none", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                            {checked && <span style={{ color:"#fff", fontSize:11, fontWeight:800 }}>✓</span>}
                          </div>
                          <span style={{ fontSize:12, color:checked?TEXT:MUTED, lineHeight:1.5, textDecoration:checked?"line-through":"none" }}>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ESTIMATE TAB */}
              {jobTab==="estimate" && (
                <div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Job Estimate</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                    {[["Total Job Value","total"],["Down Payment","downPayment"],["Deductible","deductible"]].map(([label, key]) => (
                      <div key={key}>
                        <label style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 }}>{label}</label>
                        <input type="number" value={selected.estimate?.[key]||""} onChange={e => updateJob(selected.id, { estimate: { ...(selected.estimate||{}), [key]: parseFloat(e.target.value)||0 } })}
                          style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"8px 10px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }} placeholder="0"/>
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 }}>Install Date</label>
                      <input type="date" value={selected.installDate||""} onChange={e => updateJob(selected.id, { installDate: e.target.value })}
                        style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"8px 10px", fontSize:13, fontFamily:"inherit", boxSizing:"border-box" }}/>
                    </div>
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <label style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 }}>Scope of Work</label>
                    <textarea value={selected.estimate?.scope||""} onChange={e => updateJob(selected.id, { estimate: { ...(selected.estimate||{}), scope: e.target.value } })}
                      placeholder="Describe materials, scope, specifications..." rows={5}
                      style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"8px 10px", fontSize:13, fontFamily:"inherit", boxSizing:"border-box", resize:"vertical" }}/>
                  </div>
                  {/* Summary */}
                  {selected.estimate?.total > 0 && (
                    <div style={{ background:PANEL2, borderRadius:8, padding:14 }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, textAlign:"center" }}>
                        {[["Contract Value", `$${(selected.estimate.total||0).toLocaleString()}`, "#10b981"],["Down Payment", `$${(selected.estimate.downPayment||0).toLocaleString()}`, GOLD],["Deductible", `$${(selected.estimate.deductible||0).toLocaleString()}`, "#f87171"]].map(([l,v,c]) => (
                          <div key={l}><div style={{ fontSize:9, color:MUTED, textTransform:"uppercase", letterSpacing:1 }}>{l}</div><div style={{ fontSize:20, fontWeight:800, color:c }}>{v}</div></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MATERIALS / ABC TAB */}
              {jobTab==="materials" && (
                <div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>🏗️ ABC Supply — Material List</div>
                  <div style={{ color:MUTED, fontSize:12, marginBottom:12 }}>Build your material order. Add to job then submit through your ABC Connect account.</div>
                  {/* Category filter */}
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
                    {["All", ...new Set(ABC_CATALOG.map(i => i.cat))].map(cat => (
                      <button key={cat} onClick={() => setAbcFilter(cat)} style={{ background:abcFilter===cat?TEAL+"22":"none", border:`1px solid ${abcFilter===cat?TEAL:BORDER}`, color:abcFilter===cat?TEAL:MUTED, borderRadius:5, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{cat}</button>
                    ))}
                  </div>
                  {/* Catalog */}
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Catalog — tap to add</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                      {ABC_CATALOG.filter(i => abcFilter==="All" || i.cat===abcFilter).map(item => (
                        <div key={item.id} onClick={() => addMaterial(selected.id, item)} style={{ background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, padding:"8px 10px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                          onMouseEnter={e => e.currentTarget.style.borderColor=TEAL}
                          onMouseLeave={e => e.currentTarget.style.borderColor=BORDER}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600 }}>{item.name}</div>
                            <div style={{ fontSize:10, color:MUTED }}>{item.cat} · per {item.unit}</div>
                          </div>
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:TEAL }}>${item.price}</div>
                            <div style={{ fontSize:10, color:GOLD }}>+ Add</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Job Material List */}
                  {(selected.materials||[]).length > 0 && (
                    <div>
                      <div style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:8, paddingTop:8, borderTop:`1px solid ${BORDER}` }}>Your Order</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:12 }}>
                        {(selected.materials||[]).map(m => (
                          <div key={m.id} style={{ background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, padding:"8px 12px", display:"flex", alignItems:"center", gap:10 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:12, fontWeight:600 }}>{m.name}</div>
                              <div style={{ fontSize:10, color:MUTED }}>{m.cat} · ${m.price}/{m.unit}</div>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <button onClick={() => updateMaterialQty(selected.id, m.id, m.qty-1)} style={{ background:PANEL, border:`1px solid ${BORDER}`, color:TEXT, borderRadius:4, width:24, height:24, cursor:"pointer", fontSize:14 }}>−</button>
                              <input type="number" value={m.qty} onChange={e => updateMaterialQty(selected.id, m.id, parseInt(e.target.value)||0)}
                                style={{ width:44, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:4, color:TEXT, padding:"2px 4px", fontSize:12, textAlign:"center", fontFamily:"inherit" }}/>
                              <button onClick={() => updateMaterialQty(selected.id, m.id, m.qty+1)} style={{ background:PANEL, border:`1px solid ${BORDER}`, color:TEXT, borderRadius:4, width:24, height:24, cursor:"pointer", fontSize:14 }}>+</button>
                            </div>
                            <div style={{ fontWeight:700, fontSize:13, color:"#10b981", minWidth:70, textAlign:"right" }}>${(m.price*m.qty).toFixed(2)}</div>
                            <button onClick={() => removeMaterial(selected.id, m.id)} style={{ background:"none", border:"none", color:"#f87171", cursor:"pointer", fontSize:14 }}>✕</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ background:PANEL2, borderRadius:8, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div><div style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1 }}>Materials Total</div><div style={{ fontSize:22, fontWeight:800, color:"#10b981" }}>${materialsTotal(selected.materials).toFixed(2)}</div></div>
                        <a href="https://www.abcsupply.com/login" target="_blank" rel="noopener noreferrer" style={{ background:GOLD, color:"#000", borderRadius:8, padding:"9px 18px", fontWeight:800, fontSize:13, textDecoration:"none", display:"block" }}>Order at ABC Connect ↗</a>
                      </div>
                    </div>
                  )}
                  {(selected.materials||[]).length === 0 && <div style={{ textAlign:"center", color:MUTED, padding:"20px 0" }}>Tap items above to build your material list.</div>}
                </div>
              )}

              {/* CONTRACTS TAB */}
              {jobTab==="contracts" && (
                <div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>📄 Contract Templates</div>
                  <div style={{ color:MUTED, fontSize:12, marginBottom:14 }}>Select a template — it auto-fills with this job's information.</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
                    {Object.entries(CONTRACT_TEMPLATES).map(([key, tmpl]) => (
                      <div key={key} style={{ background:PANEL2, border:`1px solid ${selected.contract===key?tmpl.color:BORDER}`, borderRadius:8, padding:"12px 14px", cursor:"pointer" }}
                        onClick={() => { updateJob(selected.id, { contract: key }); setContractPreview({ key, text: tmpl.body(selected, selected.estimate) }); }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontSize:20 }}>{tmpl.icon}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:13, color:selected.contract===key?tmpl.color:TEXT }}>{tmpl.label}</div>
                            <div style={{ fontSize:11, color:MUTED }}>{tmpl.desc}</div>
                          </div>
                          {selected.contract===key && <span style={{ color:tmpl.color, fontSize:12, fontWeight:700 }}>✓ Active</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* MN Required Documents */}
                  <div style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:8, paddingTop:8, borderTop:`1px solid ${BORDER}` }}>MN Required Documents</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {[
                      { label:"MN Mandatory Lien Notice (§514.011)", desc:"Required on all contracts" },
                      { label:"Cancellation Notice (§326B.811)", desc:"72-hr right to cancel if claim denied" },
                      { label:"Contractor Documents Acknowledgement", desc:"Homeowner receipt of all MN statutes" },
                      { label:"Pre-Build Precaution Letter", desc:"8 items — homeowner initials required" },
                      { label:"Certificate of Insurance", desc:"Berkley Specialty · Policy ASP698081595-01 · Exp. 05/12/2027" },
                    ].map(doc => (
                      <div key={doc.label} style={{ background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, padding:"9px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600 }}>{doc.label}</div>
                          <div style={{ fontSize:10, color:MUTED }}>{doc.desc}</div>
                        </div>
                        <span style={{ fontSize:10, color:TEAL, fontWeight:700, background:TEAL+"22", borderRadius:4, padding:"2px 8px" }}>On File</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PHOTOS TAB */}
              {jobTab==="photos" && (
                <div>
                  <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, cursor:"pointer", background:PANEL2, border:`2px dashed ${BORDER}`, borderRadius:9, padding:"16px", marginBottom:12 }}
                    onMouseEnter={e => e.currentTarget.style.borderColor=TEAL}
                    onMouseLeave={e => e.currentTarget.style.borderColor=BORDER}>
                    <input type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e => addPhotos(selected.id, e.target.files)}/>
                    <span style={{ fontSize:22 }}>📷</span>
                    <div><div style={{ fontWeight:700, fontSize:13 }}>Upload Area Photos</div><div style={{ color:MUTED, fontSize:11 }}>Damage · Before · After · Adjuster Visit · Misc</div></div>
                  </label>
                  {(selected.photos||[]).length === 0 && <div style={{ textAlign:"center", color:MUTED, padding:"20px 0" }}>No photos yet.</div>}
                  {PHOTO_CATS.filter(cat => (selected.photos||[]).some(p => p.cat===cat)).map(cat => (
                    <div key={cat} style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11, color:GOLD, fontWeight:700, marginBottom:6 }}>{cat}</div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                        {(selected.photos||[]).filter(p => p.cat===cat).map(ph => (
                          <div key={ph.id} style={{ position:"relative", borderRadius:6, overflow:"hidden", border:`1px solid ${BORDER}` }}>
                            <img src={ph.url} alt={ph.name} onClick={() => setLightbox(ph)} style={{ width:"100%", height:70, objectFit:"cover", display:"block", cursor:"pointer" }}/>
                            <select value={ph.cat} onChange={e => updateJob(selected.id, { photos: selected.photos.map(p => p.id===ph.id?{...p,cat:e.target.value}:p) })}
                              style={{ position:"absolute", bottom:0, left:0, right:0, background:DARK+"dd", border:"none", color:GOLD, fontSize:9, fontWeight:700, fontFamily:"inherit", cursor:"pointer", outline:"none", padding:"2px 4px" }}>
                              {PHOTO_CATS.map(c => <option key={c} value={c} style={{ background:PANEL2 }}>{c}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Overlay>
      )}

      {/* ADD / EDIT JOB FORM */}
      {showForm && (
        <Overlay onClose={() => setShowForm(false)}>
          <div style={{ padding:22, overflowY:"auto", maxHeight:"90vh" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, letterSpacing:1, marginBottom:16, color:GOLD }}>{editing?"✏️ Edit Job":"📥 New Job"}</div>
            <Sec title="Customer Info">
              <G2>
                <F label="Full Name *" value={form.name} onChange={v => setForm(p=>({...p,name:v}))}/>
                <F label="Phone" value={form.phone} onChange={v => setForm(p=>({...p,phone:v}))}/>
                <F label="Email" value={form.email||""} onChange={v => setForm(p=>({...p,email:v}))}/>
                <F label="Street Address" value={form.address} onChange={v => setForm(p=>({...p,address:v}))}/>
                <F label="City" value={form.city} onChange={v => setForm(p=>({...p,city:v}))}/>
                <Sel label="State" value={form.state} onChange={v => setForm(p=>({...p,state:v}))} options={STATES}/>
                <Sel label="Job Type" value={form.type} onChange={v => setForm(p=>({...p,type:v}))} options={JOB_TYPES}/>
                <Sel label="Stage" value={form.stage} onChange={v => setForm(p=>({...p,stage:v}))} options={STAGES.map(s=>({value:s.id,label:s.label}))}/>
              </G2>
            </Sec>
            <Sec title="Insurance">
              <G2>
                <Sel label="Insurance Company" value={form.insurer} onChange={v => setForm(p=>({...p,insurer:v}))} options={INSURERS}/>
                <F label="Claim Number" value={form.claimNum} onChange={v => setForm(p=>({...p,claimNum:v}))} placeholder="CLM-2026-XXXX"/>
                <F label="Adjuster Name" value={form.adjuster} onChange={v => setForm(p=>({...p,adjuster:v}))}/>
                <F label="Adjuster Phone" value={form.adjPhone} onChange={v => setForm(p=>({...p,adjPhone:v}))}/>
              </G2>
            </Sec>
            <Sec title="Hover & Assignment">
              <G2>
                <F label="Hover Job ID" value={form.hoverId} onChange={v => setForm(p=>({...p,hoverId:v}))} placeholder="e.g. 1234567"/>
              <Sel label="Assigned To" value={form.assigned} onChange={v => setForm(p=>({...p,assigned:v}))} options={USERS}/>
              </G2>
              {form.hoverId && <a href={`https://hover.to/jobs/${form.hoverId}`} target="_blank" rel="noopener noreferrer" style={{ color:GOLD, fontSize:12, fontWeight:700, textDecoration:"none" }}>Open in Hover ↗</a>}
            </Sec>
            <Sec title="Notes">
              <textarea value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} placeholder="Supplement details, material specs, special instructions..." rows={3}
                style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"8px 10px", fontSize:13, fontFamily:"inherit", boxSizing:"border-box", resize:"vertical" }}/>
            </Sec>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:20, fontSize:13 }}>
              <input type="checkbox" checked={form.followUp} onChange={e => setForm(p=>({...p,followUp:e.target.checked}))} style={{ width:15, height:15, accentColor:GOLD }}/>
              <span>🔔 Flag for follow-up</span>
            </label>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ background:"none", border:`1px solid ${BORDER}`, color:MUTED, borderRadius:7, padding:"9px 18px", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>Cancel</button>
              <button onClick={saveJob} style={{ background:GOLD, color:"#000", border:"none", borderRadius:7, padding:"9px 22px", fontWeight:800, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>{editing?"Save Changes":"Add Job"}</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* CONTRACT PREVIEW */}
      {contractPreview && (
        <Overlay onClose={() => setContractPreview(null)} wide>
          <div style={{ padding:22, overflowY:"auto", maxHeight:"90vh" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18, color:GOLD }}>
                {CONTRACT_TEMPLATES[contractPreview.key]?.label}
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(contractPreview.text); }} style={{ background:TEAL+"22", border:`1px solid ${TEAL}`, color:TEAL, borderRadius:7, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"inherit" }}>Copy Text</button>
            </div>
            <pre style={{ background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:8, padding:16, fontSize:11, lineHeight:1.7, color:TEXT, whiteSpace:"pre-wrap", fontFamily:"'Courier New',monospace", overflowX:"auto" }}>
              {contractPreview.text}
            </pre>
            <div style={{ marginTop:12, color:MUTED, fontSize:11 }}>💡 Copy this text into your document software, or export as PDF. E-signature integrations (DocuSign, PandaDoc) coming in next update.</div>
          </div>
        </Overlay>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:"fixed", inset:0, background:"#000000ee", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ position:"relative", maxWidth:"90vw", maxHeight:"90vh" }}>
            <img src={lightbox.url} alt={lightbox.name} style={{ maxWidth:"100%", maxHeight:"85vh", borderRadius:10, display:"block", boxShadow:"0 30px 80px #000" }}/>
            <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"#000000bb", borderRadius:"0 0 10px 10px", padding:"6px 12px", display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:GOLD, fontWeight:700, fontSize:12 }}>{lightbox.cat}</span>
              <span style={{ color:MUTED, fontSize:11 }}>{lightbox.name}</span>
            </div>
            <button onClick={() => setLightbox(null)} style={{ position:"absolute", top:-10, right:-10, background:PANEL, border:`1px solid ${BORDER}`, color:TEXT, borderRadius:"50%", width:28, height:28, cursor:"pointer", fontSize:14 }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overlay ────────────────────────────────────────────────────────
function Overlay({ children, onClose, wide }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"#000000cc", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, width:"100%", maxWidth:wide?780:640, position:"relative", boxShadow:"0 25px 60px #000b" }}>
        <button onClick={onClose} style={{ position:"absolute", top:12, right:12, background:PANEL2, border:`1px solid ${BORDER}`, color:MUTED, borderRadius:5, width:26, height:26, cursor:"pointer", fontSize:13, zIndex:1 }}>✕</button>
        {children}
      </div>
    </div>
  );
}

// ── Form helpers ───────────────────────────────────────────────────
function Sec({ title, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:TEAL, marginBottom:8, paddingBottom:5, borderBottom:`1px solid ${BORDER}` }}>{title}</div>
      {children}
    </div>
  );
}
function G2({ children }) { return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>{children}</div>; }
function F({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ display:"block", fontSize:9, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</label>
      <input value={value||""} onChange={e => onChange(e.target.value)} placeholder={placeholder||""}
        style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"8px 10px", fontSize:13, fontFamily:"inherit", boxSizing:"border-box", outline:"none" }}/>
    </div>
  );
}
function Sel({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ display:"block", fontSize:9, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</label>
      <select value={value||""} onChange={e => onChange(e.target.value)}
        style={{ width:"100%", background:PANEL2, border:`1px solid ${BORDER}`, borderRadius:7, color:TEXT, padding:"8px 10px", fontSize:13, fontFamily:"inherit", boxSizing:"border-box", outline:"none" }}>
        {options.map(o => typeof o==="string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}