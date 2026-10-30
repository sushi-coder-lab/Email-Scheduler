export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'ReachInbox Email Job Scheduler API',
    version: '1.0.0',
    description: 'Production-Grade Distributed Email Job Scheduler with BullMQ, Redis Lua distributed rate limiting, and dual Elasticsearch/Postgres search.',
    contact: {
      name: 'ReachInbox Engineering',
      email: 'support@reachinbox.ai',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local Development Server',
    },
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'System health check',
        description: 'Returns health status of PostgreSQL, Redis, and Elasticsearch.',
        responses: {
          200: {
            description: 'System healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    services: {
                      type: 'object',
                      properties: {
                        database: { type: 'string', example: 'connected' },
                        redis: { type: 'string', example: 'connected' },
                        elasticsearch: { type: 'string', example: 'connected' },
                      },
                    },
                    version: { type: 'string', example: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Get currently authenticated user',
        description: 'Returns profile of currently logged-in user and active tenant.',
        responses: {
          200: {
            description: 'Authenticated user profile',
          },
          401: {
            description: 'Unauthenticated',
          },
        },
      },
    },
    '/api/auth/dev-login': {
      post: {
        summary: 'Evaluator local development login',
        description: 'Enables seamless evaluator login without external OAuth credentials.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'demo@reachinbox.ai' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Logged in successfully with session cookie',
          },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        summary: 'Log out current session',
        responses: {
          200: {
            description: 'Logged out successfully',
          },
        },
      },
    },
    '/api/senders': {
      get: {
        summary: 'List authorized email senders',
        responses: {
          200: {
            description: 'List of configured senders',
          },
        },
      },
      post: {
        summary: 'Add an authorized email sender',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['senderEmail', 'displayName'],
                properties: {
                  senderEmail: { type: 'string', format: 'email', example: 'outreach@reachinbox.ai' },
                  displayName: { type: 'string', example: 'ReachInbox Outreach' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Sender created successfully',
          },
        },
      },
    },
    '/api/campaigns': {
      get: {
        summary: 'List tenant campaigns',
        responses: {
          200: { description: 'List of campaigns' },
        },
      },
      post: {
        summary: 'Create a new campaign',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'subject', 'body'],
                properties: {
                  name: { type: 'string', example: 'Q4 Product Launch' },
                  subject: { type: 'string', example: 'Supercharge your cold outreach' },
                  body: { type: 'string', example: '<p>Hi {{firstName}}, welcome to ReachInbox.</p>' },
                  minDelayMs: { type: 'integer', example: 2000 },
                  hourlyLimit: { type: 'integer', example: 100 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Campaign created successfully' },
        },
      },
    },
    '/api/emails/schedule': {
      post: {
        summary: 'Schedule single or batch emails',
        description: 'Enqueues delayed email jobs backed by BullMQ Redis queue with atomic rate limiting.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['senderId', 'subject', 'body', 'scheduledTime', 'recipients'],
                properties: {
                  senderId: { type: 'string', format: 'uuid' },
                  campaignId: { type: 'string', format: 'uuid' },
                  subject: { type: 'string', example: 'Special Offer' },
                  body: { type: 'string', example: '<p>Hello there</p>' },
                  scheduledTime: { type: 'string', format: 'date-time' },
                  recipients: {
                    type: 'array',
                    items: { type: 'string', format: 'email' },
                    example: ['lead1@example.com', 'lead2@example.com'],
                  },
                  idempotencyKey: { type: 'string', example: 'schedule-batch-101' },
                  customMinDelayMs: { type: 'integer', example: 2000 },
                  customHourlyLimit: { type: 'integer', example: 100 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Jobs scheduled successfully' },
        },
      },
    },
    '/api/emails/scheduled': {
      get: {
        summary: 'List scheduled email jobs',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Paginated scheduled jobs' },
        },
      },
    },
    '/api/emails/sent': {
      get: {
        summary: 'List sent email jobs',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Paginated sent jobs with Ethereal preview URLs' },
        },
      },
    },
    '/api/emails/{id}': {
      get: {
        summary: 'Get details of a specific email job',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Email details' },
          404: { description: 'Email not found' },
        },
      },
    },
    '/api/emails/{id}/cancel': {
      post: {
        summary: 'Safely cancel a scheduled email job',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Email cancelled' },
          400: { description: 'Cannot cancel an email that is already processing or sent' },
        },
      },
    },
    '/api/emails/upload-leads': {
      post: {
        summary: 'Upload and parse CSV lead list',
        description: 'Parses CSV, validates email addresses, and flags duplicates.',
        responses: {
          200: { description: 'Parsed and validated lead summary' },
        },
      },
    },
    '/api/emails/metrics': {
      get: {
        summary: 'Aggregated email queue and dispatch metrics',
        responses: {
          200: { description: 'Metrics summary' },
        },
      },
    },
    '/api/search/emails': {
      get: {
        summary: 'Full-text search for emails',
        description: 'Executes high-performance search across recipient, subject, and body using Elasticsearch with automatic Postgres fallback.',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Search results' },
        },
      },
    },
    '/api/queue/stats': {
      get: {
        summary: 'Real-time BullMQ queue metrics',
        responses: {
          200: { description: 'Waiting, active, delayed, completed, and failed counts' },
        },
      },
    },
  },
};
