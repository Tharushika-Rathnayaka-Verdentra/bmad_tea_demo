import { basicAuthHeader, requestJson, uploadFile } from './http-client';

export interface TestRailConfig {
  instanceUrl: string;
  username: string;
  apiKey: string;
  projectId: number;
  suiteId?: number;
}

export interface TestRailSection {
  id: number;
  name: string;
  suite_id?: number;
}

export interface TestRailCase {
  id: number;
  title: string;
  section_id: number;
  refs?: string | null;
}

export interface TestRailRun {
  id: number;
  name: string;
  url: string;
  include_all: boolean;
  is_completed: boolean;
}

export interface TestRailTest {
  id: number;
  case_id: number;
}

export interface TestRailResultInput {
  case_id: number;
  status_id: number;
  comment?: string;
  defects?: string;
  elapsed?: string;
  version?: string;
}

export interface TestRailResult {
  id: number;
  test_id: number;
  status_id: number;
}

export const TESTRAIL_STATUS = {
  passed: 1,
  blocked: 2,
  untested: 3,
  retest: 4,
  failed: 5,
} as const;

type Paginated<K extends string, T> = Record<K, T[]> & { _links?: { next?: string | null } };

export class TestRailClient {
  private readonly authHeader: string;
  private readonly apiBase: string;

  constructor(private readonly config: TestRailConfig) {
    this.authHeader = basicAuthHeader(config.username, config.apiKey);
    this.apiBase = `${config.instanceUrl.replace(/\/+$/, '')}/index.php?/api/v2/`;
  }

  get projectId(): number {
    return this.config.projectId;
  }

  runUrl(runId: number): string {
    return `${this.config.instanceUrl.replace(/\/+$/, '')}/index.php?/runs/view/${runId}`;
  }

  caseUrl(caseId: number): string {
    return `${this.config.instanceUrl.replace(/\/+$/, '')}/index.php?/cases/view/${caseId}`;
  }

  async ensureSection(name: string): Promise<TestRailSection> {
    const sections = await this.getAll<'sections', TestRailSection>('sections', `get_sections/${this.config.projectId}${this.suiteParam()}`);
    const existing = sections.find((section) => section.name === name);
    if (existing) {
      return existing;
    }
    return this.post<TestRailSection>(`add_section/${this.config.projectId}`, {
      name,
      ...(this.config.suiteId ? { suite_id: this.config.suiteId } : {}),
    });
  }

  async getCasesInSection(sectionId: number): Promise<TestRailCase[]> {
    return this.getAll<'cases', TestRailCase>(
      'cases',
      `get_cases/${this.config.projectId}${this.suiteParam()}&section_id=${sectionId}`,
    );
  }

  async addCase(sectionId: number, title: string, refs?: string): Promise<TestRailCase> {
    return this.post<TestRailCase>(`add_case/${sectionId}`, { title, ...(refs ? { refs } : {}) });
  }

  async addRun(name: string, description: string, caseIds: number[]): Promise<TestRailRun> {
    return this.post<TestRailRun>(`add_run/${this.config.projectId}`, {
      name,
      description,
      include_all: false,
      case_ids: caseIds,
      ...(this.config.suiteId ? { suite_id: this.config.suiteId } : {}),
    });
  }

  async getRun(runId: number): Promise<TestRailRun> {
    return this.get<TestRailRun>(`get_run/${runId}`);
  }

  // Reusing a run (e.g. one run per CI pipeline) requires every reported case to be in it.
  async ensureRunIncludesCases(run: TestRailRun, caseIds: number[]): Promise<void> {
    if (run.include_all) {
      return;
    }
    const tests = await this.getAll<'tests', TestRailTest>('tests', `get_tests/${run.id}`);
    const existing = new Set(tests.map((test) => test.case_id));
    const missing = caseIds.filter((id) => !existing.has(id));
    if (missing.length === 0) {
      return;
    }
    await this.post(`update_run/${run.id}`, { case_ids: [...existing, ...missing] });
  }

  async addResultsForCases(runId: number, results: TestRailResultInput[]): Promise<TestRailResult[]> {
    return this.post<TestRailResult[]>(`add_results_for_cases/${runId}`, { results });
  }

  async addAttachmentToResult(resultId: number, filePath: string, contentType?: string): Promise<void> {
    await uploadFile(
      `${this.apiBase}add_attachment_to_result/${resultId}`,
      filePath,
      'attachment',
      { Authorization: this.authHeader },
      contentType,
    );
  }

  async closeRun(runId: number): Promise<void> {
    await this.post(`close_run/${runId}`, {});
  }

  private suiteParam(): string {
    return this.config.suiteId ? `&suite_id=${this.config.suiteId}` : '';
  }

  private get<T>(endpoint: string): Promise<T> {
    return requestJson<T>(`${this.apiBase}${endpoint}`, { headers: { Authorization: this.authHeader } });
  }

  private post<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    return requestJson<T>(`${this.apiBase}${endpoint}`, {
      method: 'POST',
      headers: { Authorization: this.authHeader },
      body,
    });
  }

  // TestRail >= 6.7 paginates list endpoints (250 per page); older servers return bare arrays.
  private async getAll<K extends string, T>(key: K, endpoint: string): Promise<T[]> {
    const items: T[] = [];
    let offset = 0;
    const limit = 250;
    for (;;) {
      const page = await this.get<T[] | Paginated<K, T>>(`${endpoint}&limit=${limit}&offset=${offset}`);
      if (Array.isArray(page)) {
        return page;
      }
      const chunk = page[key] ?? [];
      items.push(...chunk);
      if (!page._links?.next || chunk.length < limit) {
        return items;
      }
      offset += limit;
    }
  }
}
