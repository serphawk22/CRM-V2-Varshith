"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, 
  User, 
  MapPin, 
  ShieldCheck, 
  Hash, 
  MessageSquare, 
  Activity, 
  Plus, 
  Send,
  Loader2,
  Trash2,
  CheckCircle,
  Clock,
  Briefcase,
  Users,
  Edit2,
  Save,
  X,
  TrendingUp,
  Zap,
  ChevronRight,
  Mail
} from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import axios from 'axios';

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
};

const CommentSkeleton = () => (
  <div className="p-5 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm animate-pulse">
    <div className="flex justify-between mb-4">
      <div className="h-4 w-24 bg-slate-300/50 rounded-full"></div>
      <div className="h-4 w-32 bg-slate-300/50 rounded-full"></div>
    </div>
    <div className="space-y-3">
      <div className="h-4 w-full bg-slate-300/50 rounded-full"></div>
      <div className="h-4 w-2/3 bg-slate-300/50 rounded-full"></div>
    </div>
  </div>
);

const ActivitySkeletonTab = () => (
  <div className="flex gap-4 p-5 bg-white/40 backdrop-blur-md border border-white/60 shadow-sm rounded-2xl animate-pulse relative overflow-hidden">
    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-300/50"></div>
    <div className="bg-indigo-100/50 p-3 rounded-xl h-12 w-12 flex-shrink-0"></div>
    <div className="flex-1 space-y-3 py-1">
      <div className="h-5 w-48 bg-slate-300/50 rounded-full"></div>
      <div className="h-4 w-full bg-slate-300/50 rounded-full"></div>
      <div className="h-3 w-24 bg-slate-300/50 rounded-full mt-3"></div>
    </div>
  </div>
);

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [remarks, setRemarks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const { role } = useRole();
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [milestoneData, setMilestoneData] = useState({
    nextMilestone: '',
    nextMilestoneDate: ''
  });
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [editServicesForm, setEditServicesForm] = useState({
    services_offered: '',
    services_requested: ''
  });

  useEffect(() => {
    if (id) {
      Promise.all([
        fetchClientData(),
        fetchRemarks(),
        fetchActivities(),
        fetchEmails(),
        fetchEmployees(),
        fetchStatuses()
      ]).finally(() => setPageLoading(false));
    }
  }, [id]);

  const fetchStatuses = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/client-statuses`);
      const data = await res.json();
      setStatuses(data.statuses || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`);
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchClientData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
        setEditServicesForm({
          services_offered: data.services_offered || '',
          services_requested: data.services_requested || ''
        });
        setMilestoneData({
          nextMilestone: data.nextMilestone || '',
          nextMilestoneDate: data.nextMilestoneDate || ''
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRemarks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/remarks`);
      if (res.ok) {
        const data = await res.json();
        setRemarks(data.remarks || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/activities`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/emails`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignEmployee = async (employeeId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/assign-employee`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId })
      });
      if (res.ok) {
        setIsAssignModalOpen(false);
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/clients/${id}/keywords`, { keyword: newKeyword });
      if (res.data.success) {
        setNewKeyword('');
        setIsKeywordModalOpen(false);
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add keyword");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveKeyword = async (keyword: string) => {
    if (!confirm(`Remove keyword "${keyword}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/keywords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
      });
      if (res.ok) {
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const content = (form.elements.namedItem('content') as HTMLTextAreaElement).value;
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, createdBy: 'Admin' })
      });
      if (res.ok) {
        fetchRemarks();
        form.reset();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = {
      method: formData.get('method') as string,
      content: formData.get('content') as string
    };
    try {
      const res = await axios.post(`${API_BASE_URL}/clients/${id}/activities`, data);
      if (res.data.success) {
        fetchActivities();
        setIsActivityModalOpen(false);
        form.reset();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add activity");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(milestoneData);
      setIsMilestoneModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 animate-pulse mt-4">Pulling Intelligence Data...</h2>
      </div>
    );
  }
  if (!client) return <div className="p-8 text-red-500 font-bold text-center">Neural link failed. Client not found.</div>;

  return (
    <motion.div 
      initial="hidden" animate="show" variants={containerVariants}
      className="max-w-7xl mx-auto space-y-8"
    >
      {/* Header Section */}
      <motion.div variants={itemVariants} className="bg-white/50 backdrop-blur-2xl rounded-[3rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] border border-white p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full z-0 pointer-events-none"></div>
        <div className="relative z-10 w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-6">
             <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-3xl flex items-center justify-center shadow-lg text-white font-black text-3xl">
               {client.companyName?.substring(0, 1).toUpperCase() || 'C'}
             </div>
             <div>
               <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                 {client.companyName}
                 <span className={cn("text-[10px] px-3 py-1 rounded-full uppercase tracking-wider font-bold border", 
                   client.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200')}>
                   {client.status}
                 </span>
               </h1>
               <div className="flex flex-wrap items-center gap-4 mt-2">
                 <a href={client.website?.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1.5 transition-colors bg-white/60 px-3 py-1.5 rounded-full border border-white/80 backdrop-blur-sm text-sm">
                   <Globe className="w-4 h-4" /> {client.website}
                 </a>
                 <span className="text-slate-500 font-medium flex items-center gap-1.5 bg-white/60 px-3 py-1.5 rounded-full border border-white/80 backdrop-blur-sm text-sm">
                   <User className="w-4 h-4" /> {client.email}
                 </span>
               </div>
             </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => setIsAssignModalOpen(true)}
              className="w-full md:w-auto px-6 py-3 bg-white/70 backdrop-blur-md border border-white text-indigo-700 rounded-2xl font-bold hover:bg-white transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" /> 
              {client.assignedEmployee ? `Lead: ${client.assignedEmployee.name}` : 'Assign Lead'}
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-8">
          {/* Custom Animated Tabs */}
          <motion.div variants={itemVariants} className="flex gap-2 p-1.5 bg-white/40 backdrop-blur-md rounded-2xl border border-white shadow-sm overflow-x-auto scrollbar-hide">
            {['overview', 'remarks', 'activities', 'emails'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative px-6 py-3 rounded-xl font-bold text-sm tracking-wide capitalize flex-1 whitespace-nowrap transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="active-tab"
                    className="absolute inset-0 bg-white shadow-sm border border-slate-100 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={cn("relative z-10", activeTab === tab ? "text-indigo-600" : "text-slate-500 hover:text-slate-800")}>
                  {tab}
                </span>
              </button>
            ))}
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-8 min-h-[500px]"
            >
              {activeTab === 'overview' && (
                <div className="space-y-10">
                  <section>
                    <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-slate-800">
                      <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><MapPin className="w-5 h-5" /></div>
                      Project Identity
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="p-5 bg-white/60 border border-white/80 rounded-2xl shadow-sm">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Project Name</label>
                         <p className="font-bold text-slate-800">{client.projectName || 'N/A'}</p>
                       </div>
                       <div className="p-5 bg-white/60 border border-white/80 rounded-2xl shadow-sm">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">GMB Name</label>
                         <p className="font-bold text-slate-800">{client.gmbName || 'N/A'}</p>
                       </div>
                       <div className="p-5 bg-white/60 border border-white/80 rounded-2xl shadow-sm">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Associated Email</label>
                         <p className="font-bold text-slate-800">{client.email}</p>
                       </div>
                       <div className="p-5 bg-white/60 border border-white/80 rounded-2xl shadow-sm">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contact Phone</label>
                         <p className="font-bold text-slate-800">{client.phone || 'N/A'}</p>
                       </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-slate-800">
                      <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><ShieldCheck className="w-5 h-5" /></div>
                      Core Strategy
                    </h3>
                    <div className="p-6 border border-white rounded-[2rem] bg-gradient-to-br from-indigo-50/50 to-cyan-50/50 italic text-slate-700 font-medium leading-relaxed relative overflow-hidden shadow-inner">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-400"></div>
                      "{client.seoStrategy || 'Intelligence network is analyzing the target vector...'}"
                    </div>
                  </section>

                  <section>
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black flex items-center gap-3 text-slate-800">
                           <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Hash className="w-5 h-5" /></div>
                           Target Keywords
                        </h3>
                        <button 
                          onClick={() => setIsKeywordModalOpen(true)}
                          className="px-4 py-2 bg-white/80 border border-slate-200 rounded-xl text-indigo-600 hover:text-indigo-800 hover:bg-white flex items-center gap-2 text-sm font-bold transition-all shadow-sm"
                        >
                          <Plus className="w-4 h-4" /> Add Keyword
                        </button>
                     </div>
                     <div className="flex flex-wrap gap-2.5">
                       {client.targetKeywords?.map((kw: string) => (
                         <span key={kw} className="px-4 py-2 bg-white/80 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex items-center gap-3 group shadow-sm">
                           {kw}
                           <button onClick={() => handleRemoveKeyword(kw)} className="text-slate-300 hover:text-red-500 bg-white rounded-full p-0.5 transition-colors">
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                         </span>
                       ))}
                     </div>
                  </section>
                </div>
              )}

              {activeTab === 'remarks' && (
                <div className="space-y-8">
                  <form onSubmit={handleAddRemark} className="space-y-4">
                    <div className="relative">
                      <textarea 
                        name="content"
                        placeholder="Log classified intelligence or general remarks..."
                        className="w-full p-6 bg-white/60 border border-white/80 rounded-[2rem] focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none min-h-[140px] text-slate-700 font-medium placeholder:text-slate-400 shadow-inner"
                        required
                      />
                      <button className="absolute bottom-6 right-6 w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all">
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </form>

                  <div className="space-y-4 relative">
                    {loading && <CommentSkeleton />}
                    {remarks.map(r => (
                      <div key={r.id} className="p-6 bg-white/50 backdrop-blur-sm rounded-[2rem] border border-white/60 shadow-sm relative group">
                        <div className="absolute top-0 left-0 w-1.5 h-0 bg-indigo-500 group-hover:h-full transition-all duration-300 rounded-l-[2rem]"></div>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                          <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">{r.createdBy}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> {new Date(r.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium leading-relaxed">{r.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'activities' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black flex items-center gap-3 text-slate-800">
                      <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Activity className="w-5 h-5" /></div>
                      Activity Feed
                    </h3>
                    <button onClick={() => setIsActivityModalOpen(true)} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-bold shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-lg transition-all flex items-center gap-2 text-sm">
                      <Plus className="w-4 h-4" /> Log Entry
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {loading && <ActivitySkeletonTab />}
                    {activities.map(a => (
                      <div key={a.id} className="flex gap-5 p-5 bg-white/50 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 group-hover:bg-cyan-400 transition-colors"></div>
                        <div className="bg-white p-3 rounded-2xl h-fit border border-slate-100 shadow-sm">
                          {a.method === 'Email' ? <Send className="w-5 h-5 text-indigo-500" /> : <Zap className="w-5 h-5 text-amber-500" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-slate-800 text-lg">{a.action} <span className="text-xs font-bold bg-white text-slate-500 border rounded-lg px-2 py-1 ml-2 align-middle">{a.method}</span></div>
                          <p className="text-slate-600 font-medium whitespace-pre-wrap mt-2 leading-relaxed bg-white/40 p-3 rounded-xl border border-white/40">{a.content}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-4 font-black uppercase tracking-widest">
                            <Clock className="w-3 h-3" /> {new Date(a.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'emails' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Mail className="w-5 h-5" /></div>
                    <h3 className="text-xl font-black text-slate-800">Email History</h3>
                    <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full">{emails.length} sent</span>
                  </div>
                  {emails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                      <Mail className="w-10 h-10 opacity-30" />
                      <p className="font-bold">No emails sent to this client yet</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {emails.map((em: any) => (
                        <div key={em.id} className="bg-white/60 border border-white/80 rounded-[2rem] p-6 shadow-sm">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subject</p>
                              <p className="font-black text-slate-800 text-lg">{em.subject}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-4">{new Date(em.sent_at).toLocaleDateString()}</span>
                          </div>
                          {em.english_body && (
                            <div className="mb-3">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">🇺🇸 English</p>
                              <p className="text-sm text-slate-700 font-medium leading-relaxed bg-white/80 p-4 rounded-2xl border border-white whitespace-pre-wrap">{em.english_body}</p>
                            </div>
                          )}
                          {em.spanish_body && (
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">🇪🇸 Español</p>
                              <p className="text-sm text-slate-700 font-medium leading-relaxed bg-orange-50/60 p-4 rounded-2xl border border-orange-100 whitespace-pre-wrap">{em.spanish_body}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Sidebar Widgets (Right) */}
        <div className="lg:col-span-4 space-y-6">
          <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] border border-white/60 p-8">
            <div className="flex justify-between items-center mb-6 border-b border-white/50 pb-4">
              <h3 className="font-black text-lg flex items-center gap-3 text-slate-800">
                <div className="p-2 bg-cyan-50 text-cyan-600 rounded-xl"><Activity className="w-5 h-5" /></div>
                Service Analysis
              </h3>
              {(role === 'Admin' || role === 'Employee') && (
                <button 
                  onClick={() => {
                    if (isEditingServices) {
                      updateProfile({
                        services_offered: editServicesForm.services_offered,
                        services_requested: editServicesForm.services_requested
                      });
                    }
                    setIsEditingServices(!isEditingServices);
                  }}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-xl transition-all font-bold shadow-sm border",
                    isEditingServices ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-white text-slate-500 border-slate-100 hover:text-indigo-600"
                  )}
                >
                  {isEditingServices ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                </button>
              )}
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase flex justify-between mb-2">
                  Services Offered
                  {isEditingServices && <span className="text-indigo-400 opacity-60">Comma Seperated</span>}
                </label>
                {isEditingServices ? (
                  <textarea
                    value={editServicesForm.services_offered}
                    onChange={e => setEditServicesForm({...editServicesForm, services_offered: e.target.value})}
                    className="w-full p-4 border border-indigo-200/50 rounded-2xl text-sm bg-white/80 focus:ring-2 focus:ring-indigo-500/30 outline-none shadow-inner"
                    rows={3}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {client.services_offered ? (
                      client.services_offered.split(',').map((s: string, i: number) => (
                        <span key={i} className="px-3.5 py-1.5 bg-indigo-50/80 text-indigo-700 rounded-xl text-sm font-bold border border-indigo-100/50 shadow-sm">
                          {s.trim()}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic">No services recorded</p>
                    )}
                  </div>
                )}
              </div>
              <div className="pt-6 border-t border-white/50">
                <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase flex justify-between mb-2">
                  Requested Operations
                </label>
                {isEditingServices ? (
                  <textarea
                    value={editServicesForm.services_requested}
                    onChange={e => setEditServicesForm({...editServicesForm, services_requested: e.target.value})}
                    className="w-full p-4 border border-cyan-200/50 rounded-2xl text-sm bg-white/80 focus:ring-2 focus:ring-cyan-500/30 outline-none shadow-inner"
                    rows={3}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {client.services_requested ? (
                      client.services_requested.split(',').map((s: string, i: number) => (
                        <span key={i} className="px-3.5 py-1.5 bg-cyan-50/80 text-cyan-700 rounded-xl text-sm font-bold border border-cyan-100/50 shadow-sm">
                          {s.trim()}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic">No operations requested</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Email Status Widget */}
          <motion.div variants={itemVariants} className="bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 text-white relative overflow-hidden group">
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-500/30 blur-[60px] rounded-full group-hover:bg-cyan-500/30 transition-colors duration-1000 z-0"></div>
            <div className="relative z-10">
              <h3 className="font-black text-xl mb-6 flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl"><Send className="w-5 h-5" /></div>
                Comms Link
              </h3>
              <div className="space-y-4">
                <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex justify-between items-center group-hover:bg-white/10 transition-colors">
                  <p className="text-sm font-bold text-slate-300">Outbound Offer</p>
                   {client.outbound_email_sent ? (
                      <div className="flex items-center gap-2 text-emerald-400 font-bold bg-emerald-400/10 px-3 py-1.5 rounded-xl border border-emerald-400/20">
                        <CheckCircle className="w-4 h-4" /> Delivered
                      </div>
                   ) : (
                      <div className="flex items-center gap-2 text-slate-400 font-bold bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                        <Clock className="w-4 h-4" /> Pending
                      </div>
                   )}
                </div>
                <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex justify-between items-center group-hover:bg-white/10 transition-colors">
                  <p className="text-sm font-bold text-slate-300">Inbound Data</p>
                   {client.inbound_email_sent ? (
                      <div className="flex items-center gap-2 text-emerald-400 font-bold bg-emerald-400/10 px-3 py-1.5 rounded-xl border border-emerald-400/20">
                        <CheckCircle className="w-4 h-4" /> Delivered
                      </div>
                   ) : (
                      <div className="flex items-center gap-2 text-slate-400 font-bold bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                        <Clock className="w-4 h-4" /> Pending
                      </div>
                   )}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] border border-white/60 p-8 relative overflow-hidden">
             <div className="absolute left-0 bottom-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-cyan-400"></div>
             <div className="flex justify-between items-center mb-6 border-b border-white/50 pb-4">
              <h3 className="font-black text-lg text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><TrendingUp className="w-5 h-5" /></div>
                Next Milestone
              </h3>
              {(role === 'Admin' || role === 'Employee') && (
                <button 
                  onClick={() => setIsMilestoneModalOpen(true)}
                  className="w-10 h-10 bg-white border border-slate-100 flex items-center justify-center rounded-xl hover:text-indigo-600 transition-colors shadow-sm"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="space-y-4 relative">
              <div className="absolute left-3 top-2 bottom-2 w-px bg-indigo-100"></div>
              
              <div className="relative pl-10">
                 <div className="absolute left-0 top-1 w-6 h-6 bg-white border-2 border-indigo-400 rounded-full flex items-center justify-center shadow-sm">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Target</p>
                 <p className="font-bold text-slate-800 bg-white/70 p-4 rounded-xl border border-white shadow-sm inline-block w-full">
                    {client.nextMilestone || "Awaiting Setup"}
                 </p>
              </div>
              <div className="relative pl-10 pt-4">
                 <div className="absolute left-0 top-5 w-6 h-6 bg-indigo-50 border-2 border-indigo-200 rounded-full flex items-center justify-center">
                    <Clock className="w-3 h-3 text-indigo-300" />
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Schedule</p>
                 <span className="inline-flex items-center gap-2 bg-slate-900 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-md">
                     <Clock className="w-4 h-4 text-cyan-400" />
                     {client.nextMilestoneDate || "TBD"}
                 </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modals updated to Glassmorphism styling */}
      <AnimatePresence>
        {isAssignModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/90 backdrop-blur-2xl rounded-[2rem] border border-white shadow-2xl w-full max-w-sm p-8 relative">
              <button onClick={() => setIsAssignModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-800"><X className="w-6 h-6" /></button>
              <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                 <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Users className="w-5 h-5" /></div>
                 Assign Lead
              </h2>
              <div className="space-y-3">
                {employees.map(employee => (
                  <button 
                    key={employee.id} 
                    onClick={() => handleAssignEmployee(employee.id)}
                    className="w-full text-left px-5 py-4 rounded-2xl border border-slate-100 bg-white/60 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all font-bold text-slate-700 flex justify-between items-center group"
                  >
                    {employee.name}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {isKeywordModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/90 backdrop-blur-2xl rounded-[2rem] border border-white shadow-2xl w-full max-w-sm p-8 relative">
              <button onClick={() => setIsKeywordModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-800"><X className="w-6 h-6" /></button>
              <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                 <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Hash className="w-5 h-5" /></div>
                 Add Vector
              </h2>
              <form onSubmit={handleAddKeyword} className="space-y-6">
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Target Keyword</label>
                   <input 
                     type="text"
                     placeholder="e.g. SEO optimization"
                     value={newKeyword}
                     onChange={(e) => setNewKeyword(e.target.value)}
                     className="w-full px-5 py-3 bg-white/60 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700 shadow-inner"
                     autoFocus
                     required
                   />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full px-5 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-2xl font-bold shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Register Keyword
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isActivityModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-2xl w-full max-w-lg p-8 relative">
              <button onClick={() => setIsActivityModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-800"><X className="w-6 h-6" /></button>
              <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                 <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Activity className="w-6 h-6" /></div>
                 Log Feed Entry
              </h2>
              <form onSubmit={handleAddActivity} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Operation Type</label>
                  <select name="method" className="w-full px-5 py-3.5 bg-white/60 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700 shadow-inner appearance-none cursor-pointer">
                    <option value="Email">Email Transmission</option>
                    <option value="Call">Direct Call</option>
                    <option value="Meeting">Meeting / Standup</option>
                    <option value="Research">Data Research</option>
                    <option value="Other">Other Operation</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Content Details</label>
                  <textarea 
                    name="content" 
                    required 
                    placeholder="Provide detailed breakdown..."
                    className="w-full px-5 py-4 bg-white/60 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 shadow-inner min-h-[140px]"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full px-5 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} Submit Log
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isMilestoneModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-2xl w-full max-w-lg p-8 relative">
              <button onClick={() => setIsMilestoneModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-800"><X className="w-6 h-6" /></button>
              <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                 <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><TrendingUp className="w-6 h-6" /></div>
                 Update Trajectory
              </h2>
              <form onSubmit={handleUpdateMilestone} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Target Overview</label>
                  <input 
                    type="text" 
                    required
                    value={milestoneData.nextMilestone}
                    onChange={e => setMilestoneData({...milestoneData, nextMilestone: e.target.value})}
                    placeholder="e.g. SEO Audit V2"
                    className="w-full px-5 py-3.5 bg-white/60 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700 shadow-inner"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Target Date</label>
                  <input 
                    type="date" 
                    required
                    value={milestoneData.nextMilestoneDate}
                    onChange={e => setMilestoneData({...milestoneData, nextMilestoneDate: e.target.value})}
                    className="w-full px-5 py-3.5 bg-white/60 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700 shadow-inner"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full px-5 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-2xl font-bold shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 transition-all text-shadow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} Implement Fix
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
