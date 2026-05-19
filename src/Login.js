import { useState } from "react";
import { supabase } from "./supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080d14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow','Segoe UI',sans-serif" }}>
      <div style={{ background:"#0f1923", border:"1px solid #1e3048", borderRadius:16, padding:40, width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontFamily:"'Barlow Condensed','Segoe UI',sans-serif", fontWeight:800, fontSize:28, letterSpacing:4, lineHeight:1 }}>
            <span style={{ color:"#1a9e99" }}>FREEDOM </span>
            <span style={{ color:"#e8a820" }}>EXTERIORS</span>
          </div>
          <div style={{ fontSize:10, letterSpacing:3, color:"#1a9e99", fontWeight:700, textTransform:"uppercase", marginTop:6 }}>
            Veteran Owned &amp; Operated
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6b8099", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width:"100%", background:"#162030", border:"1px solid #1e3048", borderRadius:8, color:"#e2eaf4", padding:"10px 12px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }}
              placeholder="your@email.com"
            />
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6b8099", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width:"100%", background:"#162030", border:"1px solid #1e3048", borderRadius:8, color:"#e2eaf4", padding:"10px 12px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{ background:"#7c2d1222", border:"1px solid #7c2d12", borderRadius:8, padding:"10px 14px", color:"#f87171", fontSize:13, marginBottom:16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width:"100%", background:"#e8a820", color:"#000", border:"none", borderRadius:8, padding:"12px", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5 }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}