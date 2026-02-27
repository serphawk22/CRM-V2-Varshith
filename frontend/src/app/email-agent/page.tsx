"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Mail, Globe, User, CheckCircle, AlertCircle, Loader2, Send, FileEdit, Clock, Hand, ChevronRight, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
};

interface Draft {
  company_name: string;
  website_url: string;
  primary_email: string;
  recommended_services?: string;
  outreach: { subject: string; body: string; english_body?: string; spanish_body?: string };
  inbound: { subject: string; body: string; english_body?: string; spanish_body?: string };
}

interface Activity {
  id: number;
  company_name: string;
  email: string;
  sent_at: string;
  status: string;
  recommended_services?: string;
  subject?: string;
  content?: string;
}

const DraftSkeleton = () => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 animate-pulse relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full"></div>
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative z-10">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100/50"></div>
        <div className="space-y-2">
           <div className="h-6 w-32 bg-slate-300/50 rounded-full"></div>
           <div className="h-3 w-48 bg-slate-300/50 rounded-full"></div>
        </div>
      </div>
      <div className="flex gap-2 w-full md:w-auto">
        <div className="h-10 w-full md:w-32 bg-slate-200/50 rounded-xl"></div>
        <div className="h-10 w-full md:w-32 bg-slate-200/50 rounded-xl"></div>
      </div>
    </div>
    
    <div className="bg-white/40 border border-white/60 p-8 rounded-[2rem] space-y-6 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="h-3 w-16 bg-slate-300/50 rounded-full"></div>
          <div className="h-5 w-full bg-slate-300/50 rounded-full"></div>
        </div>
        <div className="space-y-3">
          <div className="h-3 w-32 bg-slate-300/50 rounded-full"></div>
          <div className="h-5 w-full bg-slate-300/50 rounded-full"></div>
        </div>
        <div className="space-y-3">
          <div className="h-3 w-12 bg-slate-300/50 rounded-full"></div>
          <div className="h-5 w-24 bg-slate-300/50 rounded-full"></div>
        </div>
      </div>
      <div className="space-y-3 pt-4 border-t border-white/50">
        <div className="h-3 w-20 bg-slate-300/50 rounded-full"></div>
        <div className="h-10 w-full bg-slate-300/50 rounded-xl"></div>
      </div>
      <div className="space-y-3 pt-2">
        <div className="h-3 w-16 bg-slate-300/50 rounded-full"></div>
        <div className="h-48 w-full bg-slate-300/50 rounded-[1.5rem]"></div>
      </div>
    </div>
  </motion.div>
);

export default function EmailAgentPage() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftType, setDraftType] = useState<'outreach' | 'inbound'>('outreach');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const [formData, setFormData] = useState({
    company_name: '',
    website_url: '',
    primary_email: ''
  });

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/activities`);
      setActivities(res.data.activities || []);
    } catch (err) {
      console.error("Failed to fetch activities", err);
    }
  };

  const handleDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDraft(null);

    try {
      const res = await axios.post(`${API_BASE_URL}/generate`, {
        urls: [formData.website_url]
      });

      console.log('[generate] API response:', res.data);

      const dataArray = res.data;
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        setError("No response from server. Please try again.");
        return;
      }

      const result = dataArray[0];
      console.log('[generate] result[0]:', result);

      if (!result) {
        setError("Empty response from server.");
        return;
      }

      if (result.error && (!result.emails || result.emails.length === 0)) {
        setError(`Scraping failed: ${result.error}`);
        return;
      }

      const emails: any[] = result.emails || [];
      console.log('[generate] emails:', emails);

      // Use first email or create a fallback from analysis data
      const emailData = emails[0] || {
        to_email: formData.primary_email || 'Manual@Entry',
        outreach: { 
          subject: 'Growth Partnership Opportunity', 
          body: 'Drafting failed. The website might be blocking exploration. Please try again or check the URL.', 
          english_body: 'Drafting failed. The website might be blocking exploration.', 
          spanish_body: 'La generación falló. El sitio web puede estar bloqueando la exploración.' 
        },
        inbound: { 
          subject: 'Inquiry from SERP Hawk', 
          body: 'Drafting failed. Please try again.', 
          english_body: 'Drafting failed.', 
          spanish_body: 'La generación falló.' 
        },
      };

      const analysis = result.analysis || {};
      const companyName = analysis.company_name || formData.company_name || 'Unknown';

      const outreach = emailData.outreach || {};
      const inbound = emailData.inbound || {};

      if (!outreach.subject && !outreach.english_body && !outreach.body) {
        setError("Draft was generated but appears empty. The website may have blocked scraping. Try a different URL.");
        return;
      }

      setDraft({
        company_name: companyName,
        website_url: result.url || formData.website_url,
        primary_email: emailData.to_email || formData.primary_email || '',
        recommended_services: result.recommended_services || '',
        outreach: {
          subject: outreach.subject || '',
          body: outreach.body || outreach.english_body || '',
          english_body: outreach.english_body || outreach.body || '',
          spanish_body: outreach.spanish_body || '',
        },
        inbound: {
          subject: inbound.subject || '',
          body: inbound.body || inbound.english_body || '',
          english_body: inbound.english_body || inbound.body || '',
          spanish_body: inbound.spanish_body || '',
        }
      });
      setDraftType('outreach');

    } catch (err: any) {
      console.error('[generate] error:', err);
      const msg = err.response?.data?.detail || err.message || "Failed to process lead. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (isManual = false) => {
    if (!draft) return;
    setSending(true);
    setError(null);

    const currentDraftData = draft[draftType];

    try {
      const res = await axios.post(`${API_BASE_URL}/send-lead`, {
        ...draft,
        english_body: currentDraftData.english_body || currentDraftData.body,
        spanish_body: currentDraftData.spanish_body || '',
        recommended_services: draft.recommended_services || '',
        manual: isManual
      });

      if (res.data.success) {
        setSuccess(isManual ?
          `Lead recorded! ${res.data.outbound_sent ? 'Outbound' : ''} ${res.data.inbound_sent ? 'Inbound' : ''}` :
          `Emails sent successfully to ${draft.company_name}!`
        );
        setDraft(null);
        setFormData({ company_name: '', website_url: '', primary_email: '' });
        fetchActivities();
      }

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to process lead. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-8 max-w-[1600px] mx-auto z-10 relative">
      <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] flex items-start gap-6 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full z-0 pointer-events-none"></div>
        <div className="p-4 bg-indigo-50 rounded-2xl shadow-sm text-indigo-600 relative z-10">
          <Bot className="w-8 h-8" />
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 tracking-tight">AI Outreach Agent</h1>
          <p className="text-slate-500 mt-2 font-medium">Neural engine automated lead generation & strategy delivery.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        {/* Input Form */}
        <div className="lg:col-span-4">
          <motion.div variants={itemVariants} className="bg-white/50 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-8 sticky top-24 relative overflow-hidden">
             <div className="absolute left-0 top-0 h-1 bg-gradient-to-r w-full from-indigo-500 to-cyan-500"></div>
            <h2 className="font-black text-xl mb-8 text-slate-800 tracking-tight flex items-center gap-3">
              Target Parameters
            </h2>

            <form onSubmit={handleDraft} className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Target Identity</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white/70 border border-white/80 rounded-2xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-sm font-bold text-slate-700 placeholder:text-slate-400"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Primary Domain</label>
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    required
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white/70 border border-white/80 rounded-2xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-sm font-bold text-slate-700 placeholder:text-slate-400"
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1 flex items-center justify-between">
                  Direct Contact <span className="text-cyan-500 opacity-60 normal-case tracking-normal">Optional</span>
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="email"
                    value={formData.primary_email}
                    onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white/70 border border-white/80 rounded-2xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-sm font-bold text-slate-700 placeholder:text-slate-400"
                    placeholder="Will auto-extract if blank"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !formData.website_url || !formData.company_name}
                className={cn(
                  "w-full text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all mt-4",
                  loading 
                    ? "bg-slate-800 shadow-md animate-pulse cursor-not-allowed" 
                    : "bg-gradient-to-r from-indigo-600 to-cyan-600 shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-400" /> : <FileEdit className="w-5 h-5" />}
                {loading ? 'Initializing Analysis...' : 'Generate Intelligent Draft'}
              </button>
            </form>

            <AnimatePresence>
              {success && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 p-4 bg-emerald-50/50 backdrop-blur-md border border-emerald-200 text-emerald-800 text-sm rounded-2xl flex items-start gap-3 shadow-sm font-bold">
                  <CheckCircle className="w-5 h-5 mt-0.5 shrink-0 text-emerald-500" />
                  <span>{success}</span>
                </motion.div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 p-4 bg-red-50/50 backdrop-blur-md border border-red-200 text-red-800 text-sm rounded-2xl flex items-start gap-3 shadow-sm font-bold">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-500" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Right Side: Draft Preview OR Activities List */}
        <div className="lg:col-span-8 space-y-8">

          {/* Draft Preview Section */}
          <AnimatePresence mode="wait">
            {loading ? (
              <DraftSkeleton key="skeleton" />
            ) : draft ? (
              <motion.div 
                key="draft" 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="bg-white rounded-[2.5rem] border border-slate-200 shadow-[0_16px_40px_rgba(0,0,0,0.1)] p-8 relative overflow-hidden group z-10"
              >
                {/* Glowing aesthetic border effects */}
                <div className="absolute top-0 right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[60px] rounded-full z-0 pointer-events-none group-hover:bg-cyan-500/10 transition-colors duration-1000"></div>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 relative z-10 border-b border-white/50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-cyan-500 text-white rounded-xl shadow-md">
                       <FileEdit className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-black text-2xl text-slate-800 tracking-tight">Draft Output</h2>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Review & Dispatch</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 bg-white/40 p-1.5 rounded-xl border border-white/80 shadow-sm w-full md:w-auto">
                    <button
                      onClick={() => setDraftType('outreach')}
                      className={cn(
                        "flex-1 md:flex-none px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                        draftType === 'outreach' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Offer Strategy
                    </button>
                    <button
                      onClick={() => setDraftType('inbound')}
                      className={cn(
                        "flex-1 md:flex-none px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                        draftType === 'inbound' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Inbound Hook
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block"></div>
                    <button
                      onClick={() => setDraft(null)}
                      className="px-3 py-2 text-slate-400 hover:text-red-500 transition-colors hidden md:block"
                      title="Discard Draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-inner space-y-6 relative z-20">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Identity</span>
                      <p className="text-slate-800 font-bold truncate">{draft.primary_email}</p>
                    </div>
                    <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Service Match</span>
                      <p className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500 font-black truncate">{draft.recommended_services || 'General Growth'}</p>
                    </div>
                    <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Vector Type</span>
                      <p className="text-slate-800 font-bold capitalize">{draftType}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 pl-1">Transmission Subject</span>
                    <p className="font-black text-black bg-white p-5 rounded-2xl border border-slate-300 shadow-sm" style={{ color: '#000000' }}>{draft[draftType].subject}</p>
                  </div>
                  <div className="space-y-4">
                    {/* English Para */}
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 pl-1 flex items-center gap-2">
                        🇺🇸 English — Paragraph 1
                      </span>
                      <div
                        className="max-w-none text-black font-black bg-white px-6 py-5 rounded-[1.5rem] border border-slate-300 shadow-sm leading-relaxed whitespace-pre-wrap"
                        style={{ color: '#000000' }}
                        dangerouslySetInnerHTML={{ __html: draft[draftType].english_body || draft[draftType].body || '<span class="text-slate-400 italic">No English content generated...</span>' }}
                      />
                    </div>
                    {/* Spanish Para */}
                    {draft[draftType].spanish_body && (
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 pl-1 flex items-center gap-2">
                          🇪🇸 Español — Párrafo 2
                        </span>
                        <div
                          className="max-w-none text-black font-black bg-white px-6 py-5 rounded-[1.5rem] border border-slate-300 shadow-sm leading-relaxed whitespace-pre-wrap"
                          style={{ color: '#000000' }}
                          dangerouslySetInnerHTML={{ __html: draft[draftType].spanish_body || '<span class="text-slate-400 italic">No Spanish content generated...</span>' }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/50 flex flex-col sm:flex-row justify-end gap-4 relative z-10">
                  <button
                    onClick={() => setDraft(null)}
                    className="px-6 py-3.5 bg-white/60 text-slate-600 rounded-xl font-bold transition-all border border-slate-200 hover:bg-white shadow-sm"
                  >
                    Discard Draft
                  </button>
                  <button
                    onClick={() => handleSend(true)}
                    disabled={sending}
                    className="bg-slate-800 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
                  >
                    <Hand className="w-5 h-5 text-slate-400" /> Log Only (Manual Sent)
                  </button>
                  <button
                    onClick={() => handleSend(false)}
                    disabled={sending}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-3.5 rounded-xl font-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.5)] hover:-translate-y-0.5"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Deploy Automated
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Activities Table */}
          <motion.div variants={itemVariants} className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="p-8 border-b border-white/50 flex justify-between items-center">
              <h2 className="font-black text-xl text-slate-800 flex items-center gap-3">
                 <div className="p-2 bg-white/60 rounded-xl shadow-sm text-indigo-600"><Clock className="w-5 h-5" /></div>
                 Operation History
              </h2>
            </div>

            {activities.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center relative pointer-events-none">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-slate-200/50 rounded-full blur-[60px]"></div>
                 <Bot className="w-12 h-12 text-slate-300 relative z-10 mb-4" />
                 <h3 className="text-xl font-black text-slate-600 relative z-10">No Transmissions Found</h3>
                 <p className="text-sm font-medium text-slate-400 mt-2 relative z-10">Deploy your first operation to record history here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b-2 border-slate-100">Target Identity</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b-2 border-slate-100">Operation Focus</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b-2 border-slate-100 hidden md:table-cell">Contact Vector</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b-2 border-slate-100">Timestamp</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b-2 border-slate-100">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/50">
                    {activities.map((activity) => (
                      <tr 
                        key={activity.id} 
                        onClick={() => setSelectedActivity(activity)}
                        className="hover:bg-white/60 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-5">
                           <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{activity.company_name}</div>
                        </td>
                        <td className="px-6 py-5">
                          {activity.recommended_services ? (
                            <span className="inline-block px-3 py-1 rounded-lg bg-indigo-50/50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                              {activity.recommended_services.split(',')[0]} 
                              {activity.recommended_services.split(',').length > 1 && <span className="text-indigo-400 ml-1">+{activity.recommended_services.split(',').length - 1}</span>}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-slate-500 font-medium hidden md:table-cell">{activity.email}</td>
                        <td className="px-6 py-5 text-slate-500 text-xs font-bold">{formatDate(activity.sent_at)}</td>
                        <td className="px-6 py-5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-100/50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {activity.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      
      {/* View Email Content Modal - Glassmorphism */}
      <AnimatePresence>
        {selectedActivity && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
             <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-white p-8 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                  <h3 className="text-2xl font-black flex items-center gap-3 text-slate-800 tracking-tight">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Mail className="w-6 h-6" /></div>
                    Transmission Log
                  </h3>
                  <button onClick={() => setSelectedActivity(null)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-400 hover:text-slate-800 transition-colors">&times;</button>
                </div>
                
                <div className="overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white/60 p-5 rounded-2xl border border-white shadow-sm">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target</span>
                      <p className="text-slate-800 font-bold truncate">{selectedActivity.company_name}</p>
                    </div>
                    <div className="bg-white/60 p-5 rounded-2xl border border-white shadow-sm">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Vector</span>
                      <p className="text-slate-800 font-bold truncate">{selectedActivity.email}</p>
                    </div>
                    <div className="bg-white/60 p-5 rounded-2xl border border-white shadow-sm">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Timestamp</span>
                      <p className="text-slate-800 font-bold text-xs truncate mt-1">{formatDate(selectedActivity.sent_at)}</p>
                    </div>
                    <div className="bg-white/60 p-5 rounded-2xl border border-white shadow-sm flex flex-col justify-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Result</span>
                      <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-emerald-100/50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3 mr-1" /> {selectedActivity.status}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 pl-1">Transmission Subject</span>
                     <p className="font-bold text-slate-800 bg-slate-50 p-5 rounded-2xl border border-slate-200">{selectedActivity.subject || 'Hidden / No Subject'}</p>
                  </div>
                  
                  <div>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 pl-1">Raw Payload</span>
                     {selectedActivity.content ? (
                       <div 
                         className="prose prose-slate prose-sm max-w-none text-slate-700 font-medium bg-slate-50 p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-inner min-h-[200px]"
                         dangerouslySetInnerHTML={{ __html: selectedActivity.content }}
                       />
                     ) : (
                       <div className="p-8 bg-slate-50 border border-slate-200 rounded-[2rem] text-center font-bold text-slate-400 flex flex-col items-center justify-center min-h-[200px]">
                          <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                          Legacy log - payload encrypted or permanently purged.
                       </div>
                     )}
                  </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}