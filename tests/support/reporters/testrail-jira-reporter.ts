import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { HttpError, info, warn } from './http-client';
import { adf, ATLASSIAN_TOKEN_URL, JiraAuthError, JiraClient, type JiraConfig } from './jira-client';
import { TESTRAIL_STATUS, TestRailClient, type TestRailConfig, type TestRailResultInput } from './testrail-client';

type Outcome = 'passed' | 'failed' | 'flaky' | 'skipped';

interface CollectedTest {
  key: string;
  title: string;
  caseTitle: string;
  titlePath: string;
  file: string;
  line: number;
  project: string;
  explicitCaseId?: number;
  refs?: string;
  outcome: Outcome;
  durationMs: number;
  attempts: number;
  error?: string;
  screenshot?: string;
  caseId?: number;
  jiraKey?: string;
  jiraAction?: 'created' | 'commented';
}

interface SyncManifest {
  generatedAt: string;
  baseURL?: string;
  ciRunUrl?: string;
  sync: { testrail: 'done' | 'skipped' | 'failed'; jira: 'done' | 'skipped' | 'failed' };
  summary: Record<Outcome, number>;
  testrail: { projectId?: number; suiteId?: number; sectionName: string; runId?: number; runUrl?: string };
  jira: { projectKey: string; apiBase?: string; authError?: string; issues: Array<{ key: string; url: string; action: string; test: string }> };
  tests: CollectedTest[];
}

export interface ReporterOptions {
  manifestPath?: string;
}

const env = (name: string, fallback = ''): string => (process.env[name] ?? fallback).trim();
const flag = (name: string): boolean => !['false', '0', 'no', 'off'].includes(env(name, 'true').toLowerCase());
const optIn = (name: string): boolean => ['true', '1', 'yes', 'on'].includes(env(name).toLowerCase());
const intOrUndefined = (value: string): number | undefined => (value && /^\d+$/.test(value) ? Number(value) : undefined);

const TESTRAIL_CREDENTIAL_VARS = ['TESTRAIL_INSTANCE_URL', 'TESTRAIL_USERNAME', 'TESTRAIL_API_KEY'] as const;
const SECRET_VARS = ['TESTRAIL_API_KEY', 'JIRA_API_TOKEN'] as const;

/**
 * `.env.example` is tracked, so a secret pasted there is committed (and, for Atlassian tokens,
 * revoked automatically once the commit is scanned). Report it before the first API call so the
 * resulting 401 is not mistaken for a code or configuration bug. Values are compared, never printed.
 */
export function secretHygieneWarnings(examplePath = '.env.example', environment: NodeJS.ProcessEnv = process.env): string[] {
  if (!existsSync(examplePath)) {
    return [];
  }
  const warnings: string[] = [];
  const lines = readFileSync(examplePath, 'utf8').split(/\r?\n/);
  for (const name of SECRET_VARS) {
    const line = lines.find((entry) => entry.startsWith(`${name}=`));
    const value = line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') ?? '';
    if (!value) {
      continue;
    }
    const live = (environment[name] ?? '').trim();
    if (live && value === live) {
      warnings.push(
        `${name} in ${examplePath} is the same secret that is in use now. ${examplePath} is tracked by git, so treat this credential as compromised: revoke it, create a new one, keep it only in .env or CI secrets, and blank the value in ${examplePath}.`,
      );
    } else {
      warnings.push(`${name} has a value in ${examplePath}, which is tracked by git. Keep secrets only in .env (gitignored) or CI secrets and blank this value.`);
    }
  }
  return warnings;
}

// playwright.config.ts only loads `.env`; a populated `.env.example` alone is the most common reason the sync is skipped.
function testRailSkipReason(): string {
  if (!flag('TESTRAIL_ENABLED')) {
    return 'TESTRAIL_ENABLED is false.';
  }
  const missing = TESTRAIL_CREDENTIAL_VARS.filter((name) => !env(name));
  const hint = !existsSync('.env') && existsSync('.env.example') ? ' No .env file found: copy .env.example to .env and fill in the values.' : '';
  return `missing ${missing.join(', ')}.${hint}`;
}

function loadTestRailConfig(): TestRailConfig | undefined {
  const instanceUrl = env('TESTRAIL_INSTANCE_URL');
  const username = env('TESTRAIL_USERNAME');
  const apiKey = env('TESTRAIL_API_KEY');
  if (!flag('TESTRAIL_ENABLED') || !instanceUrl || !username || !apiKey) {
    return undefined;
  }
  return {
    instanceUrl,
    username,
    apiKey,
    projectId: intOrUndefined(env('TESTRAIL_PROJECT_ID')) ?? 1,
    suiteId: intOrUndefined(env('TESTRAIL_SUITE_ID')),
  };
}

function loadJiraConfig(): JiraConfig | undefined {
  const baseUrl = env('JIRA_BASE_URL');
  const email = env('JIRA_EMAIL');
  const apiToken = env('JIRA_API_TOKEN');
  if (!flag('JIRA_ENABLED') || !baseUrl || !email || !apiToken) {
    return undefined;
  }
  return {
    baseUrl,
    email,
    apiToken,
    projectKey: env('JIRA_PROJECT_KEY', 'BMAD'),
    issueType: env('JIRA_ISSUE_TYPE', 'Bug'),
    labels: env('JIRA_LABELS', 'automated-test,playwright')
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean),
  };
}

function ciRunUrl(): string | undefined {
  if (env('CI_RUN_URL')) {
    return env('CI_RUN_URL');
  }
  if (env('GITHUB_RUN_ID')) {
    return `${env('GITHUB_SERVER_URL', 'https://github.com')}/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}`;
  }
  return undefined;
}

function defaultRunName(): string {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const ci = env('GITHUB_RUN_NUMBER') ? ` - ${env('GITHUB_WORKFLOW', 'CI')} #${env('GITHUB_RUN_NUMBER')}` : '';
  return `Playwright ${stamp} UTC${ci}`;
}

function toOutcome(test: TestCase): Outcome {
  switch (test.outcome()) {
    case 'expected':
      return 'passed';
    case 'unexpected':
      return 'failed';
    case 'flaky':
      return 'flaky';
    default:
      return 'skipped';
  }
}

function formatError(result: TestResult | undefined): string | undefined {
  const message = result?.errors.map((error) => stripAnsi(error.message ?? error.value ?? '')).filter(Boolean).join('\n\n');
  return message ? message.slice(0, 4000) : undefined;
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function toElapsed(durationMs: number): string {
  return `${Math.max(1, Math.round(durationMs / 1000))}s`;
}

export default class TestRailJiraReporter implements Reporter {
  private readonly manifestPath: string;
  private readonly sectionName = env('TESTRAIL_SECTION_NAME', 'Automation Test Suite');
  private readonly lastResults = new Map<string, TestResult>();
  private config!: FullConfig;
  private suite!: Suite;

  constructor(options: ReporterOptions = {}) {
    this.manifestPath = options.manifestPath ?? join('test-results', 'testrail-jira-sync.json');
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.lastResults.set(test.id, result);
  }

  async onEnd(_result: FullResult): Promise<{ status?: FullResult['status'] } | undefined> {
    const tests = this.collect();
    if (tests.length === 0) {
      return undefined;
    }

    const manifest: SyncManifest = {
      generatedAt: new Date().toISOString(),
      baseURL: this.config.projects[0]?.use.baseURL,
      ciRunUrl: ciRunUrl(),
      sync: { testrail: 'skipped', jira: 'skipped' },
      summary: this.summarize(tests),
      testrail: { sectionName: this.sectionName },
      jira: { projectKey: env('JIRA_PROJECT_KEY', 'BMAD'), issues: [] },
      tests,
    };

    const testRailConfig = loadTestRailConfig();
    const jiraConfig = loadJiraConfig();
    const testRail = testRailConfig ? new TestRailClient(testRailConfig) : undefined;
    const jira = jiraConfig ? new JiraClient(jiraConfig) : undefined;

    if (testRailConfig) {
      manifest.testrail.projectId = testRailConfig.projectId;
      manifest.testrail.suiteId = testRailConfig.suiteId;
    }
    if (!testRail) {
      info(`TestRail sync skipped: ${testRailSkipReason()}`);
    }
    if (!jira) {
      info('Jira defect sync skipped: set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN to enable.');
    }
    for (const warning of secretHygieneWarnings()) {
      warn(warning);
    }

    // Write early so the manifest exists for MCP-driven sync even if the API calls below fail.
    this.writeManifest(manifest);

    let runId: number | undefined;
    if (testRail) {
      try {
        runId = await this.syncCasesAndRun(testRail, tests);
        manifest.testrail.suiteId = testRail.suiteId;
        manifest.testrail.runId = runId;
        manifest.testrail.runUrl = testRail.runUrl(runId);
      } catch (error) {
        warn('TestRail case/run sync failed.', error);
        if (error instanceof HttpError && error.status === 403) {
          warn('The TestRail user needs a role that can add sections and cases (e.g. Lead) in the target project, or pin tests to existing cases with @C<id>.');
        }
        if (error instanceof HttpError && error.status === 400 && /suite_id/.test(error.body)) {
          warn('Check TESTRAIL_PROJECT_ID / TESTRAIL_SUITE_ID: the suite must belong to the project (multi-suite projects require a suite id).');
        }
        manifest.sync.testrail = 'failed';
      }
    }

    if (jira) {
      try {
        const unsynced = await this.syncDefects(jira, tests, manifest, testRail, runId);
        manifest.sync.jira = unsynced === 0 ? 'done' : 'failed';
        if (unsynced > 0) {
          warn(`${unsynced} failed test(s) have no Jira defect; marking Jira sync as failed.`);
        }
      } catch (error) {
        warn('Jira defect sync failed.', error);
        // JiraAuthError already carries the full diagnosis; a bare 401 here means the token died mid-run.
        if (error instanceof HttpError && error.status === 401) {
          warn(`Jira rejected the credentials (HTTP 401) after authentication had succeeded. Create a new token at ${ATLASSIAN_TOKEN_URL} and update JIRA_API_TOKEN in .env or the CI secret.`);
        }
        if (error instanceof JiraAuthError) {
          manifest.jira.authError = error.message;
        }
        manifest.sync.jira = 'failed';
      }
    }

    if (testRail && runId !== undefined) {
      try {
        await this.syncResults(testRail, runId, tests, manifest.ciRunUrl, jira);
        manifest.sync.testrail = 'done';
        if (optIn('TESTRAIL_CLOSE_RUN')) {
          await testRail.closeRun(runId);
        }
        info(`TestRail run updated: ${testRail.runUrl(runId)}`);
      } catch (error) {
        warn('TestRail result sync failed.', error);
        manifest.sync.testrail = 'failed';
      }
    }

    this.writeManifest(manifest);
    info(`Sync manifest written to ${this.manifestPath}`);

    // TESTRAIL_REQUIRED turns "results must land in a TestRail run" into a hard contract:
    // a green suite whose results never reached TestRail is reported as a failed run.
    if (optIn('TESTRAIL_REQUIRED') && manifest.sync.testrail !== 'done') {
      warn(`TESTRAIL_REQUIRED is set but TestRail sync status is "${manifest.sync.testrail}"; marking the run as failed.`);
      return { status: 'failed' };
    }
    return undefined;
  }

  private collect(): CollectedTest[] {
    const rootDir = this.config.rootDir;
    return this.suite.allTests().map((test) => {
      const result = this.lastResults.get(test.id);
      const project = test.parent.project()?.name ?? 'default';
      const file = relative(rootDir, test.location.file).replace(/\\/g, '/');
      // titlePath() is ['', project, file, ...describes, title]; drop the OS-specific file element
      // so the dedupe key is identical on Windows and Linux CI.
      const titleChain = test.titlePath().slice(3).join(' > ');
      const titlePath = `${file} > ${titleChain}`;
      const multiProject = this.config.projects.length > 1;
      const annotationCase = test.annotations.find((annotation) => annotation.type === 'testrail')?.description;
      const tagCase = test.title.match(/@C(\d+)\b/i)?.[1];
      const explicitCaseId = intOrUndefined((annotationCase ?? tagCase ?? '').replace(/^C/i, ''));
      const screenshot = result?.attachments.find(
        (attachment) => attachment.contentType === 'image/png' && attachment.path && existsSync(attachment.path),
      )?.path;

      return {
        key: createHash('sha1').update(`${project}|${file}|${titleChain}`).digest('hex').slice(0, 12),
        title: test.title,
        caseTitle: `${test.title.replace(/@\S+/g, '').replace(/\s{2,}/g, ' ').trim()}${multiProject ? ` [${project}]` : ''}`,
        titlePath,
        file,
        line: test.location.line,
        project,
        explicitCaseId,
        // Plan ids such as 1.0-E2E-001 or 2.3-API-004; the level token may contain digits (E2E).
        refs: test.title.match(/\b\d+\.\d+-[A-Z][A-Z0-9]*-\d+\b/)?.[0],
        outcome: toOutcome(test),
        durationMs: test.results.reduce((total, run) => total + run.duration, 0),
        attempts: test.results.length,
        error: toOutcome(test) === 'failed' ? formatError(result) : undefined,
        screenshot,
      };
    });
  }

  private summarize(tests: CollectedTest[]): Record<Outcome, number> {
    const summary: Record<Outcome, number> = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
    for (const test of tests) {
      summary[test.outcome] += 1;
    }
    return summary;
  }

  private async syncCasesAndRun(testRail: TestRailClient, tests: CollectedTest[]): Promise<number> {
    await testRail.resolveSuite(info);
    const section = await testRail.ensureSection(this.sectionName);
    const existingCases = await testRail.getCasesInSection(section.id);
    const byTitle = new Map(existingCases.map((testCase) => [testCase.title, testCase]));
    let created = 0;
    let updated = 0;

    for (const test of tests) {
      if (test.explicitCaseId) {
        test.caseId = test.explicitCaseId;
        continue;
      }
      let existing = byTitle.get(test.caseTitle);
      if (!existing) {
        existing = await testRail.addCase(section.id, test.caseTitle, test.refs);
        byTitle.set(test.caseTitle, existing);
        created += 1;
      } else if (test.refs && !existing.refs) {
        // Backfill traceability refs on cases created before the test carried a plan id.
        await testRail.updateCaseRefs(existing.id, test.refs);
        existing.refs = test.refs;
        updated += 1;
      }
      test.caseId = existing.id;
    }
    info(`TestRail cases mapped: ${tests.length} (${created} created, ${updated} refs updated in section "${this.sectionName}").`);

    const caseIds = [...new Set(tests.map((test) => test.caseId!).filter(Boolean))];
    const reuseRunId = intOrUndefined(env('TESTRAIL_RUN_ID'));
    if (reuseRunId) {
      const run = await testRail.getRun(reuseRunId);
      await testRail.ensureRunIncludesCases(run, caseIds);
      return run.id;
    }

    const description = [
      `Automated Playwright run.`,
      `Base URL: ${this.config.projects[0]?.use.baseURL ?? 'n/a'}`,
      ciRunUrl() ? `CI run: ${ciRunUrl()}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
    const run = await testRail.addRun(env('TESTRAIL_RUN_NAME') || defaultRunName(), description, caseIds);
    return run.id;
  }

  /** Returns the number of failed tests that ended up without a Jira defect. */
  private async syncDefects(
    jira: JiraClient,
    tests: CollectedTest[],
    manifest: SyncManifest,
    testRail: TestRailClient | undefined,
    runId: number | undefined,
  ): Promise<number> {
    // Verify credentials and project on every run so broken integration config is caught by green runs too.
    const me = await jira.verifyAuth();
    manifest.jira.apiBase = jira.restBase;
    if (me.viaGateway) {
      info(`Jira token is scoped; using the api.atlassian.com gateway (${jira.restBase}) for this site.`);
    }
    await jira.verifyProject();
    info(`Jira authenticated as ${me.displayName}; defects go to project ${manifest.jira.projectKey}.`);

    const failures = tests.filter((test) => test.outcome === 'failed');
    if (failures.length === 0) {
      info('No failed tests; no Jira defects raised.');
      return 0;
    }

    let unsynced = 0;
    for (const test of failures) {
      const dedupeLabel = `pw-test-${test.key}`;
      const summary = `[Automated] ${test.caseTitle}`;
      const details = [
        `Spec: ${test.file}:${test.line}`,
        `Project: ${test.project}`,
        `Attempts: ${test.attempts}`,
        `Duration: ${toElapsed(test.durationMs)}`,
        `Base URL: ${manifest.baseURL ?? 'n/a'}`,
        ...(test.caseId && testRail ? [`TestRail case: ${testRail.caseUrl(test.caseId)}`] : []),
        ...(runId && testRail ? [`TestRail run: ${testRail.runUrl(runId)}`] : []),
        ...(manifest.ciRunUrl ? [`CI run: ${manifest.ciRunUrl}`] : []),
      ];
      const errorBlock = adf.codeBlock(test.error ?? '');

      try {
        const existing = await jira.findOpenIssueByLabel(dedupeLabel);
        if (existing) {
          await jira.addComment(
            existing.key,
            adf.doc(adf.paragraph(`Automated test failed again on ${manifest.generatedAt}.`), adf.bulletList(details), errorBlock),
          );
          test.jiraKey = existing.key;
          test.jiraAction = 'commented';
        } else {
          const issue = await jira.createIssue(
            summary,
            adf.doc(
              adf.paragraph(`The automated Playwright test "${test.titlePath}" failed.`),
              adf.heading('Context'),
              adf.bulletList(details),
              adf.heading('Error'),
              errorBlock,
            ),
            [dedupeLabel],
          );
          test.jiraKey = issue.key;
          test.jiraAction = 'created';
        }
        if (test.screenshot) {
          await jira.addAttachment(test.jiraKey, test.screenshot, 'image/png').catch((error) => warn(`Screenshot upload to ${test.jiraKey} failed.`, error));
        }
        manifest.jira.issues.push({ key: test.jiraKey, url: jira.issueUrl(test.jiraKey), action: test.jiraAction, test: test.caseTitle });
        info(`Jira ${test.jiraAction}: ${jira.issueUrl(test.jiraKey)} for "${test.caseTitle}"`);
      } catch (error) {
        unsynced += 1;
        warn(`Jira defect handling failed for "${test.caseTitle}".`, error);
      }
    }
    return unsynced;
  }

  private async syncResults(
    testRail: TestRailClient,
    runId: number,
    tests: CollectedTest[],
    ciUrl: string | undefined,
    jira: JiraClient | undefined,
  ): Promise<void> {
    const skippedStatus = intOrUndefined(env('TESTRAIL_SKIPPED_STATUS_ID'));
    const flakyStatus = intOrUndefined(env('TESTRAIL_FLAKY_STATUS_ID')) ?? TESTRAIL_STATUS.retest;
    const statusFor: Record<Outcome, number | undefined> = {
      passed: TESTRAIL_STATUS.passed,
      failed: TESTRAIL_STATUS.failed,
      flaky: flakyStatus,
      skipped: skippedStatus,
    };

    const reportable = tests.filter((test) => test.caseId && statusFor[test.outcome] !== undefined);
    if (reportable.length === 0) {
      return;
    }

    const results: TestRailResultInput[] = reportable.map((test) => ({
      case_id: test.caseId!,
      status_id: statusFor[test.outcome]!,
      elapsed: toElapsed(test.durationMs),
      defects: test.jiraKey,
      comment: [
        `Outcome: ${test.outcome}${test.outcome === 'flaky' ? ` (passed after ${test.attempts - 1} retr${test.attempts === 2 ? 'y' : 'ies'})` : ''}`,
        `Spec: ${test.file}:${test.line} [${test.project}]`,
        ciUrl ? `CI run: ${ciUrl}` : undefined,
        test.jiraKey && jira ? `Jira: ${jira.issueUrl(test.jiraKey)}` : undefined,
        test.error ? `\n${test.error}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    }));

    const posted = await testRail.addResultsForCases(runId, results);
    info(`TestRail results posted: ${posted.length}.`);

    // add_results_for_cases returns results in request order, which lets screenshots follow their result.
    await Promise.all(
      reportable.map(async (test, index) => {
        const resultId = posted[index]?.id;
        if (test.outcome === 'failed' && test.screenshot && resultId) {
          await testRail.addAttachmentToResult(resultId, test.screenshot, 'image/png').catch((error) => warn(`Screenshot upload for case C${test.caseId} failed.`, error));
        }
      }),
    );
  }

  private writeManifest(manifest: SyncManifest): void {
    mkdirSync(dirname(this.manifestPath), { recursive: true });
    writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));
  }
}
