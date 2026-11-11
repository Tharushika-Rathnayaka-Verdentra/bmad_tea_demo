import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, extname, join } from 'node:path';
import process from 'node:process';
import type { FullProject, TestResult, TestStep } from '@playwright/test/reporter';
import { adf, type AdfNode } from './jira-client';

/**
 * Standard defect scope raised for every failed automated test. The field order below is the
 * order the sections are rendered in Jira, so it is also the order of this interface.
 */
export interface StandardBugReport {
  bugTitle: string;
  bugDescription: string;
  prerequisites: string[];
  stepsToReproduce: ReproStep[];
  actualResult: string[];
  expectedResult: string[];
  evidence: string[];
  severity: Severity;
  priority: Priority;
  /** Rendered into Jira's Environment field, not the Description. */
  environment: BugEnvironment;
  /** Full Playwright error, rendered as a code block under "Actual Result". */
  errorDetail?: string;
}

export interface BugEnvironment {
  testedEnvironment: string;
  testedUrl: string;
  releaseNo: string;
  testedDevices: string;
  testedBrowsers: string;
}

export interface ReproStep {
  title: string;
  failed: boolean;
}

export interface EvidenceAttachment {
  name: string;
  path: string;
  contentType: string;
}

export type EvidenceKind = 'Trace' | 'Image' | 'Video';

/** An evidence file renamed to `{Bug ID}_{Story ID}_{Kind}_{failure timestamp}.{ext}`. */
export interface NamedEvidenceFile {
  kind: EvidenceKind;
  fileName: string;
  sourcePath: string;
  contentType: string;
}

const EVIDENCE_KIND_BY_ATTACHMENT: Record<string, EvidenceKind> = { trace: 'Trace', screenshot: 'Image', video: 'Video' };

/** Failure time as `yyyyMMdd_HHmmss` in local time, safe for file names on every OS. */
export function failureTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * Story the test belongs to: a `story` annotation or `@story:<id>` title tag wins, otherwise the
 * `{epic}.{story}` prefix of the plan id (`1.0-E2E-003` → `1.0`), otherwise `NA`.
 */
export function storyIdFor(test: { title: string; refs?: string; annotations: FailedTestInfo['annotations'] }): string {
  const annotated = test.annotations.find((annotation) => annotation.type === 'story')?.description?.trim();
  const tagged = test.title.match(/@story[:=]([\w.-]+)/i)?.[1];
  const fromPlanId = test.refs?.match(/^(\d+\.\d+)-/)?.[1];
  return sanitizeFileToken(annotated || tagged || fromPlanId || 'NA');
}

function sanitizeFileToken(value: string): string {
  return value.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'NA';
}

/** Assigns the standard evidence names; a second file of the same kind gets a `-2`, `-3`… suffix. */
export function nameEvidenceFiles(attachments: EvidenceAttachment[], bugId: string, storyId: string, failedAt: Date): NamedEvidenceFile[] {
  const stamp = failureTimestamp(failedAt);
  const seen = new Map<EvidenceKind, number>();
  const files: NamedEvidenceFile[] = [];
  for (const attachment of attachments) {
    const kind = EVIDENCE_KIND_BY_ATTACHMENT[attachment.name];
    if (!kind) {
      continue;
    }
    const count = (seen.get(kind) ?? 0) + 1;
    seen.set(kind, count);
    const ext = extname(attachment.path) || (kind === 'Trace' ? '.zip' : kind === 'Image' ? '.png' : '.webm');
    files.push({
      kind,
      fileName: `${sanitizeFileToken(bugId)}_${storyId}_${kind}_${stamp}${count > 1 ? `-${count}` : ''}${ext}`,
      sourcePath: attachment.path,
      contentType: attachment.contentType,
    });
  }
  return files;
}

/** Copies the renamed evidence files into `directory` and returns their new paths (same order as `files`). */
export function saveEvidenceFiles(files: NamedEvidenceFile[], directory: string): string[] {
  mkdirSync(directory, { recursive: true });
  return files.map((file) => {
    const target = join(directory, file.fileName);
    copyFileSync(file.sourcePath, target);
    return target;
  });
}

export function evidenceFileLines(files: NamedEvidenceFile[]): string[] {
  return files.map((file) => `${file.kind}: ${file.fileName} (attached to this issue; captured on the final attempt)`);
}

export type PriorityTag = 'P0' | 'P1' | 'P2' | 'P3';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
/** Jira Cloud default priority scheme names. */
export type Priority = 'Highest' | 'High' | 'Medium' | 'Low';

export interface FailedTestInfo {
  title: string;
  caseTitle: string;
  titlePath: string;
  file: string;
  line: number;
  project: string;
  attempts: number;
  error?: string;
  steps: ReproStep[];
  annotations: Array<{ type: string; description?: string }>;
  attachments: EvidenceAttachment[];
}

export interface RunEnvironment {
  baseURL?: string;
  ciRunUrl?: string;
  failedAt: string;
  projectUse?: FullProject['use'];
}

const SEVERITY_BY_TAG: Record<PriorityTag, Severity> = { P0: 'Critical', P1: 'High', P2: 'Medium', P3: 'Low' };
const PRIORITY_BY_TAG: Record<PriorityTag, Priority> = { P0: 'Highest', P1: 'High', P2: 'Medium', P3: 'Low' };
const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
const PRIORITIES: Priority[] = ['Highest', 'High', 'Medium', 'Low'];

const env = (name: string): string => (process.env[name] ?? '').trim();

/** `@p1` / `[P1]` markers in the test title drive Severity and Priority when no annotation overrides them. */
export function priorityTagFromTitle(title: string): PriorityTag | undefined {
  const match = title.match(/(?:@p|\[P)([0-3])\b/i);
  return match ? (`P${match[1]}` as PriorityTag) : undefined;
}

/**
 * Flattens Playwright's step tree into the numbered steps a human can replay. `log.step()` and
 * `test.step()` entries become steps; the one that was active when the first assertion or action
 * error happened is flagged as the failing step.
 */
export function extractReproSteps(result: TestResult | undefined): ReproStep[] {
  const steps: ReproStep[] = [];
  if (!result) {
    return steps;
  }
  let failureMarked = false;
  const markLast = (): void => {
    const last = steps.at(-1);
    if (last && !failureMarked) {
      last.failed = true;
      failureMarked = true;
    }
  };
  const hasError = (step: TestStep): boolean => Boolean(step.error) || step.steps.some(hasError);

  for (const step of result.steps) {
    if (step.category === 'hook' || step.category === 'fixture') {
      continue;
    }
    if (step.category === 'test.step') {
      steps.push({ title: step.title, failed: false });
      if (hasError(step)) {
        markLast();
      }
      continue;
    }
    if (!failureMarked && hasError(step)) {
      if (steps.length === 0) {
        steps.push({ title: step.title, failed: false });
      }
      markLast();
    }
  }
  if (!failureMarked && result.status !== 'passed' && steps.length > 0) {
    markLast();
  }
  return steps;
}

/** Pulls the matcher's "Expected …" / "Received …" lines (including indented continuations) out of a Playwright error. */
export function parseExpectation(error: string | undefined): { expected?: string; received?: string } {
  if (!error) {
    return {};
  }
  const lines = error.split('\n');
  const grab = (label: RegExp): string | undefined => {
    const start = lines.findIndex((line) => label.test(line));
    if (start < 0) {
      return undefined;
    }
    const block = [lines[start].trim()];
    for (let index = start + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.trim() || !/^\s/.test(line) || /^\s*(Expected|Received|Timeout|Call log|Locator)\b/.test(line)) {
        break;
      }
      block.push(line.trim());
    }
    return block.join(' ').replace(/\s{2,}/g, ' ');
  };
  return { expected: grab(/^Expected\b/), received: grab(/^Received\b/) };
}

function bundledBrowserVersion(browser: string): string | undefined {
  try {
    const registry = JSON.parse(readFileSync(join(dirname(require.resolve('playwright-core/package.json')), 'browsers.json'), 'utf8')) as {
      browsers?: Array<{ name: string; browserVersion?: string }>;
    };
    return registry.browsers?.find((entry) => entry.name === browser)?.browserVersion;
  } catch {
    return undefined;
  }
}

function gitShortSha(): string | undefined {
  const fromCi = env('GITHUB_SHA') || env('CI_COMMIT_SHA');
  if (fromCi) {
    return fromCi.slice(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5_000 }).toString().trim() || undefined;
  } catch {
    return undefined;
  }
}

/** `RELEASE_NO` wins; otherwise the package version plus the commit under test, e.g. `1.0.0+3df1f82`. */
export function resolveReleaseNo(): string {
  if (env('RELEASE_NO')) {
    return env('RELEASE_NO');
  }
  const version = existsSync('package.json') ? (JSON.parse(readFileSync('package.json', 'utf8')) as { version?: string }).version : undefined;
  const sha = gitShortSha();
  if (version && sha) {
    return `${version}+${sha}`;
  }
  return version ?? sha ?? 'unknown';
}

const BROWSER_LABEL: Record<string, string> = { chromium: 'Chromium', firefox: 'Firefox', webkit: 'WebKit' };
const OS_LABEL: Record<string, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };

function browserEngine(use: FullProject['use'] | undefined): string {
  return use?.browserName ?? use?.defaultBrowserType ?? 'chromium';
}

function browserVersion(use: FullProject['use'] | undefined): string | undefined {
  const uaVersion = use?.userAgent?.match(/(?:Chrome|Firefox|Version)\/(\d+(?:\.\d+)*)/)?.[1];
  return bundledBrowserVersion(browserEngine(use)) ?? uaVersion;
}

export function describeBrowser(use: FullProject['use'] | undefined): string {
  if (env('TESTED_BROWSERS')) {
    return env('TESTED_BROWSERS');
  }
  const engine = browserEngine(use);
  const version = browserVersion(use);
  return `${BROWSER_LABEL[engine] ?? engine}${version ? ` ${version}` : ''}`;
}

export function describeDevice(projectName: string, use: FullProject['use'] | undefined): string {
  if (env('TESTED_DEVICES')) {
    return env('TESTED_DEVICES');
  }
  const viewport = use?.viewport ? `${use.viewport.width}x${use.viewport.height}` : 'default viewport';
  const form = use?.isMobile ? 'mobile emulation' : 'desktop';
  const platform = `${OS_LABEL[process.platform] ?? process.platform} ${os.release()} (${process.arch})`;
  return `${projectName}: ${viewport} ${form} on ${platform}`;
}

function annotationValue<T extends string>(annotations: FailedTestInfo['annotations'], type: string, allowed: T[]): T | undefined {
  const raw = annotations.find((annotation) => annotation.type === type)?.description?.trim().toLowerCase();
  return allowed.find((value) => value.toLowerCase() === raw);
}

export function replayCommand(test: Pick<FailedTestInfo, 'file' | 'line' | 'project'>): string {
  return `npx playwright test "${test.file}:${test.line}" --project=${test.project}`;
}

const GHERKIN_KEYWORD = /^(given|when|then|and|but)\s+/i;
const stripKeyword = (title: string): string => title.replace(GHERKIN_KEYWORD, '').trim();
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Turns the recorded steps into the one-paragraph narrative that opens the Jira description:
 * the steps that passed, the expectation that did not hold, the error, and how often it reproduced.
 */
export function summarizeSteps(steps: ReproStep[], firstErrorLine: string, attempts: number): string {
  const passed = steps.filter((step) => !step.failed).map((step) => lowerFirst(stripKeyword(step.title)));
  const failed = steps.find((step) => step.failed);
  const error = firstErrorLine.replace(/^Error:\s*/, '').replace(/\.$/, '');
  const reproduced = attempts > 1 ? ` Reproduced on all ${attempts} attempts (1 run + ${attempts - 1} retries).` : '';

  const parts: string[] = [];
  if (passed.length > 0) {
    parts.push(`${capitalize(passed.join(', then '))}; `);
  }
  if (failed) {
    parts.push(`${passed.length > 0 ? 'the' : 'The'} test expected that ${lowerFirst(stripKeyword(failed.title))}, but it failed: ${error}.`);
  } else {
    parts.push(`${passed.length > 0 ? 'the' : 'The'} test failed: ${error}.`);
  }
  return `${parts.join('')}${reproduced}`;
}

export function buildBugReport(test: FailedTestInfo, run: RunEnvironment): StandardBugReport {
  const tag = priorityTagFromTitle(test.title);
  const severity = annotationValue(test.annotations, 'severity', SEVERITIES) ?? (tag ? SEVERITY_BY_TAG[tag] : 'Medium');
  const priority = annotationValue(test.annotations, 'priority', PRIORITIES) ?? (tag ? PRIORITY_BY_TAG[tag] : 'Medium');
  const failedStep = test.steps.find((step) => step.failed);
  const { expected, received } = parseExpectation(test.error);
  const firstErrorLine = test.error?.split('\n').find((line) => line.trim()) ?? 'The test failed without an error message.';
  const releaseNo = resolveReleaseNo();

  // Environment facts (URL, env, release, device, browser) live in the Jira Environment field, so they are not repeated here.
  const prerequisites = [
    `Automation checkout: run \`npm install\` and \`npx playwright install ${browserEngine(run.projectUse)}\``,
    ...test.annotations.filter((annotation) => annotation.type === 'prerequisite' && annotation.description).map((annotation) => annotation.description!),
  ];

  const stepsToReproduce = test.steps.length > 0 ? test.steps : [{ title: `Run ${replayCommand(test)}`, failed: true }];

  // Evidence files are listed once the Bug ID is known (see the reporter), since their names carry it.
  const evidence = [
    `Spec: ${test.file}:${test.line} [${test.project}] — failed on all ${test.attempts} attempts (1 run + ${test.attempts - 1} retries)`,
    `Replay locally: ${replayCommand(test)}`,
    ...(run.ciRunUrl ? [`CI run: ${run.ciRunUrl}`] : []),
  ];

  return {
    bugTitle: `[Automated] ${test.caseTitle}`,
    bugDescription: summarizeSteps(stepsToReproduce, firstErrorLine, test.attempts),
    prerequisites,
    stepsToReproduce,
    actualResult: [
      failedStep ? `Step "${failedStep.title}" did not complete: ${firstErrorLine}` : firstErrorLine,
      ...(received ? [received] : []),
    ],
    expectedResult: [
      failedStep ? `Step "${failedStep.title}" completes successfully.` : `The test "${test.caseTitle}" passes.`,
      ...(expected ? [expected] : []),
    ],
    evidence,
    severity,
    priority,
    environment: {
      testedEnvironment: env('TEST_ENV') || 'local',
      testedUrl: run.baseURL ?? 'n/a',
      releaseNo,
      testedDevices: describeDevice(test.project, run.projectUse),
      testedBrowsers: describeBrowser(run.projectUse),
    },
    errorDetail: test.error,
  };
}

/** Renders the Environment field: one line per fact. */
export function renderEnvironment(environment: BugEnvironment): AdfNode {
  return adf.doc(
    adf.bulletList([
      `Tested Environment: ${environment.testedEnvironment}`,
      `Tested URL: ${environment.testedUrl}`,
      `Release No.: ${environment.releaseNo}`,
      `Tested Devices: ${environment.testedDevices}`,
      `Tested Browsers: ${environment.testedBrowsers}`,
    ]),
  );
}

/** Renders the standard scope as the ADF document used for the Jira issue Description. It opens with the step summary (no heading); Bug Title (summary), environment facts (Environment field), Severity and Priority (issue fields) are not repeated here. */
export function renderBugReport(report: StandardBugReport): AdfNode {
  const steps = report.stepsToReproduce.map((step) => `${step.title}${step.failed ? '  ❌ (fails here)' : ''}`);
  return adf.doc(
    adf.paragraph(report.bugDescription),
    adf.heading('Pre-requisites'),
    adf.bulletList(report.prerequisites),
    adf.heading('Steps to Reproduce'),
    adf.orderedList(steps),
    adf.heading('Actual Result'),
    ...report.actualResult.map((line) => adf.paragraph(line)),
    ...(report.errorDetail ? [adf.codeBlock(report.errorDetail)] : []),
    adf.heading('Expected Result'),
    ...report.expectedResult.map((line) => adf.paragraph(line)),
    adf.heading('Evidence'),
    adf.bulletList(report.evidence),
  );
}
