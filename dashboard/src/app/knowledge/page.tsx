'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAgents } from '@/hooks/useAgents';
import { apiFetch, API_URL } from '@/lib/utils';
import { BookOpen, Upload, Trash2, FileText, Brain, FolderUp, Share2, RefreshCw, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface KnowledgeItem {
  id: string;
  agent_id: string;
  filename: string;
  summary: string;
  tokens: number;
  created_at: string;
}

interface KnowledgeResponse {
  items: KnowledgeItem[];
  totalTokens: number;
}

interface SyncStatus {
  active: boolean;
  folderPath?: string;
  intervalSeconds?: number;
  processedCount?: number;
  filesIngested?: number;
  lastScan?: string;
}

export default function KnowledgePage() {
  const { agents } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [shareTarget, setShareTarget] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ active: false });
  const [syncPath, setSyncPath] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Auto-select first agent
  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0].id);
    }
  }, [agents, selectedAgent]);

  // Load knowledge items + sync status when agent changes
  useEffect(() => {
    if (!selectedAgent) return;
    loadKnowledge();
    loadSyncStatus();
  }, [selectedAgent]);

  const loadKnowledge = async () => {
    if (!selectedAgent) return;
    setLoading(true);
    try {
      const data = await apiFetch<KnowledgeResponse>(`/api/agents/${selectedAgent}/knowledge`);
      setItems(data.items || []);
      setTotalTokens(data.totalTokens || 0);
    } catch (err: any) {
      toast.error('Failed to load knowledge: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    if (!selectedAgent) return;
    try {
      const data = await apiFetch<SyncStatus>(`/api/agents/${selectedAgent}/sync`);
      setSyncStatus(data);
      if (data.folderPath) setSyncPath(data.folderPath);
    } catch {
      setSyncStatus({ active: false });
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!selectedAgent) {
      toast.error('Select an agent first');
      return;
    }
    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of Array.from(files)) {
      try {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const token = typeof window !== 'undefined' ? localStorage.getItem('starfish_token') : null;

        if (isPdf) {
          // PDFs need multipart upload (binary)
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch(`${API_URL}/api/agents/${selectedAgent}/knowledge`, {
            method: 'POST',
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: formData
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else {
          // Text files via JSON
          const text = await file.text();
          const res = await fetch(`${API_URL}/api/agents/${selectedAgent}/knowledge`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ filename: file.name, content: text })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }
        successCount++;
      } catch (err: any) {
        failCount++;
        console.error(`Failed to upload ${file.name}:`, err);
      }
    }

    setUploading(false);
    if (successCount > 0) toast.success(`Uploaded ${successCount} file(s)`);
    if (failCount > 0) toast.error(`${failCount} file(s) failed`);
    loadKnowledge();
  };

  const deleteItem = async (itemId: string) => {
    try {
      await apiFetch(`/api/agents/${selectedAgent}/knowledge/${itemId}`, { method: 'DELETE' });
      toast.success('Deleted');
      loadKnowledge();
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message);
    }
  };

  const shareItems = async () => {
    if (!shareTarget || selectedItems.size === 0) {
      toast.error('Select items and a target agent');
      return;
    }
    try {
      await apiFetch(`/api/agents/${selectedAgent}/knowledge/share`, {
        method: 'POST',
        body: JSON.stringify({ targetAgentId: shareTarget, itemIds: Array.from(selectedItems) })
      });
      toast.success(`Shared ${selectedItems.size} item(s) with ${agents?.find(a => a.id === shareTarget)?.name}`);
      setSelectedItems(new Set());
      setShareTarget('');
    } catch (err: any) {
      toast.error('Share failed: ' + err.message);
    }
  };

  const toggleSync = async () => {
    if (syncStatus.active) {
      try {
        await apiFetch(`/api/agents/${selectedAgent}/sync`, { method: 'DELETE' });
        toast.success('Sync stopped');
        setSyncStatus({ active: false });
      } catch (err: any) {
        toast.error('Stop failed: ' + err.message);
      }
    } else {
      if (!syncPath.trim()) {
        toast.error('Enter a folder path');
        return;
      }
      try {
        await apiFetch(`/api/agents/${selectedAgent}/sync`, {
          method: 'POST',
          body: JSON.stringify({ folderPath: syncPath, intervalSeconds: 30 })
        });
        toast.success('Sync started');
        loadSyncStatus();
      } catch (err: any) {
        toast.error('Sync failed: ' + err.message);
      }
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [selectedAgent]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files);
  };

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const supported = Array.from(e.target.files).filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        return ['txt', 'md', 'json', 'csv', 'html', 'xml', 'yaml', 'yml', 'js', 'ts', 'py', 'sh', 'log', 'pdf'].includes(ext);
      });
      if (supported.length === 0) {
        toast.error('No supported files found in folder');
        return;
      }
      uploadFiles(supported);
    }
  };

  const TOKEN_BUDGET = 20000;
  const tokenPercent = Math.min(100, Math.round((totalTokens / TOKEN_BUDGET) * 100));

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
        </div>
        <select
          value={selectedAgent}
          onChange={(e) => { setSelectedAgent(e.target.value); setSelectedItems(new Set()); }}
          className="bg-card border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Select Agent</option>
          {agents?.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {selectedAgent && (
        <>
          {/* Token Budget Bar */}
          <div className="bg-card border rounded-lg p-4 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Knowledge Token Budget</span>
              <span className={tokenPercent > 80 ? 'text-amber-400' : 'text-muted-foreground'}>
                {totalTokens.toLocaleString()} / {TOKEN_BUDGET.toLocaleString()} tokens ({tokenPercent}%)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  tokenPercent > 90 ? 'bg-red-500' : tokenPercent > 70 ? 'bg-amber-400' : 'bg-primary'
                }`}
                style={{ width: `${tokenPercent}%` }}
              />
            </div>
          </div>

          {/* Sync Daemon Controls */}
          <div className="bg-card border rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Folder Sync</span>
              {syncStatus.active && (
                <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">Active</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={syncPath}
                onChange={(e) => setSyncPath(e.target.value)}
                placeholder="/path/to/watch/folder"
                disabled={syncStatus.active}
                className="flex-1 min-w-0 px-3 py-2 bg-background border rounded-lg text-sm disabled:opacity-50"
              />
              <button
                onClick={toggleSync}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0 ${
                  syncStatus.active
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {syncStatus.active ? 'Stop' : 'Start Sync'}
              </button>
            </div>
            {syncStatus.active && (
              <p className="text-xs text-muted-foreground mt-2">
                Watching: {syncStatus.folderPath} · {syncStatus.filesIngested} files ingested · Last scan: {syncStatus.lastScan ? new Date(syncStatus.lastScan).toLocaleTimeString() : '—'}
              </p>
            )}
          </div>

          {/* Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center mb-4 transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/50'
            }`}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                <span className="text-muted-foreground">Processing & summarizing...</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Drag & drop files here, or click to upload
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <label className="cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Upload Files
                    <input
                      type="file"
                      multiple
                      accept=".txt,.md,.json,.csv,.html,.xml,.yaml,.yml,.js,.ts,.py,.sh,.log,.pdf"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                  <label className="cursor-pointer bg-card border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted inline-flex items-center gap-2">
                    <FolderUp className="h-4 w-4" />
                    Upload Folder
                    <input
                      type="file"
                      multiple
                      // @ts-ignore
                      webkitdirectory=""
                      onChange={handleFolderInput}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Supports: .txt, .md, .json, .csv, .html, .xml, .yaml, .js, .ts, .py, .pdf
                </p>
              </>
            )}
          </div>

          {/* Share Controls (show when items selected) */}
          {selectedItems.size > 0 && (
            <div className="bg-card border rounded-lg p-4 mb-4 flex items-center gap-3 flex-wrap">
              <Share2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm">{selectedItems.size} selected</span>
              <select
                value={shareTarget}
                onChange={(e) => setShareTarget(e.target.value)}
                className="bg-background border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">Share to...</option>
                {agents?.filter(a => a.id !== selectedAgent).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                onClick={shareItems}
                disabled={!shareTarget}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                Share
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="text-muted-foreground text-sm hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}
        </>
      )}

      {/* Knowledge Items List */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No knowledge items yet. Upload files to train this agent.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className={`bg-card border rounded-lg p-4 transition-colors ${
              selectedItems.has(item.id) ? 'border-primary/50 bg-primary/5' : ''
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelectItem(item.id)}
                    className="mt-1 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{item.filename}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {item.tokens.toLocaleString()} tokens
                      </span>
                    </div>
                    <p className={`text-xs text-muted-foreground ${expandedItem === item.id ? '' : 'line-clamp-2'}`}>
                      {item.summary}
                    </p>
                    {item.summary.length > 150 && (
                      <button
                        onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                        className="text-xs text-primary mt-1 inline-flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        {expandedItem === item.id ? 'Collapse' : 'Expand'}
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-muted-foreground hover:text-red-400 transition-colors p-1 flex-shrink-0"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
