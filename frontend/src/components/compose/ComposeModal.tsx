import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadCloud, Clock, Send, FileText, X } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { sendersApi } from '../../api/senders.api';
import { emailsApi, LeadUploadResponse } from '../../api/emails.api';
import { useToast } from '../../context/ToastContext';

export const ComposeModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderId, setSenderId] = useState('');
  const [manualRecipients, setManualRecipients] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [minDelayMs, setMinDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  const [leadData, setLeadData] = useState<LeadUploadResponse | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load authorized senders
  const { data: sendersData } = useQuery({
    queryKey: ['senders'],
    queryFn: sendersApi.list,
    enabled: isOpen,
  });

  const senders = sendersData?.senders || [];

  // Default initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      if (senders.length > 0 && !senderId) {
        setSenderId(senders[0].id);
      }
      if (!scheduledTime) {
        // Default to now + 5 minutes formatted for datetime-local
        const d = new Date(Date.now() + 5 * 60 * 1000);
        d.setSeconds(0, 0);
        const pad = (n: number) => String(n).padStart(2, '0');
        const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setScheduledTime(localIso);
      }
    }
  }, [isOpen, senders, senderId, scheduledTime]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await emailsApi.uploadLeads(file);
      setLeadData(res);
      success('Lead list parsed successfully', `Found ${res.validCount} valid recipients (${res.invalidCount} invalid, ${res.duplicateCount} duplicates removed).`);
    } catch (err: any) {
      error('Failed to parse lead file', err.message);
    } finally {
      setUploading(false);
    }
  };

  const scheduleMutation = useMutation({
    mutationFn: emailsApi.schedule,
    onSuccess: (data) => {
      success(
        'Campaign scheduled successfully!',
        `Enqueued ${data.scheduledCount} email jobs into BullMQ persistent queue.`
      );
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      onClose();
      // Reset form
      setSubject('');
      setBody('');
      setManualRecipients('');
      setLeadData(null);
    },
    onError: (err: any) => {
      error('Failed to schedule emails', err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let allRecipients: string[] = [];

    if (leadData && leadData.validEmails.length > 0) {
      allRecipients = [...leadData.validEmails];
    } else if (manualRecipients.trim()) {
      allRecipients = manualRecipients
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }

    if (!subject.trim()) {
      error('Validation error', 'Subject is required.');
      return;
    }
    if (!body.trim()) {
      error('Validation error', 'Email body is required.');
      return;
    }
    if (!senderId) {
      error('Validation error', 'Please select an authorized sender identity.');
      return;
    }
    if (allRecipients.length === 0) {
      error('Validation error', 'Please upload a CSV/text file or enter at least one recipient email.');
      return;
    }

    scheduleMutation.mutate({
      senderId,
      subject,
      body,
      scheduledTime: new Date(scheduledTime).toISOString(),
      recipients: allRecipients,
      customMinDelayMs: minDelayMs,
      customHourlyLimit: hourlyLimit,
      idempotencyKey: `schedule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    });
  };

  const recipientCount = leadData ? leadData.validCount : manualRecipients.split(/[\n,;]+/).filter(Boolean).length;
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose & Schedule Campaign"
      description="Create a persistent delayed email campaign with distributed rate limiting"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Sender Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Sender Identity
          </label>
          <select
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-background border border-surface-border rounded-xl text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            required
          >
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} ({s.senderEmail})
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Welcome to our platform"
            className="w-full px-3.5 py-2 bg-background border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            required
          />
        </div>

        {/* Email Body */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Email Body (HTML / Markdown supported)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write your email content here..."
            className="w-full px-3.5 py-2.5 bg-background border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            required
          />
        </div>

        {/* Recipient Source: CSV / Text Upload */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Recipient Leads (CSV or Text File)
          </label>
          <div className="border-2 border-dashed border-surface-border hover:border-primary/50 transition-colors rounded-xl p-5 text-center bg-background/50">
            <input
              type="file"
              id="lead-file-upload"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="lead-file-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <UploadCloud className="w-8 h-8 text-primary-light animate-bounce" />
              <div className="text-xs text-slate-300 font-medium">
                {uploading ? 'Processing lead list...' : 'Click or drop a CSV or TXT lead file here'}
              </div>
              <div className="text-[11px] text-slate-500">
                Supports columns like email, recipient, or raw comma/newline lists up to 10MB
              </div>
            </label>
          </div>

          {/* Lead Validation Summary Card */}
          {leadData && (
            <div className="mt-3 p-3.5 rounded-xl bg-surface-hover border border-surface-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary-light" />
                  {leadData.filename}
                </span>
                <button
                  type="button"
                  onClick={() => setLeadData(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-background/60 border border-surface-border text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Total</div>
                  <div className="text-sm font-bold text-white">{leadData.totalDetected}</div>
                </div>
                <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-center">
                  <div className="text-[10px] text-emerald-400 uppercase font-mono">Valid</div>
                  <div className="text-sm font-bold text-emerald-300">{leadData.validCount}</div>
                </div>
                <div className="p-2 rounded-lg bg-red-950/40 border border-red-800/40 text-center">
                  <div className="text-[10px] text-red-400 uppercase font-mono">Invalid</div>
                  <div className="text-sm font-bold text-red-300">{leadData.invalidCount}</div>
                </div>
                <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/40 text-center">
                  <div className="text-[10px] text-amber-400 uppercase font-mono">Duplicates</div>
                  <div className="text-sm font-bold text-amber-300">{leadData.duplicateCount}</div>
                </div>
              </div>
            </div>
          )}

          {!leadData && (
            <div className="mt-2">
              <span className="text-[11px] text-slate-400">Or paste recipient emails:</span>
              <input
                type="text"
                value={manualRecipients}
                onChange={(e) => setManualRecipients(e.target.value)}
                placeholder="alice@example.com, bob@example.com..."
                className="w-full mt-1 px-3 py-1.5 bg-background border border-surface-border rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </div>

        {/* Schedule Timing & Rate Limiting Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Start Time
            </label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-xs text-white focus:outline-none focus:border-primary"
              required
            />
            <div className="text-[10px] text-slate-500 mt-1">Timezone: {timezoneName}</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Min Delay ({minDelayMs} ms)
            </label>
            <input
              type="number"
              min={100}
              step={100}
              value={minDelayMs}
              onChange={(e) => setMinDelayMs(parseInt(e.target.value, 10) || 100)}
              className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-xs text-white focus:outline-none focus:border-primary"
            />
            <div className="text-[10px] text-slate-500 mt-1">Spaced atomically via Redis</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Hourly Limit ({hourlyLimit}/hr)
            </label>
            <input
              type="number"
              min={1}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-xs text-white focus:outline-none focus:border-primary"
            />
            <div className="text-[10px] text-slate-500 mt-1">Surplus moved to next hour</div>
          </div>
        </div>

        {/* Schedule Summary Preview Banner */}
        <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-slate-300 flex items-start gap-2.5">
          <Send className="w-4 h-4 text-primary-light shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Execution plan: </span>
            {recipientCount > 0 ? (
              <>
                <strong className="text-primary-light">{recipientCount} recipients</strong> will be scheduled in BullMQ for{' '}
                <strong className="text-white">{scheduledTime.replace('T', ' ')}</strong>, respecting {minDelayMs}ms delay and a {hourlyLimit}/hr limit.
              </>
            ) : (
              'Add recipient leads to see the schedule summary.'
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border/60">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={scheduleMutation.isPending}
            icon={<Send className="w-4 h-4" />}
          >
            Confirm & Schedule ({recipientCount})
          </Button>
        </div>
      </form>
    </Modal>
  );
};
