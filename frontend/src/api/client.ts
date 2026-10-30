export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;
  correlationId?: string;

  constructor(message: string, statusCode: number, code?: string, details?: unknown, correlationId?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const defaultHeaders: HeadersInit = {
    Accept: 'application/json',
  };

  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // Ensures HTTP-only session cookie is sent and received
  });

  if (response.status === 204) {
    return {} as T;
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new ApiError(
      data.error || response.statusText || 'Request failed',
      response.status,
      data.code,
      data.details || data.issues,
      data.correlationId
    );
  }

  return data as T;
}
