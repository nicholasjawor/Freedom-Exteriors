import { useState } from "react";
import { supabase } from "./supabase";

// Shown after someone follows a password-reset email link. Supabase signs them
// in from the link (PASSWORD_RECOVERY); this screen sets the new password.
export default function SetPassword({ session, linkError, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  };

  const input = { width:"100%", background:"#162030", border:"1px solid #1e3048", borderRadius:8, color:"#e2eaf4", padding:"10px 12px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box" };
  const label = { display:"block", fontSize:11, fontWeight:700, color:"#6b8099", textTransform:"uppercase", letterSpacing:1, marginBottom:6 };
  const primary = { width:"100%", background:"#e8a820", color:"#000", border:"none", borderRadius:8, padding:"12px", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" };

  let body;
  if (linkError) {
    body = (<>
      <div style={{ color:"#f87171", fontSize:14, lineHeight:1.5, marginBottom:16 }}>This reset link is invalid or has expired. Links work once and expire after a while — request a new one from the sign-in page.</div>
      <button onClick={onDone} style={primary}>Back to sign in</button>
    </>);
  } else if (!session) {
    body = <div style={{ color:"#6b8099", fontSize:14 }}>Checking your reset link…</div>;
  } else if (done) {
    body = (<>
      <div style={{ color:"#10b981", fontWeight:700, fontSize:15, marginBottom:16 }}>✓ Password updated. You're signed in.</div>
      <button onClick={onDone} style={primary}>Continue to the CRM</button>
    </>);
  } else {
    body = (
      <form onSubmit={submit}>
        <div style={{ color:"#e2eaf4", fontWeight:700, fontSize:15, marginBottom:4 }}>Set a new password</div>
        <div style={{ color:"#6b8099", fontSize:13, marginBottom:16 }}>for {session.user?.email}</div>
        <div style={{ marginBottom:14 }}>
          <label style={label}>New password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" placeholder="At least 8 characters" style={input} />
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={label}>Confirm new password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" style={input} />
        </div>
        {error && <div style={{ background:"#7c2d1222", border:"1px solid #7c2d12", borderRadius:8, padding:"10px 14px", color:"#f87171", fontSize:13, marginBottom:16 }}>{error}</div>}
        <button type="submit" disabled={saving} style={primary}>{saving ? "Saving…" : "Save new password"}</button>
      </form>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#080d14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow','Segoe UI',sans-serif", padding:16 }}>
      <div style={{ background:"#0f1923", border:"1px solid #1e3048", borderRadius:16, padding:40, width:"100%", maxWidth:400, boxSizing:"border-box" }}>
        <div style={{ textAlign:"center", marginBottom:28, fontFamily:"'Barlow Condensed','Segoe UI',sans-serif", fontWeight:800, fontSize:28, letterSpacing:4 }}>
          <span style={{ color:"#1a9e99" }}>FREEDOM </span><span style={{ color:"#e8a820" }}>EXTERIORS</span>
        </div>
        {body}
      </div>
    </div>
  );
}
