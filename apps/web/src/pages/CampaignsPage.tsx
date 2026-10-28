import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Calendar } from 'lucide-react';
import { campaignsApi } from '../api/campaigns.api';
import { sendersApi, EmailSender } from '../api/senders.api';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Skeleton } from '../components/common/Skeleton';
import { useToast } from '../context/ToastContext';

export const CampaignsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderId, setSenderId] = useState('');
  const [startTime, setStartTime] = useState('');

  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignsApi.list,
  });

  const { data: sendersData } = useQuery({
    queryKey: ['senders'],
    queryFn: sendersApi.list,
  });

  const campaigns = campaignsData?.campaigns || [];
  const senders: EmailSender[] = sendersData?.senders || [];

  const createMutation = useMutation({
    mutationFn: campaignsApi.create,
    onSuccess: (res) => {
      success('Campaign created', `Created campaign "${res.campaign.name}"`);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsCreateOpen(false);
      setName('');
      setSubject('');
      setBody('');
    },
    onError: (err: any) => {
      error('Failed to create campaign', err.message);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !subject || !body || !senderId) {
      error('Validation error', 'Please fill in all required fields.');
      return;
    }

    createMutation.mutate({
      name,
      subject,
      body,
      senderId,
      startTime: new Date(startTime || Date.now()).toISOString(),
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-primary-light" />
            Email Campaigns
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Group scheduled lead batches, enforce sender limits, and track overall completion rates
          </p>
        </div>

        <Button
          onClick={() => {
            if (senders.length > 0 && !senderId) setSenderId(senders[0].id);
            setIsCreateOpen(true);
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          New Campaign
        </Button>
      </div>

      {/* Campaigns Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="py-16 text-center text-slate-500">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-slate-300">No campaigns found</div>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Create a campaign to organize multiple email jobs and monitor their aggregated metrics.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => {
            const percent = c.totalEmails > 0 ? Math.round((c.sentCount / c.totalEmails) * 100) : 0;
            return (
              <Card key={c.id} className="p-5 flex flex-col justify-between hover:border-primary/40 transition-all">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight line-clamp-1">{c.name}</h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-border text-slate-300 font-mono">
                      {c.totalEmails} leads
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">{c.subject}</p>

                  {/* Progress bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Progress</span>
                      <span className="font-semibold text-white">{percent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-background overflow-hidden border border-surface-border">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-surface-border/60 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(c.startTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-medium">{c.sentCount} sent</span>
                    <span className="text-cyan-400 font-medium">{c.scheduledCount} queued</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Email Campaign"
        maxWidth="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Campaign Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. November Product Launch"
              className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Exclusive Announcement"
              className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Sender Identity
            </label>
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-white focus:outline-none focus:border-primary"
              required
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.senderEmail})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Default Body Template
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Write campaign body template..."
              className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Campaign
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
