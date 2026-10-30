import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Search, ExternalLink, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, FileCode } from 'lucide-react';
import { emailsApi, EmailJobItem } from '../api/emails.api';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { TableSkeleton } from '../components/common/Skeleton';

export const SentPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewingError, setViewingError] = useState<EmailJobItem | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['emails', 'sent', page, searchTerm, statusFilter],
    queryFn: () => emailsApi.listSent({ page, limit: 15, search: searchTerm, status: statusFilter || undefined }),
    refetchInterval: 6000,
  });

  const items = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Send className="w-6 h-6 text-emerald-400" />
            Sent & Delivery History
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Confirmed SMTP submissions via Nodemailer Ethereal with live message preview URLs
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
              placeholder="Search sent emails..."
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-border/60 pb-3">
        {[
          { label: 'All Finished', value: '' },
          { label: 'Sent (SMTP Accepted)', value: 'SENT' },
          { label: 'Failed Deliveries', value: 'FAILED' },
          { label: 'Cancelled Jobs', value: 'CANCELLED' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-primary/20 text-primary-light border border-primary/40 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
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
                <th className="px-6 py-3.5">Sent Timestamp</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Preview / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/40 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-6">
                    <TableSkeleton rows={6} cols={6} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    <Send className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <div className="font-medium text-slate-400">No sent emails recorded yet</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Emails processed by the worker will appear here with Ethereal preview links
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
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-400">
                      {job.sentAt ? new Date(job.sentAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge status={job.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {job.smtpPreviewUrl && (
                          <a
                            href={job.smtpPreviewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-800/40 rounded-lg transition-colors inline-flex items-center gap-1"
                          >
                            <span>Ethereal Preview</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {job.lastError && (
                          <button
                            onClick={() => setViewingError(job)}
                            className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-800/40 rounded-lg transition-colors inline-flex items-center gap-1"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Error Log</span>
                          </button>
                        )}
                      </div>
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

      {/* Error Details Modal */}
      <Modal
        isOpen={Boolean(viewingError)}
        onClose={() => setViewingError(null)}
        title="Delivery Diagnostic Details"
        maxWidth="md"
      >
        {viewingError && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-background/80 border border-surface-border space-y-1">
              <div><strong>Recipient:</strong> {viewingError.recipientEmail}</div>
              <div><strong>Attempt Count:</strong> {viewingError.attemptCount}</div>
              <div><strong>Status:</strong> {viewingError.status}</div>
            </div>

            <div>
              <div className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-red-400" />
                Raw Error Message:
              </div>
              <pre className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-red-300 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                {viewingError.lastError || 'No error details recorded.'}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setViewingError(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
