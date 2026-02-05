'use client';

import { useState } from 'react';
import { Calendar, Plus, Play, Pause, Trash2, Mail, Share2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'social' | 'multi';
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
  targetCount: number;
  schedule?: string;
  createdAt: string;
}

// Mock data - in production this would come from the API
const mockCampaigns: Campaign[] = [];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [showNew, setShowNew] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'email' as const,
    schedule: ''
  });

  const handleCreate = () => {
    if (!newCampaign.name.trim()) {
      toast.error('Name is required');
      return;
    }

    const campaign: Campaign = {
      id: Date.now().toString(),
      name: newCampaign.name,
      type: newCampaign.type,
      status: 'draft',
      targetCount: 0,
      schedule: newCampaign.schedule || undefined,
      createdAt: new Date().toISOString()
    };

    setCampaigns([...campaigns, campaign]);
    setNewCampaign({ name: '', type: 'email', schedule: '' });
    setShowNew(false);
    toast.success('Campaign created');
  };

  const toggleStatus = (id: string) => {
    setCampaigns(
      campaigns.map((c) => {
        if (c.id === id) {
          const newStatus = c.status === 'running' ? 'paused' : 'running';
          return { ...c, status: newStatus };
        }
        return c;
      })
    );
  };

  const deleteCampaign = (id: string) => {
    if (!confirm('Delete this campaign?')) return;
    setCampaigns(campaigns.filter((c) => c.id !== id));
    toast.success('Campaign deleted');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500/10 text-green-500';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'completed':
        return 'bg-blue-500/10 text-blue-500';
      case 'scheduled':
        return 'bg-purple-500/10 text-purple-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return Mail;
      case 'social':
        return Share2;
      default:
        return Calendar;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Manage outbound marketing and automation campaigns</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {/* New Campaign Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-semibold">Create Campaign</h2>

            <div>
              <label className="block text-sm font-medium mb-1.5">Campaign Name</label>
              <input
                type="text"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                placeholder="Q1 Newsletter"
                className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Type</label>
              <select
                value={newCampaign.type}
                onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value as any })}
                className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="email">Email Campaign</option>
                <option value="social">Social Media</option>
                <option value="multi">Multi-Channel</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Schedule (Cron - optional)</label>
              <input
                type="text"
                value={newCampaign.schedule}
                onChange={(e) => setNewCampaign({ ...newCampaign, schedule: e.target.value })}
                placeholder="0 9 * * 1 (Every Monday 9am)"
                className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-lg">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No campaigns yet</h2>
          <p className="text-muted-foreground mb-4">Create your first outbound campaign to get started.</p>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const TypeIcon = getTypeIcon(campaign.type);
            return (
              <div
                key={campaign.id}
                className="bg-card border rounded-lg p-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <TypeIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{campaign.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="capitalize">{campaign.type}</span>
                      <span>•</span>
                      <span>{campaign.targetCount} targets</span>
                      {campaign.schedule && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Scheduled
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded capitalize ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>

                  <button
                    onClick={() => toggleStatus(campaign.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      campaign.status === 'running'
                        ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
                        : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                    }`}
                  >
                    {campaign.status === 'running' ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    onClick={() => deleteCampaign(campaign.id)}
                    className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
