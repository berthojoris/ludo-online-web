type ClientIssueContext = {
    connection?: string;
    http_status?: number;
    state_version?: number;
    current_version?: number;
};

type ClientIssueOptions = {
    level?: 'error' | 'warning';
    source?: string;
    roomCode?: string;
    action?: string;
    stack?: string;
    context?: ClientIssueContext;
};

const recentIssues = new Map<string, number>();
const ISSUE_DEBOUNCE_MS = 10_000;

function csrfToken(): string {
    return (
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content') ?? ''
    );
}

export function reportClientIssue(
    message: string,
    options: ClientIssueOptions = {},
): void {
    if (typeof window === 'undefined') {
        return;
    }

    const source = options.source ?? 'game';
    const key = [message, source, options.roomCode, options.action].join(':');
    const now = Date.now();
    const lastReported = recentIssues.get(key) ?? 0;

    if (now - lastReported < ISSUE_DEBOUNCE_MS) {
        return;
    }

    recentIssues.set(key, now);

    if (recentIssues.size > 50) {
        const oldestKey = recentIssues.keys().next().value;

        if (oldestKey) {
            recentIssues.delete(oldestKey);
        }
    }

    void fetch(route('client-issues.store'), {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            Accept: 'application/json',
        },
        body: JSON.stringify({
            message: message.slice(0, 2000),
            stack: options.stack?.slice(0, 10000),
            source,
            level: options.level ?? 'error',
            room_code: options.roomCode?.toUpperCase(),
            action: options.action,
            page: window.location.pathname,
            client_timestamp: new Date().toISOString(),
            context: options.context,
        }),
    }).catch(() => undefined);
}

function describeReason(reason: unknown): {
    message: string;
    stack?: string;
} {
    if (reason instanceof Error) {
        return { message: reason.message, stack: reason.stack };
    }

    if (typeof reason === 'string') {
        return { message: reason };
    }

    try {
        return { message: JSON.stringify(reason) };
    } catch {
        return { message: String(reason) };
    }
}

export function installClientIssueReporting(): void {
    window.addEventListener('error', (event) => {
        reportClientIssue(event.message || 'Uncaught browser error', {
            source: 'window.error',
            stack: event.error instanceof Error ? event.error.stack : undefined,
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = describeReason(event.reason);

        reportClientIssue(reason.message || 'Unhandled promise rejection', {
            source: 'window.unhandledrejection',
            stack: reason.stack,
        });
    });
}
