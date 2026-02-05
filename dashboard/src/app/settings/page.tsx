'use client';

import { useState } from 'react';
import { Settings, MessageSquare, Mail, Share2, Key, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/utils';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'channels' | 'api' | 'backup'>('channels');

  const [imessageConfig, setImessageConfig] = useState({
    enabled: false,
    url: '',
    token: ''
  });

  const [emailConfig, setEmailConfig] = useState({
    provider: 'sendgrid',
    apiKey: '',
    fromEmail: '',
    fromName: ''
  });

  const handleExport = async () => {
    try {
      const data = await apiFetch<any>('/api/configs/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `starfish-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Configuration exported');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await apiFetch('/api/configs/import', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      toast.success('Configuration imported');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure channels, integrations, and backups</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'channels', label: 'Channels', icon: MessageSquare },
          { id: 'api', label: 'API Keys', icon: Key },
          { id: 'backup', label: 'Backup & Restore', icon: Download }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Channels Tab */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          {/* iMessage */}
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold">iMessage (BlueBubbles)</h3>
                  <p className="text-sm text-muted-foreground">Connect via BlueBubbles server</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={imessageConfig.enabled}
                  onChange={(e) => setImessageConfig({ ...imessageConfig, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {imessageConfig.enabled && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium mb-1.5">BlueBubbles Server URL</label>
                  <input
                    type="text"
                    value={imessageConfig.url}
                    onChange={(e) => setImessageConfig({ ...imessageConfig, url: e.target.value })}
                    placeholder="http://localhost:1234"
                    className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Auth Token</label>
                  <input
                    type="password"
                    value={imessageConfig.token}
                    onChange={(e) => setImessageConfig({ ...imessageConfig, token: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  Test Connection
                </button>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Mail className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold">Email (SendGrid / SMTP)</h3>
                <p className="text-sm text-muted-foreground">Configure outbound email</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium mb-1.5">Provider</label>
                <select
                  value={emailConfig.provider}
                  onChange={(e) => setEmailConfig({ ...emailConfig, provider: e.target.value })}
                  className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="sendgrid">SendGrid</option>
                  <option value="smtp">SMTP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">API Key</label>
                <input
                  type="password"
                  value={emailConfig.apiKey}
                  onChange={(e) => setEmailConfig({ ...emailConfig, apiKey: e.target.value })}
                  placeholder="SG.xxxxx"
                  className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">From Email</label>
                  <input
                    type="email"
                    value={emailConfig.fromEmail}
                    onChange={(e) => setEmailConfig({ ...emailConfig, fromEmail: e.target.value })}
                    placeholder="noreply@yourdomain.com"
                    className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">From Name</label>
                  <input
                    type="text"
                    value={emailConfig.fromName}
                    onChange={(e) => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
                    placeholder="Starfish AI"
                    className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Save Email Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'api' && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            API keys are configured via environment variables on your server. Update your .env file to change these settings.
          </p>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">ANTHROPIC_API_KEY</p>
                <p className="text-sm text-muted-foreground">Claude API access</p>
              </div>
              <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">Configured</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">OPENAI_API_KEY</p>
                <p className="text-sm text-muted-foreground">GPT API access</p>
              </div>
              <span className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-1 rounded">Not Set</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">SENDGRID_API_KEY</p>
                <p className="text-sm text-muted-foreground">Email sending</p>
              </div>
              <span className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-1 rounded">Not Set</span>
            </div>
          </div>
        </div>
      )}

      {/* Backup Tab */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Export Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Download all agent configurations, skills, and settings as a JSON file.
            </p>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export Configuration
            </button>
          </div>

          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Import Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Restore agents and settings from a previously exported JSON file.
            </p>
            <label className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors cursor-pointer w-fit">
              <Upload className="h-4 w-4" />
              Import Configuration
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
