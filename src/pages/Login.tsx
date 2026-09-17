// src/pages/Login.tsx — Redesign v3: fixed layout collision bug from v2.
// Floating stat cards now live in a dedicated top-right zone that never
// overlaps the headline, instead of fixed-pixel positions that assumed
// a viewport height the actual screen didn't have.

import { useState } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Mail, Lock, TrendingUp, CheckCircle, Zap, Sparkles, ShieldCheck } from "lucide-react";
import logo from "../../public/logo.png";

const StatCard = ({
  label, value, icon: Icon, gradient,
}: {
  label: string; value: string; icon: any; gradient: string;
}) => (
  <div
    className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 select-none glass-card animate-float shrink-0"
  >
    <div
      className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
      style={{ background: gradient }}
    >
      <Icon className="h-3.5 w-3.5 text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-white font-bold text-[15px] leading-none whitespace-nowrap">{value}</p>
      <p className="text-white/50 text-[10px] mt-0.5 whitespace-nowrap">{label}</p>
    </div>
  </div>
);

const Login = () => {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusField, setFocusField] = useState<"email"|"password"|null>(null);

  const { login }  = useUser();
  const navigate   = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/company-selection");
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative">

      {/* ═══════════════════════════════════════
          MOBILE banner — compact version of the left panel's gradient +
          stats, since hiding it entirely below lg left small screens
          looking like a bare, empty form with no branding at all.
          ═══════════════════════════════════════ */}
      <div
        className="lg:hidden relative overflow-hidden px-5 pt-9 pb-16"
        style={{ background: "linear-gradient(135deg, #1a0530 0%, #4a0f7a 50%, #6e1feb 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(131,56,255,0.4) 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(208,33,154,0.3) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10">
          <div className="bg-white rounded-lg px-3 py-2 inline-flex items-center shadow-lg mb-5">
            <img src={logo} alt="StockCheck360" className="h-6 w-auto object-contain" />
          </div>

          <h1 className="text-[24px] font-bold leading-tight text-white mb-4">
            Inventory audits,{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #E9D5FF, #F0ABFC)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              reimagined.
            </span>
          </h1>

          <div className="flex gap-2">
            <div className="flex-1 rounded-xl px-3 py-2.5 glass-card">
              <p className="text-white font-bold text-[15px] leading-none">2,847</p>
              <p className="text-white/50 text-[10px] mt-1">Reconciled today</p>
            </div>
            <div className="flex-1 rounded-xl px-3 py-2.5 glass-card">
              <p className="text-white font-bold text-[15px] leading-none">97.3%</p>
              <p className="text-white/50 text-[10px] mt-1">Match rate</p>
            </div>
          </div>

          <p className="text-violet-100/60 text-[12px] leading-relaxed mt-5 max-w-[280px]">
            Real-time reconciliation and AI-generated reports, built for
            serious audit teams.
          </p>
        </div>

        {/* Curved wave — replaces a flat horizontal cut with a soft dip
            into the white section below, echoing the diagonal seam blend
            used on desktop but shaped for a horizontal boundary instead. */}
        <svg
          className="absolute bottom-0 left-0 w-full"
          style={{ height: 28, transform: "translateY(1px)" }}
          viewBox="0 0 400 28"
          preserveAspectRatio="none"
        >
          <path d="M0,0 C100,28 300,28 400,0 L400,28 L0,28 Z" fill="#F7F7FB" />
        </svg>
      </div>

      {/* ═══════════════════════════════════════
          LEFT — Gradient panel. Natural top-to-bottom
          flow (no justify-between) so every element's
          position is predictable — that's what caused
          the card/text collision last time.
          ═══════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-[520px] xl:w-[580px] shrink-0 relative overflow-hidden flex-col p-10 xl:p-12"
        style={{
          background: "linear-gradient(160deg, #1a0530 0%, #2d0a52 25%, #4a0f7a 50%, #6e1feb 75%, #3d0f6e 100%)",
          clipPath: "polygon(0 0, 100% 0, 91% 100%, 0 100%)",
        }}
      >
        {/* Background orbs — decorative only, z-0 */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div
            className="absolute -top-24 -right-20 w-[420px] h-[420px] rounded-full animate-float"
            style={{ background: "radial-gradient(circle, rgba(131,56,255,0.35) 0%, transparent 70%)" }}
          />
          <div
            className="absolute bottom-10 -left-24 w-[320px] h-[320px] rounded-full animate-float"
            style={{ background: "radial-gradient(circle, rgba(208,33,154,0.3) 0%, transparent 70%)", animationDelay: "2.5s" }}
          />
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        {/* ── Logo ── */}
        <div className="relative z-10 shrink-0">
          <div className="bg-white rounded-xl px-4 py-3 inline-flex items-center shadow-[0_8px_32px_rgba(131,56,255,0.4)]">
            <img src={logo} alt="StockCheck360" className="h-7 w-auto object-contain" />
          </div>
        </div>

        {/* ── Stat card row — fixed height zone, own row, never collides
             with anything below since it's a normal flow element now,
             not an absolutely-positioned float ── */}
        <div className="relative z-10 flex gap-2.5 mt-8 mb-8 flex-wrap">
          <StatCard label="Reconciled today" value="2,847" icon={CheckCircle} gradient="linear-gradient(135deg, #10B981, #059669)" />
          <StatCard label="Match rate" value="97.3%" icon={TrendingUp} gradient="linear-gradient(135deg, #8338FF, #6E1FEB)" />
          <StatCard label="Sync speed" value="< 2s" icon={Zap} gradient="linear-gradient(135deg, #F59E0B, #D97706)" />
        </div>

        {/* ── Hero — normal flow, guaranteed clear of the cards above ── */}
        <div className="relative z-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[11px] font-semibold text-violet-100"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
          >
            <Sparkles className="h-3 w-3" />
            Trusted by audit teams across India
          </div>

          <h1 className="text-[38px] xl:text-[42px] font-bold leading-[1.1] tracking-tight text-white mb-4" style={{ textShadow: "0 2px 30px rgba(0,0,0,0.4)" }}>
            Inventory audits,
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #E9D5FF, #C4B5FD, #F0ABFC)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              reimagined.
            </span>
          </h1>

          <p className="text-violet-100/70 text-[14px] xl:text-[15px] leading-relaxed max-w-[380px]">
            Real-time scan reconciliation, AI-generated reports, offline
            scanning, and role-based access — built for serious audit teams.
          </p>
        </div>

        {/* ── Footer — pushed to bottom via mt-auto, doesn't affect
             anything above it ── */}
        <p className="relative z-10 text-violet-300/40 text-[11px] mt-auto pt-8">
          © {new Date().getFullYear()} StockCheck360 · All rights reserved
        </p>
      </div>

      {/* ── Seam blend ── a soft blurred glow straddling the diagonal
          boundary, so violet visibly bleeds onto the white side instead
          of the two panels just butting against a hard line. Positioned
          on the parent (which is now `relative`), independent of either
          panel's own overflow-hidden, so it's never clipped. ── */}
      <div
        className="hidden lg:block absolute top-0 bottom-0 z-20 pointer-events-none left-[520px] xl:left-[580px] w-[280px] -translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse 140px 100% at center, rgba(131,56,255,0.55) 0%, rgba(208,33,154,0.25) 45%, transparent 75%)",
          filter: "blur(50px)",
          mixBlendMode: "screen",
        }}
      />

      {/* ═══════════════════════════════════════
          RIGHT — Login form
          ═══════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center lg:min-h-screen px-6 py-10 lg:py-12 bg-space-50 relative overflow-hidden">
        {/* Two ambient glows instead of one, breaks up the flatness */}
        <div
          className="absolute top-0 right-0 w-[420px] h-[420px] opacity-[0.07] pointer-events-none"
          style={{ background: "radial-gradient(circle, #8338FF 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[360px] h-[360px] opacity-[0.06] pointer-events-none"
          style={{ background: "radial-gradient(circle, #D0219A 0%, transparent 70%)" }}
        />

        <div className="w-full max-w-[400px] relative z-10">

          {/* Small badge above the heading — fills the empty space, adds
              a touch of the left panel's energy onto this side too */}
          <div
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4 text-[11px] font-semibold"
            style={{ background: "rgba(131,56,255,0.08)", color: "#6E1FEB", border: "1px solid rgba(131,56,255,0.15)" }}
          >
            <ShieldCheck className="h-3 w-3" />
            Secure sign-in
          </div>

          <div className="mb-8">
            <h2 className="text-[28px] font-bold text-space-900 tracking-tight leading-tight">
              Welcome back
            </h2>
            <p className="text-space-500 text-sm mt-2">
              Sign in to your account to continue
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl mb-6 bg-red-50 border border-red-200">
              <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-[13px] text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div
            className="rounded-2xl p-6 bg-white border border-space-200"
            style={{ boxShadow: "0 8px 32px rgba(110,31,235,0.1), 0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-space-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors z-10"
                    style={{ color: focusField === "email" ? "#8338FF" : "#7B7B9E" }}
                  />
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusField("email")}
                    onBlur={() => setFocusField(null)}
                    required
                    className="h-11 pl-10 rounded-xl text-sm text-space-900 placeholder:text-space-400 transition-all duration-200 bg-white"
                    style={{
                      border: focusField === "email" ? "1.5px solid #8338FF" : "1.5px solid #D8D8E6",
                      boxShadow: focusField === "email" ? "0 0 0 4px rgba(131,56,255,0.12)" : "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-space-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors z-10"
                    style={{ color: focusField === "password" ? "#8338FF" : "#7B7B9E" }}
                  />
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusField("password")}
                    onBlur={() => setFocusField(null)}
                    required
                    className="h-11 pl-10 rounded-xl text-sm text-space-900 placeholder:text-space-400 transition-all duration-200 bg-white"
                    style={{
                      border: focusField === "password" ? "1.5px solid #8338FF" : "1.5px solid #D8D8E6",
                      boxShadow: focusField === "password" ? "0 0 0 4px rgba(131,56,255,0.12)" : "none",
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl text-[14px] font-semibold text-white transition-all duration-200
                           flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed
                           hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, #8338FF 0%, #6E1FEB 60%, #D0219A 100%)",
                  boxShadow: "0 4px 20px rgba(131,56,255,0.4)",
                }}
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
                ) : (
                  "Sign in to StockCheck360"
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-[12px] text-space-400">
            Forgot your credentials?{" "}
            <span className="font-semibold cursor-pointer hover:underline" style={{ color: "#6E1FEB" }}>
              Contact your administrator
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;