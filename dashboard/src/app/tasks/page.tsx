'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/utils';
import { Clock, Play, Pause, Trash2, Plus, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Task {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  taskType: string;
  cronExpression: string;
  timezone: string;
  config: any;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

interface ExecutionLog {
  id: string;
  taskId: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  resultSummary: string | null;
  errorMessage: string | null;
  executionTimeMs: number | null;
}

interface TaskTemplate {
  taskType: string;
  label: string;
  description: string;
  defaultConfig: any;
  configFields: { key: string; label: string; type: string; options?: string[]; defaultValue?: any; required?: boolean }[];
}

interface CronPreset {
  label: string;
  value: string;
}

interface Agent {
  id: string;
  name: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [cronPresets, setCronPresets] = useState<CronPreset[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [taskLogs, setTaskLogs] = useState<Record<string, ExecutionLog[]>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  // Create form state
  const [newTaskType, setNewTaskType] = useState('');
  const [newName, setNewName] = useState('');
  const [newAgentId, setNewAgentId] = useState('');
  const [newCron, setNewCron] = useState('0 9 * * *');
  const [newConfig, setNewConfig] = useState<any>({});

  useEffect(() => {
    loadTasks();
    loadTemplates();
    loadAgents();
  }, []);

  async function loadTasks() {
    try {
      const data = await apiFetch<{ tasks: Task[] }>('/api/tasks');
      setTasks(data.tasks);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function loadTemplates() {
    try {
      const data = await apiFetch<{ templates: TaskTemplate[]; cronPresets: CronPreset[] }>('/api/tasks/templates');
      setTemplates(data.templates);
      setCronPresets(data.cronPresets);
    } catch {}
  }

  async function loadAgents() {
    try {
      const data = await apiFetch<{ agents: any[] }>('/api/agents');
      setAgents(data.agents.map((a: any) => ({ id: a.id, name: a.name })));
      if (data.agents.length > 0) setNewAgentId(data.agents[0].id);
    } catch {}
  }

  async function loadLogs(taskId: string) {
    try {
      const data = await apiFetch<{ logs: ExecutionLog[] }>(`/api/tasks/${taskId}/logs?limit=10`);
      setTaskLogs(prev => ({ ...prev, [taskId]: data.logs }));
    } catch {}
  }

  async function handleCreate() {
    if (!newName || !newTaskType || !newAgentId || !newCron) return;
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          agentId: newAgentId,
          name: newName,
          taskType: newTaskType,
          cronExpression: newCron,
          config: newConfig
        })
      });
      setShowCreate(false);
      setNewName('');
      setNewTaskType('');
      setNewConfig({});
      loadTasks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleToggle(task: Task) {
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !task.enabled })
      });
      loadTasks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this scheduled task?')) return;
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      loadTasks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRunNow(id: string) {
    setRunningTasks(prev => new Set(prev).add(id));
    try {
      await apiFetch(`/api/tasks/${id}/run-now`, { method: 'POST' });
      loadTasks();
      loadLogs(id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunningTasks(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  function toggleExpand(taskId: string) {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
      if (!taskLogs[taskId]) loadLogs(taskId);
    }
  }

  const selectedTemplate = templates.find(t => t.taskType === newTaskType);

  const typeLabels: Record<string, string> = {
    social_post: 'Social Post',
    lead_followup: 'Lead Follow-up',
    content_gen: 'Content Gen',
    monitoring: 'Monitoring'
  };

  const typeColors: Record<string, string> = {
    social_post: 'bg-blue-500/20 text-blue-400',
    lead_followup: 'bg-amber-500/20 text-amber-400',
    content_gen: 'bg-purple-500/20 text-purple-400',
    monitoring: 'bg-green-500/20 text-green-400'
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" /> Scheduled Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Autonomous tasks Boss runs on a schedule
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 p-5 bg-card border rounded-lg space-y-4">
          <h2 className="font-semibold">Create Scheduled Task</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Task Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Morning Social Post"
                className="w-full p-2 bg-background border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Agent</label>
              <select
                value={newAgentId}
                onChange={e => setNewAgentId(e.target.value)}
                className="w-full p-2 bg-background border rounded text-sm"
              >
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Task Type</label>
              <select
                value={newTaskType}
                onChange={e => { setNewTaskType(e.target.value); const t = templates.find(t => t.taskType === e.target.value); if (t) setNewConfig({ ...t.defaultConfig }); }}
                className="w-full p-2 bg-background border rounded text-sm"
              >
                <option value="">Select type...</option>
                {templates.map(t => <option key={t.taskType} value={t.taskType}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Schedule</label>
              <select
                value={newCron}
                onChange={e => setNewCron(e.target.value)}
                className="w-full p-2 bg-background border rounded text-sm"
              >
                {cronPresets.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <input
                value={newCron}
                onChange={e => setNewCron(e.target.value)}
                placeholder="Custom cron expression"
                className="w-full p-2 bg-background border rounded text-sm mt-1"
              />
            </div>
          </div>

          {/* Dynamic config fields based on selected template */}
          {selectedTemplate && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">{selectedTemplate.label} Config</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedTemplate.configFields.map(field => (
                  <div key={field.key}>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={newConfig[field.key] || field.defaultValue || ''}
                        onChange={e => setNewConfig((c: any) => ({ ...c, [field.key]: e.target.value }))}
                        className="w-full p-2 bg-background border rounded text-sm"
                      >
                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newConfig[field.key] ?? field.defaultValue ?? false}
                          onChange={e => setNewConfig((c: any) => ({ ...c, [field.key]: e.target.checked }))}
                        />
                        {field.label}
                      </label>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={newConfig[field.key] || ''}
                        onChange={e => setNewConfig((c: any) => ({ ...c, [field.key]: e.target.value }))}
                        className="w-full p-2 bg-background border rounded text-sm"
                        rows={2}
                      />
                    ) : field.type === 'number' ? (
                      <input
                        type="number"
                        value={newConfig[field.key] ?? field.defaultValue ?? ''}
                        onChange={e => setNewConfig((c: any) => ({ ...c, [field.key]: parseInt(e.target.value) || 0 }))}
                        className="w-full p-2 bg-background border rounded text-sm"
                      />
                    ) : (
                      <input
                        value={newConfig[field.key] || ''}
                        onChange={e => setNewConfig((c: any) => ({ ...c, [field.key]: e.target.value }))}
                        className="w-full p-2 bg-background border rounded text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={!newName || !newTaskType || !newAgentId}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 text-sm"
            >
              Create Task
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-3">
        {tasks.length === 0 && !showCreate && (
          <div className="text-center py-12 text-muted-foreground">
            No scheduled tasks yet. Create one to let Boss work autonomously.
          </div>
        )}

        {tasks.map(task => (
          <div key={task.id} className="bg-card border rounded-lg overflow-hidden">
            {/* Task Header */}
            <div className="p-4 flex items-center gap-3">
              <button
                onClick={() => handleToggle(task)}
                className={`w-10 h-6 rounded-full transition-colors relative ${task.enabled ? 'bg-green-500' : 'bg-muted'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${task.enabled ? 'left-5' : 'left-1'}`} />
              </button>

              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(task.id)}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{task.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[task.taskType] || 'bg-muted text-muted-foreground'}`}>
                    {typeLabels[task.taskType] || task.taskType}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono">{task.cronExpression}</span>
                  {task.lastRunAt && <span className="ml-3">Last: {new Date(task.lastRunAt).toLocaleString()}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRunNow(task.id)}
                  disabled={runningTasks.has(task.id)}
                  className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-50"
                  title="Run now"
                >
                  {runningTasks.has(task.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleExpand(task.id)}
                  className="p-2 hover:bg-muted rounded-lg text-muted-foreground"
                >
                  {expandedTask === task.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Expanded: Logs */}
            {expandedTask === task.id && (
              <div className="border-t px-4 py-3 bg-muted/30">
                <h4 className="text-sm font-medium mb-2">Recent Executions</h4>
                {(taskLogs[task.id] || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No executions yet</p>
                ) : (
                  <div className="space-y-2">
                    {(taskLogs[task.id] || []).map(log => (
                      <div key={log.id} className="flex items-start gap-2 text-xs">
                        {log.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                        ) : log.status === 'failed' ? (
                          <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        ) : (
                          <Loader2 className="h-4 w-4 text-amber-400 animate-spin mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-muted-foreground">
                            {new Date(log.startedAt).toLocaleString()}
                            {log.executionTimeMs && <span className="ml-2">({(log.executionTimeMs / 1000).toFixed(1)}s)</span>}
                          </div>
                          {log.resultSummary && (
                            <div className="mt-1 text-foreground line-clamp-3">{log.resultSummary}</div>
                          )}
                          {log.errorMessage && (
                            <div className="mt-1 text-red-400">{log.errorMessage}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Config display */}
                <div className="mt-3 pt-3 border-t">
                  <h4 className="text-sm font-medium mb-1">Config</h4>
                  <pre className="text-xs text-muted-foreground bg-background p-2 rounded overflow-x-auto">
                    {JSON.stringify(task.config, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
