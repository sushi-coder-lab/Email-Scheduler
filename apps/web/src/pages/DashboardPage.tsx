import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, Send, AlertCircle, Activity, ArrowUpRight, RefreshCw } from 'lucide-react';
import { emailsApi } from '../api/emails.api';
import { campaignsApi } from '../api/campaigns.api';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Skeleton } from '../components/common/Skeleton';

export const DashboardPage: React.FC = () => {
  const { data: metrics, isLoading: loadingMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: emailsApi.getMetrics,
    refetchInterval: 5000,
  });

  const { data: scheduledData, isLoading: loadingScheduled } = useQuery({
    queryKey: ['emails', 'scheduled', 'dashboard'],
    queryFn: () => emailsApi.listScheduled({ limit: 5 }),
    refetchInterval: 5000,
  });

  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignsApi.list,
  });

  const recentScheduled = scheduledData?.items || [];
  const campaigns = campaignsData?.campaigns || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">System Overview</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of BullMQ delayed queues, worker throughput, and persistent job lifecycle
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchMetrics()}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <a
            href="/api/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-surface-border text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <span>Bull Board Monitor</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Scheduled Jobs */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scheduled & Queued</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loadingMetrics ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {metrics?.scheduledCount ?? 0}
              </div>
            )}
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>BullMQ Delayed:</span>
              <span className="text-cyan-300 font-mono font-semibold">{metrics?.queue.delayed ?? 0}</span>
            </div>
          </div>
        </Card>

        {/* Successfully Sent */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dispatched (SMTP)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loadingMetrics ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {metrics?.sentCount ?? 0}
              </div>
            )}
            <div className="text-[11px] text-slate-400 mt-1">
              Verified through Nodemailer Ethereal
            </div>
          </div>
        </Card>

        {/* Active Worker Jobs */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Concurrency</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loadingMetrics ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {metrics?.queue.active ?? 0}
              </div>
            )}
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>Waiting in queue:</span>
              <span className="text-indigo-300 font-mono font-semibold">{metrics?.queue.waiting ?? 0}</span>
            </div>
          </div>
        </Card>

        {/* Failed Jobs */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Failed Deliveries</span>
            <div className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loadingMetrics ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {metrics?.failedCount ?? 0}
              </div>
            )}
            <div className="text-[11px] text-slate-400 mt-1">
              Diagnostic failure logs recorded
            </div>
          </div>
        </Card>
      </div>

      {/* Tables Section: Next Scheduled & Active Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Next Scheduled Emails Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white tracking-tight">Upcoming Scheduled Queue</h3>
            <Link
              to="/scheduled"
              className="text-xs text-primary-light hover:text-white font-medium flex items-center gap-1 transition-colors"
            >
              <span>View all scheduled</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-background/60 text-slate-400 uppercase tracking-wider border-b border-surface-border font-medium">
                  <tr>
                    <th className="px-5 py-3">Recipient</th>
                    <th className="px-5 py-3">Subject</th>
                    <th className="px-5 py-3">Sender</th>
                    <th className="px-5 py-3">Target Date</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/40 text-slate-300">
                  {loadingScheduled ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center">
                        <Skeleton className="h-4 w-48 mx-auto" />
                      </td>
                    </tr>
                  ) : recentScheduled.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                        No scheduled jobs pending. Click <strong>Compose Email</strong> to schedule a batch.
                      </td>
                    </tr>
                  ) : (
                    recentScheduled.map((job) => (
                      <tr key={job.id} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-white">{job.recipientEmail}</td>
                        <td className="px-5 py-3 max-w-xs truncate text-slate-300">{job.subject}</td>
                        <td className="px-5 py-3 text-slate-400">{job.sender?.displayName || job.sender?.senderEmail}</td>
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-400">
                          {new Date(job.scheduledTime).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <Badge status={job.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Campaigns Summary Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white tracking-tight">Recent Campaigns</h3>
            <Link
              to="/campaigns"
              className="text-xs text-primary-light hover:text-white font-medium flex items-center gap-1 transition-colors"
            >
              <span>Manage</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Card className="p-4 space-y-3">
            {campaigns.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No campaigns created yet.
              </div>
            ) : (
              campaigns.slice(0, 4).map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-background/50 border border-surface-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white truncate">{c.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {c.totalEmails} leads
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{c.subject}</div>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-surface-border/40 text-slate-400">
                    <span className="text-emerald-400">{c.sentCount} sent</span>
                    <span className="text-cyan-400">{c.scheduledCount} scheduled</span>
                    <span className="text-red-400">{c.failedCount} failed</span>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
