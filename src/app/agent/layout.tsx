import type { ReactNode } from "react";

/** Critical auth UI styles inlined so /agent is usable if static CSS is mis-routed (still fix Kong for JS bundles). */
const AGENT_AUTH_CRITICAL_CSS = `
.agent-auth-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;color:#fff;background:linear-gradient(135deg,#431407 0%,#7c2d12 45%,#1c1917 100%)}
.agent-auth-card{width:100%;max-width:28rem;border-radius:1rem;padding:2rem;color:#fff;background:rgba(255,255,255,.1);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 25px 50px -12px rgba(0,0,0,.45)}
.agent-auth-card--wide{max-width:42rem}
.agent-auth-subtitle{font-size:.875rem;color:#fed7aa}
.agent-auth-label{display:block;font-size:.75rem;font-weight:500;color:#fed7aa;margin-bottom:.25rem}
.agent-auth-input{width:100%;border-radius:.5rem;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);padding:.5rem .75rem;font-size:.875rem;color:#fff}
.agent-auth-input::placeholder{color:rgba(255,255,255,.4)}
.agent-auth-input:focus{outline:none;box-shadow:0 0 0 2px #fc6603}
.agent-auth-btn{width:100%;border-radius:.5rem;padding:.625rem 0;font-weight:600;color:#fff;background:#fc6603;border:none;cursor:pointer}
.agent-auth-btn:hover:not(:disabled){background:#e55a03}
.agent-auth-btn:disabled{opacity:.6}
`;

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: AGENT_AUTH_CRITICAL_CSS }} />
      {children}
    </>
  );
}
