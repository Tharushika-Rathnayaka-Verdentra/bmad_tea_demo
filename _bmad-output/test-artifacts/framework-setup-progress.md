---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework', 'step-03-scaffold-framework', 'step-04-docs-and-scripts', 'step-05-validate-and-summary']
lastStep: 'step-05-validate-and-summary'
lastSaved: '2026-11-10'
---

# Framework Setup

## Preflight

- Detected scope: frontend browser E2E harness for the supplied external React TodoMVC app.
- Existing project: minimal npm package, Node.js 26.13.0; no existing E2E framework or local app bundler.
- Selection: Playwright Test with TypeScript, as requested.

## Scaffold

- Added root Playwright configuration with Chromium, the TodoMVC base URL, HTML/JUnit/list reporters, failure artifacts, and standard timeouts.
- Added merged Playwright Utils fixtures, an inactive auth provider, a Todo factory, a UI example, and a root-document availability example.
- Added npm scripts, TypeScript settings, `.env.example`, `.nvmrc`, `.gitignore`, and `tests/README.md`.
- CI files were not created in the initial scaffold. The Claude Code write-time hook was not installed because this setup runs in VS Code/Copilot.
- The TodoMVC app exposes no documented API or authentication path; no application API routes or interception targets were invented.

## Validation

- Dependency installation and root dependency resolution succeeded; Playwright CLI reports version 1.65.0.
- `npx tsc --noEmit` passed.
- `npx playwright test --list` discovered both starter specs.
- `npm run test:e2e` passed: 2 tests on Chromium.
- HTML report and JUnit XML were generated.

## CI (edit, 2026-11-10)

- Platform: GitHub Actions, gating `master`. Added `.github/workflows/e2e-tests.yml` and composite action `.github/actions/setup-playwright/action.yml`.
- Triggers: pull requests to `master`, pushes to `master`, nightly cron at 02:00 UTC, manual dispatch. Concurrency cancels superseded PR runs. Permissions limited to `contents: read`.
- Jobs: `burn-in` (PR only, changed `tests/**/*.spec.ts` x5 with `--retries=0`), `e2e` (2 shards, `fail-fast: false`, blob reporter), `report` (merges blobs into HTML + JUnit via `playwright.config.ts`, 30-day artifacts, fails on any shard failure).
- Caching: npm via `actions/setup-node`; Chromium via `actions/cache` keyed on the installed `@playwright/test` version.
- Security: PR SHAs pass through `env:` before use in `run:`; changed spec paths are read from a file into a bash array, never interpolated into a command string.
- Scripts added: `test:ci`, `test:ci:merge`, `test:burn-in`. `.gitignore` now covers `blob-report/` and `all-blob-reports/`. `tests/README.md` gained a CI section.
- Sharding at 4 tests was requested; it is not needed for speed yet, but the merge path is in place for growth.
- Validation: both shards ran locally with `CI=true`; `merge-reports --config` produced a single JUnit (4 tests) and HTML report; burn-in flags expand 2 tests to 10; both YAML files parse.
- Known pre-existing failure: `tests/api/users.spec.ts` requests `/api/users` on todomvc.com and receives 404. It was not part of the original scaffold and will fail the first pipeline run until it is fixed or removed.

## TestRail + Jira + MCP (edit, 2026-11-10)

- Mode: Edit. Decisions confirmed with the user: hybrid sync (code reporter for CI + MCP servers for the agent), case mapping by title with auto-create and `@C123` override, TestRail project 1, Jira project `BMAD` with dedupe, TestRail MCP server `@uarlouski/testrail-mcp-server`.
- Added `tests/support/reporters/` — `http-client.ts` (fetch/multipart helpers, no new dependencies), `testrail-client.ts` (API v2: sections, cases, runs, results, attachments, pagination), `jira-client.ts` (Cloud REST v3, ADF, `/search/jql`, attachments), `testrail-jira-reporter.ts` (Playwright `Reporter`).
- Reporter behaviour: always writes `test-results/testrail-jira-sync.json`; with credentials it ensures the section, maps/creates cases, creates or reuses a run, raises or comments on a Jira Bug per failed test (label `pw-test-<sha1 of project|file|title chain>`, OS-independent), posts results with the Jira key in `defects`, attaches failure screenshots to both systems. Flaky → Retest, skipped → untested by default. Never throws; sync state recorded in the manifest.
- `playwright.config.ts` registers the reporter. `.env.example` documents all `TESTRAIL_*`, `JIRA_*` and `CI_RUN_URL` variables; names match the TestRail MCP server.
- `.vscode/mcp.json`: `playwright` (`@playwright/mcp`), `testrail` (`@uarlouski/testrail-mcp-server`, secrets via VS Code `inputs`), `atlassian` (`https://mcp.atlassian.com/v2/mcp`, OAuth).
- CI: the `report` job's merge step receives TestRail/Jira secrets and vars; `JIRA_ENABLED` is false on pull requests; the manifest is uploaded as `testrail-jira-sync` and the step summary shows the run URL and defect keys.
- `tests/README.md` gained "TestRail and Jira reporting" and "MCP servers for the BMad TEA agent" sections.
- Validation: `npx tsc --noEmit` passed; `npm run test:e2e` passed (3 tests) with the reporter in skip mode writing the manifest; a local mock of both APIs confirmed the full path — existing case reused by title, `@C42` override honoured, 3 cases created, run created, Jira search → create → attachment, results posted with `defects`, screenshot attached to the failed result only. Temporary spec and mock were removed.
- Not done: no live TestRail/Jira instance was available, so credentials and the MCP OAuth sign-in remain for the user. The `test:burn-in` script still points at `tests/playwright.config.ts`, which does not exist (pre-existing).