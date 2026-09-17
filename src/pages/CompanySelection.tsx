// src/pages/CompanySelection.tsx — Redesign v3: proper workspace-picker UX
// Card grid instead of a flat list (scales much better once you have many
// companies), live search, friendlier copy, and deterministic per-card
// color variety so the grid doesn't look monotonous.

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  PlusCircle,
  Briefcase,
  LogOut,
  Settings,
  Building2,
  Search,
  SearchX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext"; 
import { CompanyForm } from "@/components/company/CompanyForm"; 
import logo from "../../public/logo.png";

interface Company {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
}

// Muted, professional palette — soft tinted background + a matching
// darker icon/text color, instead of a saturated full-color gradient
// fill. Reads as "enterprise software," not "playful consumer app."
// Deterministic per company name, same logic as before, just calmer.
const AVATAR_PALETTE = [
  { bg: "#F5F1FF", text: "#6E1FEB", ring: "#E3D6FF" },  // violet
  { bg: "#EEF6FF", text: "#1D6FE0", ring: "#CFE6FF" },  // blue
  { bg: "#FDF3E8", text: "#B4650F", ring: "#F5DEC0" },  // amber
  { bg: "#ECFAF3", text: "#0F8F5C", ring: "#C9F0DE" },  // emerald
  { bg: "#FCF0F8", text: "#B01D89", ring: "#F4D3EA" },  // magenta
  { bg: "#F0F2FE", text: "#4338CA", ring: "#DADEFB" },  // indigo
];

function paletteFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

const CompanySelection = () => {
  const navigate = useNavigate();
  const { setSelectedCompanyId } = useCompany();
  const { logout, currentUser } = useUser(); 

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [query, setQuery] = useState("");

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role, assigned_companies")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      setUserRole(profile.role);

      let companiesQuery = supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (profile.role !== "super_admin") {
        if (!profile.assigned_companies || profile.assigned_companies.length === 0) {
           setCompanies([]);
           setLoading(false);
           return;
        }
        companiesQuery = companiesQuery.in("id", profile.assigned_companies);
      }

      const { data: companiesData, error: companiesError } =
        await companiesQuery;
      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

    } catch (error: any) {
      console.error("Error loading company selection data:", error);
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompanyId(companyId);
    try {
      localStorage.setItem("selectedCompanyId", companyId);
      sessionStorage.setItem("selectedCompanyId", companyId);
    } catch {
      // Ignore storage errors
    }
    navigate("/assignment-selection");
  };

  const handleCompanyCreated = () => {
    setIsAddDialogOpen(false); 
    fetchInitialData(); 
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isSuperAdmin = userRole === "super_admin";

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q)
    );
  }, [companies, query]);

  // ── Empty State for Non-Admins ──────────────────────────────────────────────
  if (!loading && companies.length === 0 && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-space-50 flex flex-col items-center">
        <div className="w-full px-6 py-4 flex justify-between items-center bg-white border-b border-space-200">
          <div className="flex items-center gap-3">
            <img src={logo} alt="StockCheck360" className="h-6 w-auto object-contain mix-blend-multiply" />
            <span className="text-[14px] font-bold text-space-900 tracking-tight">StockCheck360</span>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-space-500 hover:text-rose-600 hover:bg-rose-50 text-[12px] font-bold uppercase tracking-widest transition-all h-8 px-3">
            <LogOut className="h-3.5 w-3.5 mr-2" /> Log out
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 w-full">
          <Card className="max-w-md w-full border border-space-200 shadow-xl bg-white rounded-2xl p-4">
            <CardHeader>
              <div className="flex justify-center mb-5">
                <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl">
                  <Briefcase className="h-8 w-8 text-violet-400" />
                </div>
              </div>
              <CardTitle className="text-center text-2xl font-black text-space-900 tracking-tight">
                No workspaces yet
              </CardTitle>
              <CardDescription className="text-center mt-3 text-[14px] font-medium text-space-500 leading-relaxed">
                You haven't been added to any company yet. Ask your admin to
                grant you access, and it'll show up here automatically.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  // ── Main Grid Layout UI ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-space-50 flex flex-col items-center">

      {/* ── Top Navigation Bar ── */}
      <div className="w-full px-4 md:px-8 py-4 flex justify-between items-center bg-white border-b border-space-200 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="StockCheck360" className="h-6 w-auto object-contain mix-blend-multiply" />
          <div className="h-4 w-px bg-space-200 hidden sm:block" />
          <span className="text-[12px] font-bold text-space-500 uppercase tracking-widest hidden sm:block">Portal</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 mr-2">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shadow-glow-sm"
              style={{ background: "linear-gradient(135deg, #8338FF, #D0219A)" }}
            >
              <span className="text-white font-bold text-[12px]">{currentUser?.name?.charAt(0) || "U"}</span>
            </div>
            <span className="text-[13px] font-bold text-space-700">{currentUser?.name}</span>
          </div>

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-space-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg h-8 px-3 text-[11px] font-bold uppercase tracking-widest transition-all"
          >
            <LogOut className="h-3.5 w-3.5 md:mr-2" />
            <span className="hidden md:inline">Log out</span>
          </Button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="w-full max-w-5xl px-4 py-10 md:py-14">

        {/* Header */}
        <div className="mb-8">
          <p className="section-label">Your access</p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-[34px] font-black tracking-tight text-space-900">
                Hey {currentUser?.name?.split(" ")[0] || "there"}, pick a workspace
              </h1>
              <p className="text-space-500 text-[14px] font-medium mt-2">
                {companies.length} {companies.length === 1 ? "company" : "companies"} you can access — choose one to see its assignments and audit data.
              </p>
            </div>

            {isSuperAdmin && (
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => navigate("/add-company")}
                  className="bg-white hover:bg-space-50 text-space-700 hover:text-violet-700 border-space-200 shadow-sm rounded-lg h-10 text-[13px] font-bold transition-all active:scale-[0.98]"
                >
                  <Settings className="mr-2 h-4 w-4 text-space-400" />
                  Manage
                </Button>

                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="text-white shadow-glow-sm hover:shadow-glow hover:-translate-y-0.5 rounded-lg h-10 text-[13px] font-bold tracking-wide transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #8338FF 0%, #6E1FEB 60%, #D0219A 100%)" }}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Search — only worth showing once there's enough to search through */}
        {companies.length > 4 && (
          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-space-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by company name or location…"
              className="h-11 pl-10 rounded-xl border-space-200 bg-white text-sm placeholder:text-space-400 focus-visible:ring-violet-400"
            />
          </div>
        )}

        {/* ── Loading skeleton — matches the technical row layout ── */}
        {loading && (
          <div className="rounded-xl border border-space-200 bg-white overflow-hidden divide-y divide-space-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="h-8 w-1 rounded-full bg-space-100 shrink-0" />
                <div className="h-9 w-9 rounded-lg bg-space-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-space-100 rounded w-1/3" />
                  <div className="h-2.5 bg-space-100 rounded w-1/5" />
                </div>
                <div className="h-6 w-20 bg-space-100 rounded hidden sm:block" />
              </div>
            ))}
          </div>
        )}

        {/* ── No search results ── */}
        {!loading && companies.length > 0 && filteredCompanies.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-space-200 bg-white/50">
            <SearchX className="h-8 w-8 text-space-300 mb-3" />
            <p className="text-[14px] font-semibold text-space-600">No workspaces match "{query}"</p>
            <p className="text-[12px] text-space-400 mt-1">Try a different name or location.</p>
          </div>
        )}

        {/* ── Technical console list — monospace system IDs, live status
             pulse, structured columns. Deliberately reads like an
             infrastructure/ops dashboard (Vercel/Railway project list)
             rather than a generic rounded SaaS card grid. ── */}
        {!loading && filteredCompanies.length > 0 && (
          <div className="rounded-xl border border-space-200 bg-white overflow-hidden">

            {/* Column header row — table-like, monospace labels */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 bg-space-50 border-b border-space-200">
              <span className="text-[10px] font-bold uppercase tracking-widest text-space-400 font-mono">Workspace</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-space-400 font-mono">System ID</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-space-400 font-mono w-16 text-right">Status</span>
            </div>

            <div className="divide-y divide-space-100">
              {filteredCompanies.map((company) => {
                const p = paletteFor(company.name);
                const shortId = company.id.replace(/-/g, "").slice(0, 8);
                return (
                  <button
                    key={company.id}
                    onClick={() => handleCompanySelect(company.id)}
                    className="group relative w-full grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-2 sm:gap-4
                               px-5 py-3.5 text-left transition-colors duration-150 hover:bg-violet-50/40"
                  >
                    {/* Left accent bar — brightens on hover */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-200 group-hover:w-1"
                      style={{ backgroundColor: p.ring }}
                    />
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{ backgroundColor: p.text }}
                    />

                    {/* Column 1 — icon + name + address */}
                    <div className="flex items-center gap-3 min-w-0 pl-2">
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: p.bg, border: `1px solid ${p.ring}` }}
                      >
                        <span className="text-[12px] font-bold font-mono" style={{ color: p.text }}>
                          {getInitials(company.name)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-space-900 tracking-tight truncate group-hover:text-violet-700 transition-colors duration-150">
                          {company.name}
                        </p>
                        <p className="text-[11.5px] text-space-400 truncate">
                          {company.address || "No address on file"}
                        </p>
                      </div>
                    </div>

                    {/* Column 2 — monospace system ID, terminal-style chip */}
                    <div className="flex items-center gap-1.5 pl-11 sm:pl-0">
                      <span className="hidden sm:inline text-[11px] text-space-300 font-mono">#</span>
                      <span
                        className="text-[11px] font-mono font-medium px-2 py-1 rounded"
                        style={{ backgroundColor: "#F0F2F7", color: "#54547A" }}
                      >
                        {shortId}
                      </span>
                    </div>

                    {/* Column 3 — live status pulse + connect arrow */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0 w-full sm:w-auto">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-emerald-600">
                          Online
                        </span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-space-300 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all duration-150" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── Dialog for Adding Company ── */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-space-200 rounded-[24px]">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-2xl font-black text-space-900 tracking-tight">Add New Workspace</DialogTitle>
            <DialogDescription className="text-[14px] font-medium text-space-500 mt-1">
              Enter the company details below to create a new environment.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-4 bg-space-50 border-t border-space-100 mt-4">
            <CompanyForm 
              onSuccess={handleCompanyCreated}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CompanySelection;