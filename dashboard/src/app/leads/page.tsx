'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/utils';
import { Users, MessageSquare, Mail, Building2, ArrowRight, Send, ChevronLeft, Bot, User } from 'lucide-react';
import { toast } from 'sonner';

interface Lead {
  id: string;
  visitorId: string;
  status: 'new' | 'hot' | 'warm' | 'cold' | 'converted' | 'lost';
  contactEmail: string | null;
  contactName: string | null;
  businessName: string | null;
  useCase: string | null;
  channels: string | null;
  summary: string | null;
  nextStep: string | null;
  notes: string | null;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

interface LeadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface LeadComment {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-400',
  hot: 'bg-red-500/10 text-red-400',
  warm: 'bg-amber-500/10 text-amber-400',
  cold: 'bg-slate-500/10 text-slate-400',
  converted: 'bg-green-500/10 text-green-400',
  lost: 'bg-slate-600/10 text-slate-500'
};

const STATUSES: Lead['status'][] = ['new', 'hot', 'warm', 'cold', 'converted', 'lost'];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [comments, setComments] = useState<LeadComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => { loadLeads(); }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ leads: Lead[] }>('/api/leads');
      setLeads(data.leads || []);
    } catch (err: any) {
      toast.error('Failed to load leads: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openLead = async (lead: Lead) => {
    setSelectedLead(lead);
    try {
      const data = await apiFetch<{ lead: Lead; messages: LeadMessage[]; comments: LeadComment[] }>(`/api/leads/${lead.id}`);
      setSelectedLead(data.lead);
      setMessages(data.messages || []);
      setComments(data.comments || []);
    } catch (err: any) {
      toast.error('Failed to load lead details');
    }
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    try {
      const data = await apiFetch<{ lead: Lead }>(`/api/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      if (data.lead) {
        setSelectedLead(data.lead);
        setLeads(prev => prev.map(l => l.id === id ? data.lead : l));
      }
      toast.success('Updated');
    } catch (err: any) {
      toast.error('Update failed');
    }
  };

  const addComment = async () => {
    if (!selectedLead || !newComment.trim()) return;
    try {
      const data = await apiFetch<{ comment: LeadComment }>(`/api/leads/${selectedLead.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: newComment.trim() })
      });
      setComments(prev => [...prev, data.comment]);
      setNewComment('');
    } catch (err: any) {
      toast.error('Comment failed');
    }
  };

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter);

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Detail view
  if (selectedLead) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <button onClick={() => setSelectedLead(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to leads
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lead Info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card border rounded-lg p-4">
              <h2 className="font-bold text-lg mb-3">{selectedLead.businessName || selectedLead.visitorId}</h2>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select
                    value={selectedLead.status}
                    onChange={(e) => updateLead(selectedLead.id, { status: e.target.value as Lead['status'] })}
                    className="w-full bg-background border rounded px-2 py-1.5 mt-1 text-sm"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>

                {selectedLead.contactName && (
                  <div>
                    <label className="text-xs text-muted-foreground">Contact</label>
                    <p>{selectedLead.contactName}</p>
                  </div>
                )}

                {selectedLead.contactEmail && (
                  <div>
                    <label className="text-xs text-muted-foreground">Email</label>
                    <p className="text-primary">{selectedLead.contactEmail}</p>
                  </div>
                )}

                {selectedLead.useCase && (
                  <div>
                    <label className="text-xs text-muted-foreground">Use Case</label>
                    <p>{selectedLead.useCase}</p>
                  </div>
                )}

                {selectedLead.channels && (
                  <div>
                    <label className="text-xs text-muted-foreground">Channels</label>
                    <p>{selectedLead.channels}</p>
                  </div>
                )}

                {selectedLead.nextStep && (
                  <div>
                    <label className="text-xs text-muted-foreground">Next Step</label>
                    <p className="text-amber-400">{selectedLead.nextStep}</p>
                  </div>
                )}

                {selectedLead.summary && (
                  <div>
                    <label className="text-xs text-muted-foreground">AI Summary</label>
                    <p className="text-muted-foreground">{selectedLead.summary}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <textarea
                    defaultValue={selectedLead.notes || ''}
                    onBlur={(e) => updateLead(selectedLead.id, { notes: e.target.value } as any)}
                    placeholder="Add internal notes..."
                    className="w-full bg-background border rounded px-2 py-1.5 mt-1 text-sm min-h-[80px] resize-y"
                  />
                </div>

                <p className="text-xs text-muted-foreground">{selectedLead.messageCount} messages · {timeAgo(selectedLead.lastMessageAt)}</p>
              </div>
            </div>

            {/* Comments */}
            <div className="bg-card border rounded-lg p-4">
              <h3 className="font-medium text-sm mb-3">Team Comments</h3>
              <div className="space-y-2 mb-3 max-h-48 overflow-auto">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No comments yet</p>
                ) : comments.map(c => (
                  <div key={c.id} className="text-xs">
                    <span className="font-medium">{c.authorName}</span>
                    <span className="text-muted-foreground ml-1">{timeAgo(c.createdAt)}</span>
                    <p className="mt-0.5">{c.content}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addComment()}
                  placeholder="Add comment..."
                  className="flex-1 min-w-0 bg-background border rounded px-2 py-1.5 text-sm"
                />
                <button onClick={addComment} disabled={!newComment.trim()} className="bg-primary text-primary-foreground px-2 py-1.5 rounded text-sm disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Conversation Transcript */}
          <div className="lg:col-span-2 bg-card border rounded-lg p-4">
            <h3 className="font-medium text-sm mb-3">Conversation</h3>
            <div className="space-y-3 max-h-[70vh] overflow-auto">
              {messages.map(m => (
                <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-3 w-3 text-blue-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className="text-[10px] opacity-60 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                  </div>
                  {m.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-3 w-3" />
                    </div>
                  )}
                </div>
              ))}
              {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No messages recorded</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Leads</h1>
          <span className="text-sm text-muted-foreground">({leads.length})</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilter('all')} className={`px-2.5 py-1 rounded text-xs font-medium ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>All</button>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{s}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{filter === 'all' ? 'No leads yet. Public chat conversations will appear here.' : `No ${filter} leads.`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(lead => (
            <button
              key={lead.id}
              onClick={() => openLead(lead)}
              className="w-full bg-card border rounded-lg p-4 text-left hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${STATUS_COLORS[lead.status]}`}>{lead.status}</span>
                    {lead.businessName && (
                      <span className="font-medium text-sm flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> {lead.businessName}
                      </span>
                    )}
                    {lead.contactEmail && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {lead.contactEmail}
                      </span>
                    )}
                  </div>
                  {lead.summary && <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{lead.summary}</p>}
                  {lead.useCase && <p className="text-xs text-primary/80 line-clamp-1">{lead.useCase}</p>}
                  {lead.nextStep && <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> {lead.nextStep}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">{lead.messageCount} msgs</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(lead.lastMessageAt)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
