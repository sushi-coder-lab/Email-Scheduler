import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, CheckCircle2, ShieldAlert, Trash2 } from 'lucide-react';
import { slackApi } from '../api/slack.api';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useToast } from '../context/ToastContext';

export const SlackSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const { data: status } = useQuery({
    queryKey: ['slack-status'],
    queryFn: slackApi.getStatus,
  });

  const disconnectMutation = useMutation({
    mutationFn: slackApi.disconnect,
    onSuccess: () => {
      success('Slack disconnected', 'Disconnected Slack workspace successfully.');
      queryClient.invalidateQueries({ queryKey: ['slack-status'] });
    },
    onError: (err: any) => {
      error('Failed to disconnect Slack', err.message);
    },
  });

  const handleConnect = () => {
    window.location.href = slackApi.getConnectUrl();
  };

  const isConnected = status?.connected ?? false;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <MessageSquare className="w-6 h-6 text-purple-400" />
          Slack Rate-Limit Notifications
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Receive real-time deduplicated alerts in your team's Slack channel whenever a sender reaches an hourly sending limit
        </p>
      </div>

      {/* Main Connection Card */}
      <Card className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-border/60">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Slack Workspace Integration</h3>
                <Badge
                  variant={isConnected ? 'success' : 'default'}
                  className={isConnected ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300' : ''}
                >
                  {isConnected ? 'Connected' : 'Not Connected'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                OAuth 2.0 Webhook & Bot Integration
              </p>
            </div>
          </div>

          <div>
            {isConnected ? (
              <Button
                variant="danger"
                size="sm"
                loading={disconnectMutation.isPending}
                onClick={() => disconnectMutation.mutate()}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Disconnect Slack
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleConnect}
                icon={<MessageSquare className="w-4 h-4" />}
              >
                Connect Slack Workspace
              </Button>
            )}
          </div>
        </div>

        {/* Connection Details or Setup Info */}
        {isConnected ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-background/50 border border-surface-border">
              <div className="text-slate-400 font-medium">Team Name</div>
              <div className="text-sm font-bold text-white mt-1">{status?.teamName || 'Slack Team'}</div>
            </div>
            <div className="p-4 rounded-xl bg-background/50 border border-surface-border">
              <div className="text-slate-400 font-medium">Alert Channel</div>
              <div className="text-sm font-bold text-purple-400 mt-1 font-mono">{status?.channelName || '#email-alerts'}</div>
            </div>
            <div className="p-4 rounded-xl bg-background/50 border border-surface-border">
              <div className="text-slate-400 font-medium">Encryption Status</div>
              <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>AES-256-GCM at rest</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface-hover/50 border border-surface-border text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              How ReachInbox Rate Limit Alerts Work
            </div>
            <p className="text-slate-400">
              When an email sender exhausts its configured hourly quota, excess emails are safely rescheduled into the next hour window rather than dropped. If Slack is connected, a structured alert with sender identity, limit numbers, and correlation ID is sent to your Slack channel once per hourly window (deduplicated).
            </p>
          </div>
        )}
      </Card>

      {/* Developer Setup Instructions Card */}
      <Card
        title="Slack App Configuration Guide"
        subtitle="For self-hosted deployments and evaluators configuring their own Slack App"
        className="p-6"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <ol className="list-decimal list-inside space-y-2 text-slate-400">
            <li>
              Go to <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-primary-light underline">api.slack.com/apps</a> and click <strong>Create New App</strong> &rarr; <strong>From scratch</strong>.
            </li>
            <li>
              Under <strong>OAuth & Permissions</strong> &rarr; <strong>Redirect URLs</strong>, add:
              <pre className="mt-1 p-2 rounded-lg bg-background border border-surface-border font-mono text-[11px] text-primary-light">
                http://localhost:4000/api/slack/callback
              </pre>
            </li>
            <li>
              Under <strong>Scopes</strong> &rarr; <strong>Bot Token Scopes</strong>, add:
              <code className="mx-1 px-1.5 py-0.5 rounded bg-surface-border text-white font-mono">chat:write</code>,
              <code className="mx-1 px-1.5 py-0.5 rounded bg-surface-border text-white font-mono">channels:read</code>, and
              <code className="mx-1 px-1.5 py-0.5 rounded bg-surface-border text-white font-mono">incoming-webhook</code>.
            </li>
            <li>
              Copy <strong>Client ID</strong> and <strong>Client Secret</strong> into your <code className="px-1.5 py-0.5 rounded bg-surface-border text-white font-mono">.env</code> file under <code className="px-1.5 py-0.5 rounded bg-surface-border text-white font-mono">SLACK_CLIENT_ID</code> and <code className="px-1.5 py-0.5 rounded bg-surface-border text-white font-mono">SLACK_CLIENT_SECRET</code>.
            </li>
          </ol>
        </div>
      </Card>
    </div>
  );
};
