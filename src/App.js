import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import Pipeline from "./Pipeline";
import Portal from "./Portal";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if this is a portal link e.g. /portal/abc123
  const path = window.location.pathname;
  const portalMatch = path.match(/^\/portal\/(.+)$/);
  if (portalMatch) {
    return <Portal token={portalMatch[1]} />;
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#080d14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow Condensed','Segoe UI',sans-serif" }}>
      <div style={{ fontWeight:800, fontSize:28, letterSpacing:4 }}>
        <span style={{ color:"#1a9e99" }}>FREEDOM </span>
        <span style={{ color:"#e8a820" }}>EXTERIORS</span>
      </div>
    </div>
  );

  return session ? <Pipeline session={session} /> : <Login />;
}