import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Search, XCircle, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { emailsApi, EmailJobItem } from '../api/emails.api';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { TableSkeleton } from '../components/common/Skeleton';
import { useToast } from '../context/ToastContext';

export const ScheduledPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [cancellingJob, setCancellingJob] = useState<EmailJobItem | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['emails', 'scheduled', page, searchTerm],
    queryFn: () => emailsApi.listScheduled({ page, limit: 15, search: searchTerm }),
    refetchInterval: 6000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => emailsApi.cancel(id),
    onSuccess: (res) => {
      success('Email job cancelled', `Cancelled scheduled email for ${res.email.recipientEmail}`);
      setCancellingJob(null);
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: (err: any) => {
      error('Failed to cancel email', err.message);
    },
  });

  const items = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-cyan-400" />
            Scheduled & Pending Emails
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Jobs persisted in PostgreSQL and managed as delayed tasks in BullMQ Redis
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search recipients or subjects..."
              className="w-full pl-9 pr-3 py-1.5 bg-surface border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            loading={isFetching}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background/80 text-slate-400 uppercase tracking-wider border-b border-surface-border font-medium">
              <tr>
                <th className="px-6 py-3.5">Recipient</th>
                <th className="px-6 py-3.5">Subject</th>
                <th className="px-6 py-3.5">Sender</th>
                <th className="px-6 py-3.5">Campaign</th>
                <th className="px-6 py-3.5">Scheduled Delivery</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/40 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-6">
                    <TableSkeleton rows={6} cols={7} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <div className="font-medium text-slate-400">No scheduled emails found</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {searchTerm ? 'Try adjusting your search criteria' : 'Use Compose Email to schedule your first batch'}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-white">{job.recipientEmail}</td>
                    <td className="px-6 py-3.5 max-w-xs truncate text-slate-200">{job.subject}</td>
                    <td className="px-6 py-3.5 text-slate-400">
                      {job.sender?.displayName || job.sender?.senderEmail || 'Default'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">
                      {job.campaign?.name || '—'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-300">
                      {new Date(job.scheduledTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge status={job.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {['SCHEDULED', 'QUEUED'].includes(job.status) && (
                        <button
                          onClick={() => setCancellingJob(job)}
                          className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/40 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-3.5 border-t border-surface-border flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({data?.total} total records)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                icon={<ChevronLeft className="w-4 h-4" />}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                icon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={Boolean(cancellingJob)}
        onClose={() => setCancellingJob(null)}
        title="Cancel Scheduled Email"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              Are you sure you want to cancel this scheduled email? The BullMQ delayed task will be removed and marked as cancelled.
            </div>
          </div>

          {cancellingJob && (
            <div className="p-3 rounded-xl bg-background/60 border border-surface-border text-xs space-y-1">
              <div><strong>Recipient:</strong> {cancellingJob.recipientEmail}</div>
              <div><strong>Subject:</strong> {cancellingJob.subject}</div>
              <div><strong>Target:</strong> {new Date(cancellingJob.scheduledTime).toLocaleString()}</div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
            <Button variant="outline" onClick={() => setCancellingJob(null)}>
              Keep Scheduled
            </Button>
            <Button
              variant="danger"
              loading={cancelMutation.isPending}
              onClick={() => cancellingJob && cancelMutation.mutate(cancellingJob.id)}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
