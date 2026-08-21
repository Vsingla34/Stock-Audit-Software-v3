// src/pages/Login.tsx
import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import logo from "../../public/logo.png";

const Login = () => {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted]   = useState(false);

  const { login }  = useUser();
  const navigate   = useNavigate();

  // Trigger entrance animations on load
  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4">
      
      {/* ── Custom Animation Styles ── */}
      <style>
        {`
          @keyframes slowPan {
            0% { transform: scale(1) translate(0px, 0px); }
            50% { transform: scale(1.05) translate(-15px, -15px); }
            100% { transform: scale(1) translate(0px, 0px); }
          }
          .bg-animated {
            animation: slowPan 30s ease-in-out infinite;
          }
          @keyframes shine {
            100% { left: 125%; }
          }
          .btn-shine::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 50%;
            height: 100%;
            background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
            transform: skewX(-25deg);
            transition: all 0.75s ease;
          }
          .btn-shine:hover::after {
            animation: shine 1s ease;
          }
        `}
      </style>

      {/* ── Animated Background Image ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-[-5%] w-[110%] h-[110%] bg-cover bg-center bg-no-repeat bg-animated"
          style={{ 
            backgroundImage: 'url("https://images.unsplash.com/photo-1586528116311-ad8c73d2562c?q=80&w=2070&auto=format&fit=crop")',
          }}
        />
        {/* Dark overlay to make the stark white card pop with high contrast */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" />
      </div>

      {/* ── Centered Solid White Login Card ── */}
      <div 
        className={`relative z-10 w-full max-w-[440px] bg-white p-8 sm:p-12 rounded-[24px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] transition-all duration-1000 ease-out transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
      >
        
        {/* Logo - Removed the grey box and added mix-blend-multiply */}
        <div className="flex justify-center mb-8">
          <img 
            src={logo} 
            alt="StockCheck360" 
            className="h-11 w-auto object-contain mix-blend-multiply" 
          />
        </div>

        {/* Heading */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Welcome back
          </h2>
          <p className="text-slate-500 text-[14px] font-medium mt-2">
            Enter your credentials to access the portal
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl mb-6 bg-rose-50 border border-rose-200 text-rose-600 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-[13px] font-semibold">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Email Input Group */}
          <div className="group">
            <Label 
              htmlFor="email" 
              className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2 block transition-colors group-focus-within:text-blue-600"
            >
              Email address
            </Label>
            <div className="relative transition-transform duration-300 group-focus-within:-translate-y-1">
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl border-slate-200 bg-slate-50 text-slate-900 text-[14px] font-medium placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10 focus-visible:border-blue-500 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Password Input Group */}
          <div className="group">
            <div className="flex items-center justify-between mb-2">
              <Label 
                htmlFor="password" 
                className="text-[11px] font-bold uppercase tracking-widest text-slate-500 transition-colors group-focus-within:text-blue-600"
              >
                Password
              </Label>
            </div>
            <div className="relative transition-transform duration-300 group-focus-within:-translate-y-1">
              <Input
                id="password"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl border-slate-200 bg-slate-50 text-slate-900 text-[14px] font-medium placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10 focus-visible:border-blue-500 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Animated Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="btn-shine relative overflow-hidden w-full h-12 mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-bold tracking-wide shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] transition-all active:scale-[0.98]"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Signing in…</>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="mt-10 text-center text-[12px] font-medium text-slate-400">
          © {new Date().getFullYear()} StockCheck360.
        </p>

      </div>
    </div>
  );
};

export default Login;