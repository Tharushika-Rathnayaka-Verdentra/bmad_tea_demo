import { basicAuthHeader, HttpError, requestJson, uploadFile } from './http-client';

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueType: string;
  labels: string[];
}

export interface JiraIssueRef {
  key: string;
  summary: string;
  status: string;
}

// Atlassian Document Format (ADF) node shape, as required by the Jira Cloud v3 API.
export type AdfNode = Record<string, unknown>;

export const adf = {
  doc(...content: AdfNode[]): AdfNode {
    return { type: 'doc', version: 1, content };
  },
  heading(text: string, level = 3): AdfNode {
    return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
  },
  paragraph(text: string): AdfNode {
    return { type: 'paragraph', content: [{ type: 'text', text }] };
  },
  link(label: string, href: string): AdfNode {
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] }],
    };
  },
  bulletList(items: string[]): AdfNode {
    return {
      type: 'bulletList',
      content: items.map((item) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
      })),
    };
  },
  codeBlock(text: string, language = 'text'): AdfNode {
    return { type: 'codeBlock', attrs: { language }, content: [{ type: 'text', text: text || '(no output)' }] };
  },
};

interface SearchResponse {
  issues: Array<{ key: string; fields: { summary: string; status: { name: string } } }>;
}

interface Myself {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
}

export const ATLASSIAN_TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';
const API_GATEWAY = 'https://api.atlassian.com/ex/jira';

/** Thrown when Jira rejects the credentials; the message is actionable and never contains the token. */
export class JiraAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'JiraAuthError';
  }
}

/**
 * Non-secret facts about an API token used to explain a 401. Current Atlassian tokens are
 * ~192 chars, start with "ATATT" and end with "=" plus an 8-hex checksum; anything else is
 * usually a copy/paste accident (quotes, whitespace, truncation, or a password instead of a token).
 */
export function describeApiToken(token: string): string[] {
  const problems: string[] = [];
  if (/^["']|["']$/.test(token)) {
    problems.push('the value is wrapped in quotes');
  }
  if (/\s/.test(token)) {
    problems.push('the value contains whitespace or a line break');
  }
  const core = token.replace(/^["']|["']$/g, '').trim();
  if (!core.startsWith('ATATT')) {
    problems.push(`it does not start with "ATATT" (${core.length} chars) — Atlassian API tokens do; an account password or a token from another product will not work`);
  } else if (!/=[0-9A-F]{8}$/.test(core)) {
    problems.push(`it is missing the trailing "=XXXXXXXX" checksum (${core.length} chars) — the token was probably truncated when copied`);
  }
  return problems;
}

export class JiraClient {
  private readonly authHeader: string;
  private readonly siteUrl: string;
  private apiBase: string;
  private cloudId?: string;

  constructor(private readonly config: JiraConfig) {
    this.authHeader = basicAuthHeader(config.email, config.apiToken);
    this.siteUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiBase = `${this.siteUrl}/rest/api/3`;
  }

  get labels(): string[] {
    return this.config.labels;
  }

  /** Base of the REST API in use: the site URL, or the api.atlassian.com gateway for scoped tokens. */
  get restBase(): string {
    return this.apiBase;
  }

  issueUrl(key: string): string {
    return `${this.siteUrl}/browse/${key}`;
  }

  /**
   * Jira Cloud answers JQL searches for anonymous callers (empty result, HTTP 200), so bad
   * credentials would only surface later as a misleading 400 on issue creation. Fail fast instead.
   *
   * Atlassian "API tokens with scopes" are rejected with 401 on `<site>.atlassian.net` and only
   * work through `api.atlassian.com/ex/jira/<cloudId>`; when the site rejects the token the client
   * resolves the cloudId and retries there, switching every later call to the gateway on success.
   */
  async verifyAuth(): Promise<{ accountId: string; displayName: string; viaGateway: boolean }> {
    const site = await this.tryMyself(`${this.siteUrl}/rest/api/3`);
    if (site.me?.accountId) {
      return { accountId: site.me.accountId, displayName: site.me.displayName ?? site.me.accountId, viaGateway: false };
    }
    if (site.status !== 401) {
      throw new JiraAuthError(`Jira authentication failed for ${this.config.email}: HTTP ${site.status} from ${this.siteUrl}/rest/api/3/myself: ${site.body}`, site.status);
    }

    const cloudId = await this.resolveCloudId();
    if (cloudId) {
      const gatewayBase = `${API_GATEWAY}/${cloudId}/rest/api/3`;
      const gateway = await this.tryMyself(gatewayBase);
      if (gateway.me?.accountId) {
        this.apiBase = gatewayBase;
        this.cloudId = cloudId;
        return { accountId: gateway.me.accountId, displayName: gateway.me.displayName ?? gateway.me.accountId, viaGateway: true };
      }
    }

    throw new JiraAuthError(this.explain401(cloudId), 401);
  }

  async verifyProject(): Promise<void> {
    const key = this.config.projectKey;
    try {
      await requestJson(`${this.apiBase}/project/${encodeURIComponent(key)}`, { headers: { Authorization: this.authHeader } });
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        throw new Error(
          `Jira project "${key}" was not found or is not visible to ${this.config.email}. JIRA_PROJECT_KEY must be the short project key (e.g. "SCRUM"), not the project name.`,
        );
      }
      if (error instanceof HttpError && (error.status === 401 || error.status === 403) && this.cloudId) {
        throw new JiraAuthError(
          `Jira returned HTTP ${error.status} for project "${key}" through the api.atlassian.com gateway. The scoped API token for ${this.config.email} needs the classic scopes read:jira-user, read:jira-work and write:jira-work; recreate it at ${ATLASSIAN_TOKEN_URL} with those scopes (or without scopes).`,
          error.status,
        );
      }
      throw error;
    }
  }

  private async tryMyself(base: string): Promise<{ status: number; me?: Myself; body: string }> {
    try {
      const me = await requestJson<Myself>(`${base}/myself`, { headers: { Authorization: this.authHeader } });
      return { status: 200, me, body: '' };
    } catch (error) {
      if (error instanceof HttpError) {
        return { status: error.status, body: error.body.slice(0, 200) };
      }
      throw error;
    }
  }

  // `_edge/tenant_info` is public on every Jira Cloud site and is the documented way to find the cloudId.
  private async resolveCloudId(): Promise<string | undefined> {
    try {
      const info = await requestJson<{ cloudId?: string }>(`${this.siteUrl}/_edge/tenant_info`, { timeoutMs: 10_000 });
      return info?.cloudId;
    } catch {
      return undefined;
    }
  }

  private explain401(cloudId: string | undefined): string {
    const email = this.config.email;
    const where = cloudId ? `both ${this.siteUrl} and the api.atlassian.com gateway (cloudId ${cloudId})` : `${this.siteUrl} (cloudId could not be resolved, so the gateway was not tried)`;
    const shape = describeApiToken(this.config.apiToken);
    const cause =
      shape.length > 0
        ? `JIRA_API_TOKEN does not look like a valid Atlassian API token: ${shape.join('; ')}.`
        : `JIRA_API_TOKEN is well-formed (${this.config.apiToken.length} chars, Atlassian "ATATT" format), so either JIRA_EMAIL (${email}) is not the email of the Atlassian account that created the token, or the token has been revoked or has expired. Atlassian revokes tokens automatically when they appear in a commit, including in example/template files.`;
    return [
      `Jira rejected the API token for ${email}: HTTP 401 from ${where}.`,
      cause,
      `Fix: check JIRA_EMAIL first; if it is right, sign in as ${email}, create a new token at ${ATLASSIAN_TOKEN_URL} (classic/unscoped, or scoped with read:jira-user, read:jira-work, write:jira-work), set it as JIRA_API_TOKEN in .env (gitignored) or the CI secret only — never in .env.example or any tracked file — and re-run.`,
    ].join(' ');
  }

  async findOpenIssueByLabel(label: string): Promise<JiraIssueRef | undefined> {
    const jql = `project = "${this.config.projectKey}" AND labels = "${label}" AND statusCategory != Done ORDER BY created DESC`;
    const response = await requestJson<SearchResponse>(`${this.apiBase}/search/jql`, {
      method: 'POST',
      headers: { Authorization: this.authHeader },
      body: { jql, fields: ['summary', 'status'], maxResults: 1 },
    });
    const issue = response.issues?.[0];
    return issue ? { key: issue.key, summary: issue.fields.summary, status: issue.fields.status.name } : undefined;
  }

  async createIssue(summary: string, description: AdfNode, extraLabels: string[]): Promise<JiraIssueRef> {
    const response = await requestJson<{ key: string }>(`${this.apiBase}/issue`, {
      method: 'POST',
      headers: { Authorization: this.authHeader },
      body: {
        fields: {
          project: { key: this.config.projectKey },
          issuetype: { name: this.config.issueType },
          summary: summary.slice(0, 255),
          description,
          labels: [...new Set([...this.config.labels, ...extraLabels])],
        },
      },
    });
    return { key: response.key, summary, status: 'new' };
  }

  async addComment(key: string, body: AdfNode): Promise<void> {
    await requestJson(`${this.apiBase}/issue/${key}/comment`, {
      method: 'POST',
      headers: { Authorization: this.authHeader },
      body: { body },
    });
  }

  async addAttachment(key: string, filePath: string, contentType?: string): Promise<void> {
    await uploadFile(
      `${this.apiBase}/issue/${key}/attachments`,
      filePath,
      'file',
      { Authorization: this.authHeader, 'X-Atlassian-Token': 'no-check' },
      contentType,
    );
  }
}
