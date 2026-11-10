import { basicAuthHeader, requestJson, uploadFile } from './http-client';

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

export class JiraClient {
  private readonly authHeader: string;
  private readonly apiBase: string;

  constructor(private readonly config: JiraConfig) {
    this.authHeader = basicAuthHeader(config.email, config.apiToken);
    this.apiBase = `${config.baseUrl.replace(/\/+$/, '')}/rest/api/3`;
  }

  get labels(): string[] {
    return this.config.labels;
  }

  issueUrl(key: string): string {
    return `${this.config.baseUrl.replace(/\/+$/, '')}/browse/${key}`;
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
