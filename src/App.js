import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import Pipeline from "./Pipeline";
import Portal from "./portal";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qbToken, setQbToken] = useState(null);
  const [qbRealm, setQbRealm] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Check for QuickBooks callback params
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const realm = params.get("realm");
    if (token && realm) {
      setQbToken(token);
      setQbRealm(realm);
      localStorage.setItem("qb_token", token);
      localStorage.setItem("qb_realm", realm);
      window.history.replaceState({}, "", "/");
    } else {
      const savedToken = localStorage.getItem("qb_token");
      const savedRealm = localStorage.getItem("qb_realm");
      if (savedToken && savedRealm) {
        setQbToken(savedToken);
        setQbRealm(savedRealm);
      }
    }

    return () => subscription.unsubscribe();
  }, []);

  const path = window.location.pathname;
  const portalMatch = path.match(/^\/portal\/(.+)$/);
  if (portalMatch) return <Portal token={portalMatch[1]} />;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#080d14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow Condensed','Segoe UI',sans-serif" }}>
      <div style={{ fontWeight:800, fontSize:28, letterSpacing:4 }}>
        <span style={{ color:"#1a9e99" }}>FREEDOM </span>
        <span style={{ color:"#e8a820" }}>EXTERIORS</span>
      </div>
    </div>
  );

  return session ? <Pipeline session={session} qbToken={qbToken} qbRealm={qbRealm} /> : <Login />;
}