import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { HttpError, info, warn } from './http-client';
import {
  buildBugReport,
  evidenceFileLines,
  extractReproSteps,
  nameEvidenceFiles,
  renderBugReport,
  renderEnvironment,
  saveEvidenceFiles,
  storyIdFor,
  type EvidenceAttachment,
  type EvidenceKind,
  type ReproStep,
  type StandardBugReport,
} from './bug-report';
import { ATLASSIAN_TOKEN_URL, JiraAuthError, JiraClient, type JiraConfig } from './jira-client';
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
  /** ISO time the final attempt failed; drives the evidence file timestamp. */
  failedAt?: string;
  steps: ReproStep[];
  annotations: Array<{ type: string; description?: string }>;
  attachments: EvidenceAttachment[];
  /** Evidence saved as `{Bug ID}_{Story ID}_{Kind}_{timestamp}` once the Jira key is known. */
  evidenceFiles?: Array<{ kind: EvidenceKind; fileName: string; path: string }>;
  /** Standard bug scope; present for failed tests only so MCP-driven sync can file the same report. */
  bugReport?: StandardBugReport;
  caseId?: number;
  jiraKey?: string;
  jiraAction?: 'created' | 'updated';
}

interface SyncManifest {
  generatedAt: string;
  baseURL?: string;
  ciRunUrl?: string;
  sync: { testrail: 'done' | 'skipped' | 'failed'; jira: 'done' | 'skipped' | 'failed' };
  summary: Record<Outcome, number>;
  testrail: { projectId?: number; suiteId?: number; sectionName: string; runId?: number; runUrl?: string };
  jira: {
    projectKey: string;
    apiBase?: string;
    authError?: string;
    issues: Array<{ key: string; url: string; action: string; test: string; severity: string; priority: string }>;
  };
  tests: CollectedTest[];
}

export interface ReporterOptions {
  manifestPath?: string;
  /** Where renamed evidence copies are written; defaults to `test-results/evidence`. */
  evidenceDir?: string;
}

const env = (name: string, fallback = ''): string => (process.env[name] ?? fallback).trim();
const flag = (name: string): boolean => !['false', '0', 'no', 'off'].includes(env(name, 'true').toLowerCase());
const optIn = (name: string): boolean => ['true', '1', 'yes', 'on'].includes(env(name).toLowerCase());
const intOrUndefined = (value: string): number | undefined => (value && /^\d+$/.test(value) ? Number(value) : undefined);

const TESTRAIL_CREDENTIAL_VARS = ['TESTRAIL_INSTANCE_URL', 'TESTRAIL_USERNAME', 'TESTRAIL_API_KEY'] as const;
/** First run + 3 retries must all fail before a defect is raised. */
const DEFAULT_MIN_FAILED_ATTEMPTS = 4;
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
  private readonly evidenceDir: string;
  private readonly sectionName = env('TESTRAIL_SECTION_NAME', 'Automation Test Suite');
  private readonly lastResults = new Map<string, TestResult>();
  private config!: FullConfig;
  private suite!: Suite;

  constructor(options: ReporterOptions = {}) {
    this.manifestPath = options.manifestPath ?? join('test-results', 'testrail-jira-sync.json');
    this.evidenceDir = options.evidenceDir ?? join('test-results', 'evidence');
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

    const generatedAt = new Date().toISOString();
    const baseURL = this.config.projects[0]?.use.baseURL;
    const runUrl = ciRunUrl();
    for (const test of tests.filter((entry) => entry.outcome === 'failed')) {
      test.bugReport = buildBugReport(test, {
        baseURL,
        ciRunUrl: runUrl,
        failedAt: generatedAt,
        projectUse: this.config.projects.find((project) => project.name === test.project)?.use,
      });
    }

    const manifest: SyncManifest = {
      generatedAt,
      baseURL,
      ciRunUrl: runUrl,
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
      type Attachment = TestResult['attachments'][number];
      const hasFile = (attachment: Attachment): attachment is Attachment & { path: string } =>
        Boolean(attachment.path && existsSync(attachment.path));
      const toEvidence = (attachment: Attachment & { path: string }): EvidenceAttachment => ({
        name: attachment.name,
        path: attachment.path,
        contentType: attachment.contentType,
      });
      const attachments: EvidenceAttachment[] = (result?.attachments ?? [])
        .filter(hasFile)
        .filter((attachment) => ['screenshot', 'trace', 'video'].includes(attachment.name))
        .map(toEvidence);
      // With `video: 'on-first-retry'` only the first retry records; borrow its video when the final attempt has none.
      if (!attachments.some((attachment) => attachment.name === 'video')) {
        const video = [...test.results]
          .reverse()
          .flatMap((run) => run.attachments)
          .filter(hasFile)
          .find((attachment) => attachment.name === 'video');
        if (video) attachments.push(toEvidence(video));
      }

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
        failedAt: result ? new Date(result.startTime.getTime() + result.duration).toISOString() : undefined,
        steps: extractReproSteps(result),
        annotations: test.annotations.map((annotation) => ({ type: annotation.type, description: annotation.description })),
        attachments,
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

    // Playwright marks a test "failed" only when every attempt (first run + retries) failed; a pass on
    // any retry yields "flaky", which never raises a defect. The threshold additionally guards against
    // runs executed with fewer retries than the policy requires (e.g. `--retries=0`).
    const minAttempts = intOrUndefined(env('JIRA_MIN_FAILED_ATTEMPTS')) ?? DEFAULT_MIN_FAILED_ATTEMPTS;
    const allFailed = tests.filter((test) => test.outcome === 'failed');
    const failures = allFailed.filter((test) => test.attempts >= minAttempts);
    for (const test of allFailed.filter((test) => test.attempts < minAttempts)) {
      info(`No Jira defect for "${test.caseTitle}": it failed ${test.attempts} time(s) but ${minAttempts} consecutive failures are required (set retries to ${minAttempts - 1} or adjust JIRA_MIN_FAILED_ATTEMPTS).`);
    }
    const flaky = tests.filter((test) => test.outcome === 'flaky');
    if (flaky.length > 0) {
      info(`${flaky.length} test(s) passed on retry and are reported as flaky; no Jira defects raised for them.`);
    }
    if (failures.length === 0) {
      info('No tests failed on every attempt; no Jira defects raised.');
      return 0;
    }

    let unsynced = 0;
    for (const test of failures) {
      const dedupeLabel = `pw-test-${test.key}`;
      const report = test.bugReport!;
      // TestRail ids are only known after the case/run sync, so they join the evidence here.
      report.evidence.push(
        ...(test.caseId && testRail ? [`TestRail case: ${testRail.caseUrl(test.caseId)}`] : []),
        ...(runId && testRail ? [`TestRail run: ${testRail.runUrl(runId)}`] : []),
      );

      try {
        const existing = await jira.findOpenIssueByLabel(dedupeLabel);
        const issueFields = {
          summary: report.bugTitle,
          description: renderBugReport(report),
          environment: renderEnvironment(report.environment),
          extraLabels: [dedupeLabel, `severity-${report.severity.toLowerCase()}`],
          priority: report.priority,
          severity: report.severity,
        };
        if (!existing) {
          test.jiraKey = (await jira.createIssue(issueFields)).key;
          test.jiraAction = 'created';
        } else {
          test.jiraKey = existing.key;
          test.jiraAction = 'updated';
        }

        // Evidence names carry the Bug ID, so they are assigned (and the files saved) only now.
        const storyId = storyIdFor(test);
        const files = nameEvidenceFiles(test.attachments, test.jiraKey, storyId, new Date(test.failedAt ?? manifest.generatedAt));
        const savedPaths = saveEvidenceFiles(files, this.evidenceDir);
        test.evidenceFiles = files.map((file, index) => ({ kind: file.kind, fileName: file.fileName, path: savedPaths[index] }));
        report.evidence.unshift(...evidenceFileLines(files));
        const description = renderBugReport(report);

        if (existing) {
          // Keep the report in the Description (not a comment) so the issue always shows the latest failure.
          await jira.updateIssue(existing.key, { ...issueFields, description });
        } else if (files.length > 0) {
          await jira.updateDescription(test.jiraKey, description);
        }
        for (const [index, file] of files.entries()) {
          await jira
            .addAttachment(test.jiraKey, savedPaths[index], file.contentType, file.fileName)
            .catch((error) => warn(`${file.kind} upload (${file.fileName}) to ${test.jiraKey} failed.`, error));
        }
        manifest.jira.issues.push({
          key: test.jiraKey,
          url: jira.issueUrl(test.jiraKey),
          action: test.jiraAction,
          test: test.caseTitle,
          severity: report.severity,
          priority: report.priority,
        });
        info(`Jira ${test.jiraAction}: ${jira.issueUrl(test.jiraKey)} for "${test.caseTitle}" (severity ${report.severity}, priority ${report.priority}; evidence: ${files.map((file) => file.fileName).join(', ') || 'none'})`);
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
        const image = test.evidenceFiles?.find((file) => file.kind === 'Image')?.path ?? test.screenshot;
        if (test.outcome === 'failed' && image && resultId) {
          await testRail.addAttachmentToResult(resultId, image, 'image/png').catch((error) => warn(`Screenshot upload for case C${test.caseId} failed.`, error));
        }
      }),
    );
  }

  private writeManifest(manifest: SyncManifest): void {
    mkdirSync(dirname(this.manifestPath), { recursive: true });
    writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));
  }
}
