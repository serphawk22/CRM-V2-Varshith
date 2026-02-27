"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Send, Clock, Briefcase, Target, Zap, Activity,
  Globe, CheckCircle, FolderKanban, Mail, ArrowUpRight,
  Bot, UserCheck, GraduationCap, Phone
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { cn } from "@/lib/utils";
import Link from "next/link";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120 } },
};

interface RecentActivity {
  id: number; action: string; method: string; content: string; createdAt: string | null;
}
interface AdminStats {
  total: number; active: number; pending: number; hold: number;
  totalProjects: number; totalEmailsSent: number; totalActivities: number;
  totalCalls: number; totalEmployees: number; totalInterns: number;
  chartLabels: string[]; activityChart: number[]; emailChart: number[]; callChart: number[];
  recentActivities: RecentActivity[];
}
interface ClientStats {
  isClient: true; companyName: string; projectName: string; website: string;
  status: string; seoStrategy: string; recommended_services: string;
  targetKeywords: string[]; nextMilestone: string; nextMilestoneDate: string;
}
type StatsData = AdminStats | ClientStats | null;

const NAV_CARDS = [
  { href: "/clients", icon: Users, gradient: "from-indigo-500 to-indigo-600", title: "Clients Hub", description: "The Foundation: Manage every client profile, track growth protocols, milestones, and maintain professional relationships in one central hub.", roles: ["Admin", "Employee"] },
  { href: "/email-agent", icon: Bot, gradient: "from-violet-500 to-purple-600", title: "Email Agent", description: "Growth Engine: AI-powered outreach that auto-analyzes leads and drafts personalized bilingual emails to scale your revenue automatically.", roles: ["Admin", "Employee"] },
  { href: "/calls", icon: Phone, gradient: "from-amber-500 to-orange-600", title: "Call Center", description: "Touchpoint Intelligence: Log every conversation, track follow-ups, and ensure no lead is ever left without a clear next step or work assignment.", roles: ["Admin", "Employee"] },
  { href: "/projects", icon: FolderKanban, gradient: "from-sky-400 to-cyan-500", title: "Project Board", description: "Execution Layer: Oversee complex workflows, assign specialized team members, and ensure every milestone is delivered with precision and quality.", roles: ["Admin", "Employee", "Intern"] },
  { href: "/interns", icon: GraduationCap, gradient: "from-rose-400 to-rose-500", title: "Talent Pool", description: "Scale Support: Manage your interns, assign learning tasks, and monitor their contribution to the core team's productivity and growth.", roles: ["Admin", "Employee"] },
  { href: "/employees", icon: UserCheck, gradient: "from-emerald-500 to-teal-500", title: "Core Team", description: "Human Capital: Direct access to your elite team members, managing high-level privileges and overseeing the entire organizational structure.", roles: ["Admin"] },
];

// Inline mini bar chart (no external library needed)
function MiniBarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5 h-16 w-full">
      {data.map((val, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1 h-full justify-end group">
          <div className="relative w-full flex items-end justify-center h-full">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(val / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
              className={cn("w-full rounded-t-lg min-h-[4px]", color)}
              title={`${labels[i]}: ${val}`}
            />
          </div>
          <span className="text-[9px] font-bold text-slate-400">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, gradient, href }: {
  title: string; value: number | string; sub: string; icon: any; gradient: string; href?: string;
}) {
  const inner = (
    <motion.div variants={itemVariants} className="relative group overflow-hidden">
      <div className="absolute inset-0 bg-white/40 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] transition-all group-hover:bg-white/60 group-hover:shadow-[0_16px_48px_rgba(0,0,0,0.1)]" />
      <div className="relative p-6 flex flex-col justify-between h-full z-10">
        <div className="flex justify-between items-start mb-4">
          <div className={cn("p-3.5 rounded-2xl bg-gradient-to-br shadow-sm", gradient)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {href && <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />}
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{title}</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight">{value}</h3>
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/60 rounded-full w-fit">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <p className="text-[10px] font-bold text-slate-600">{sub}</p>
        </div>
      </div>
    </motion.div>
  );
  return href ? <Link href={href} className="cursor-pointer">{inner}</Link> : inner;
}

export default function Dashboard() {
  const { role, email, user } = useRole();
  const [stats, setStats] = useState<StatsData>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = role === "Admin" || role === "Employee";

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`${API_BASE_URL}/dashboard-stats?role=${role}&email=${email}`);
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    }
    if (role) fetchStats();
  }, [role, email]);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-indigo-100 rounded-full" />
          <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 animate-pulse">Loading Dashboard...</h2>
      </div>
    );
  }

  const adminStats = isAdmin ? (stats as AdminStats) : null;
  const clientStats = !isAdmin ? (stats as ClientStats) : null;
  const visibleNavCards = NAV_CARDS.filter(c => c.roles.includes(role));

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 tracking-tight">
            {isAdmin ? "Operations Center" : `Welcome, ${clientStats?.companyName || user?.name}`}
          </h1>
          <p className="text-slate-500 font-medium text-lg">
            Good to have you back, <span className="text-indigo-600 font-bold">{user?.name || role}</span>.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <Link href="/clients" className="px-6 py-3.5 bg-white/70 backdrop-blur-md border border-white/50 text-slate-800 rounded-2xl font-bold shadow-sm hover:bg-white transition-all">View Clients</Link>
            <Link href="/email-agent" className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-2xl font-bold shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(79,70,229,0.5)] transition-all">Launch Agent</Link>
          </div>
        )}
      </motion.div>

      {/* ── ADMIN VIEW ─────────────────────────────────────────────────── */}
      {isAdmin && adminStats && (
        <>
          {/* Row 1: 6 stat pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            <StatCard title="Clients" value={adminStats.total} sub="Total" icon={Users} gradient="from-indigo-500 to-indigo-600" href="/clients" />
            <StatCard title="Active" value={adminStats.active} sub="Live" icon={Zap} gradient="from-emerald-400 to-emerald-500" href="/clients" />
            <StatCard title="Projects" value={adminStats.totalProjects} sub="Ongoing" icon={FolderKanban} gradient="from-sky-400 to-cyan-500" href="/projects" />
            <StatCard title="Emails" value={adminStats.totalEmailsSent} sub="Sent" icon={Send} gradient="from-violet-500 to-purple-600" href="/email-agent" />
            <StatCard title="Activities" value={adminStats.totalActivities} sub="Logs" icon={Activity} gradient="from-blue-500 to-indigo-600" href="/email-agent" />
            <StatCard title="Calls" value={adminStats.totalCalls} sub="Logged" icon={Phone} gradient="from-amber-400 to-orange-500" href="/calls" />
            <StatCard title="Employees" value={adminStats.totalEmployees} sub="Staff" icon={UserCheck} gradient="from-teal-500 to-emerald-500" href="/employees" />
            <StatCard title="Interns" value={adminStats.totalInterns} sub="Pool" icon={GraduationCap} gradient="from-rose-400 to-rose-500" href="/interns" />
          </div>

          {/* Row 2: Two charts + pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity chart */}
            <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity Logs</p>
                  <p className="text-2xl font-black text-slate-800">{adminStats.totalActivities}</p>
                </div>
                <div className="p-2 bg-indigo-50 rounded-2xl text-indigo-500"><Activity className="w-5 h-5" /></div>
              </div>
              <MiniBarChart
                data={adminStats.activityChart ?? [0,0,0,0,0,0,0]}
                labels={adminStats.chartLabels ?? ["","","","","","",""]}
                color="bg-indigo-400 group-hover:bg-indigo-500"
              />
            </motion.div>

            {/* Email chart */}
            <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emails Outbound</p>
                  <p className="text-2xl font-black text-slate-800">{adminStats.totalEmailsSent}</p>
                </div>
                <div className="p-2 bg-violet-50 rounded-2xl text-violet-500"><Mail className="w-5 h-5" /></div>
              </div>
              <MiniBarChart
                data={adminStats.emailChart ?? [0,0,0,0,0,0,0]}
                labels={adminStats.chartLabels ?? ["","","","","","",""]}
                color="bg-violet-400 group-hover:bg-violet-500"
              />
            </motion.div>

            {/* Interaction chart / Calls */}
            <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Call Interactions</p>
                  <p className="text-2xl font-black text-slate-800">{adminStats.totalCalls}</p>
                </div>
                <div className="p-2 bg-amber-50 rounded-2xl text-amber-500"><Phone className="w-5 h-5" /></div>
              </div>
              <MiniBarChart
                data={adminStats.callChart ?? [0,0,0,0,0,0,0]}
                labels={adminStats.chartLabels ?? ["","","","","","",""]}
                color="bg-amber-400 group-hover:bg-amber-500"
              />
            </motion.div>

            {/* Pipeline status */}
            <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-6 lg:col-span-3">
              <h3 className="font-black text-base text-slate-800 mb-6 flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 rounded-xl text-indigo-500"><Target className="w-4 h-4" /></div>
                Operational Overview & Pipeline
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { label: "Pending Setup", value: adminStats.pending, color: "bg-amber-400" },
                  { label: "On Hold", value: adminStats.hold, color: "bg-rose-400" },
                  { label: "Total Activities", value: adminStats.totalActivities, color: "bg-indigo-400" },
                  { label: "Calls Logged", value: adminStats.totalCalls, color: "bg-orange-400" },
                  { label: "Emails Deployed", value: adminStats.totalEmailsSent, color: "bg-violet-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col p-4 bg-white/60 rounded-3xl border border-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("w-2 h-2 rounded-full", color)} />
                      <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">{label}</span>
                    </div>
                    <span className="font-black text-3xl text-slate-800">{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Row 3: Quick Access nav cards */}
          <motion.div variants={itemVariants}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-1">Quick Access</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleNavCards.map((card) => (
                <Link key={card.href} href={card.href}>
                  <motion.div
                    variants={itemVariants}
                    whileHover={{ y: -4 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="group relative overflow-hidden bg-white/50 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 cursor-pointer hover:bg-white/70 hover:shadow-[0_16px_40px_rgba(0,0,0,0.1)] transition-all duration-300"
                  >
                    <div className={cn("absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-0 group-hover:opacity-25 transition-opacity duration-500 bg-gradient-to-br", card.gradient)} />
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className={cn("p-3.5 rounded-2xl bg-gradient-to-br shadow-sm", card.gradient)}>
                          <card.icon className="w-6 h-6 text-white" />
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
                      </div>
                      <h3 className="font-black text-xl text-slate-800 mb-1.5 group-hover:text-indigo-700 transition-colors">{card.title}</h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">{card.description}</p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Row 4: Recent Activity */}
          <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-xl text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Activity className="w-5 h-5" /></div>
                Recent Activity
              </h3>
              <Link href="/email-agent" className="text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-widest">View All</Link>
            </div>
            {(adminStats.recentActivities?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-3">
                <Activity className="w-10 h-10 opacity-30" />
                <p className="font-bold">No activities yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {adminStats.recentActivities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 p-4 bg-white/60 rounded-2xl border border-white hover:bg-white/80 transition-colors">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-500 shrink-0"><Mail className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{act.action}</p>
                      <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{act.content}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">{act.createdAt ? new Date(act.createdAt).toLocaleDateString() : "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* ── CLIENT VIEW ────────────────────────────────────────────────── */}
      {!isAdmin && clientStats && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Quick Access */}
          <div className="lg:col-span-12">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-1">Quick Access</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {visibleNavCards.map((card) => (
                <Link key={card.href} href={card.href}>
                  <motion.div variants={itemVariants} whileHover={{ y: -3 }} className="group relative overflow-hidden bg-white/50 rounded-3xl border border-white/80 shadow-sm p-5 cursor-pointer hover:bg-white/70 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn("p-2.5 rounded-xl bg-gradient-to-br", card.gradient)}><card.icon className="w-5 h-5 text-white" /></div>
                      <h3 className="font-black text-slate-800 group-hover:text-indigo-700">{card.title}</h3>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{card.description}</p>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 space-y-4">
            <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-8 space-y-4">
              <h3 className="font-black text-lg text-slate-800">Your Profile</h3>
              {[
                { label: "Company", value: clientStats.companyName, icon: Briefcase },
                { label: "Project", value: clientStats.projectName || "—", icon: FolderKanban },
                { label: "Website", value: clientStats.website || "—", icon: Globe },
                { label: "Status", value: clientStats.status || "Active", icon: CheckCircle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 p-3 bg-white/60 rounded-2xl border border-white">
                  <div className="p-2 bg-indigo-50 rounded-xl text-indigo-500"><Icon className="w-4 h-4" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{label}</p>
                    <p className="font-bold text-slate-800 text-sm truncate">{value}</p>
                  </div>
                </div>
              ))}
            </motion.div>
            {clientStats.nextMilestone && (
              <motion.div variants={itemVariants} className="bg-gradient-to-br from-indigo-600 to-cyan-500 rounded-[2.5rem] p-8 text-white">
                <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-1">Next Milestone</p>
                <p className="font-black text-xl">{clientStats.nextMilestone}</p>
                {clientStats.nextMilestoneDate && <p className="text-indigo-200 text-sm mt-1">{clientStats.nextMilestoneDate}</p>}
              </motion.div>
            )}
          </div>
          <div className="lg:col-span-8 space-y-6">
            {clientStats.seoStrategy && (
              <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 p-8">
                <h3 className="font-black text-xl text-slate-800 mb-3 flex items-center gap-3"><div className="p-2 bg-amber-50 rounded-xl text-amber-500"><Zap className="w-5 h-5" /></div>Active Strategy</h3>
                <p className="text-slate-600 font-medium leading-relaxed italic">"{clientStats.seoStrategy}"</p>
              </motion.div>
            )}
            {clientStats.recommended_services && (
              <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 p-8">
                <h3 className="font-black text-xl text-slate-800 mb-3 flex items-center gap-3"><div className="p-2 bg-emerald-50 rounded-xl text-emerald-500"><Target className="w-5 h-5" /></div>Recommended Services</h3>
                <div className="flex flex-wrap gap-2">
                  {clientStats.recommended_services.split(",").map((s) => (
                    <span key={s} className="px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-sm rounded-full">{s.trim()}</span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
