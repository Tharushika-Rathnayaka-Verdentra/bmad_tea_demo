# Playwright Tests

## Setup

Use Node.js 26 and install dependencies with `npm install`. Install the browser once with `npx playwright install chromium`. Copy `.env.example` to `.env` to override the default target URL or to enable TestRail/Jira reporting; `playwright.config.ts` loads only `.env`, so values left in `.env.example` are never read. `.env` is gitignored — keep API keys there and never in `.env.example`.

The default `BASE_URL` is `https://todomvc.com/examples/react/dist/`. The root `playwright.config.ts` reads `BASE_URL` from the process environment; `TEST_ENV` and `API_URL` are reserved for later environment-specific setup.

## Running

- `npm run test:e2e` runs the suite headlessly.
- `npm run test:e2e:headed` runs with a visible browser.
- `npm run test:e2e:debug` opens Playwright Inspector.
- `npx playwright show-report` opens the latest HTML report.

The config writes HTML output to `playwright-report/`, JUnit XML, failure artifacts and the TestRail/Jira sync manifest to `test-results/`.

## Structure

- `tests/e2e/` contains browser journeys.
- `tests/api/` contains request-level availability checks.
- `tests/support/merged-fixtures.ts` is the single test import for Playwright and `@seontechnologies/playwright-utils` fixtures.
- `tests/support/factories/` contains data factories.
- `tests/support/reporters/` contains the TestRail + Jira reporter and its REST clients.

The TodoMVC UI has no documented app API or authentication flow. Its example uses accessible roles and names because the live app does not expose test IDs. The request-level example checks only the supplied root URL; no API endpoint or network interception behavior is assumed.

## Conventions

Keep tests isolated, use web-first locator assertions, and avoid fixed waits. Interceptors should be declared before navigation when a real app request is under test. Use a project-owned test ID only when the application exposes one.

The auth fixture is inactive unless a test requests `authToken`; its provider intentionally throws because TodoMVC has no authentication configured. Set up an application-specific provider before using authenticated tests.

This VS Code/Copilot environment does not provide the Claude Code write-time hook used by the TEA workflow; run the test-review workflow to assess test-quality rules.

## CI

`.github/workflows/e2e-tests.yml` runs on pull requests to `master`, pushes to `master`, nightly at 02:00 UTC, and on manual dispatch. `.github/actions/setup-playwright` installs Node.js from `.nvmrc`, runs `npm ci`, and caches Chromium keyed by the installed Playwright version.

Jobs:

- **burn-in** (pull requests only) diffs the PR against its base, and runs any added or modified `tests/**/*.spec.ts` five times with retries disabled via `npm run test:burn-in`. It is skipped when no spec changed.
- **e2e** runs the full suite in two shards with `fail-fast: false`, using the blob reporter so results can be merged.
- **report** merges the shard blobs into the HTML and JUnit reports defined in `playwright.config.ts`, verifies the TestRail/Jira sync manifest (see below), uploads the reports as `playwright-report` and `junit-results` (30-day retention), and fails if any shard failed.

The config already sets `forbidOnly`, `retries: 2`, and `workers: 1` when `CI` is set. No secrets are required; `BASE_URL` defaults to the public TodoMVC site. Override it with a repository variable or workflow `env` entry when pointing at another environment.

Local parity:

```sh
npm run test:ci -- --shard=1/2      # one shard, blob + list reporters -> blob-report/
npm run test:ci:merge -- blob-report # html -> playwright-report/, junit -> test-results/junit.xml
npm run test:burn-in -- tests/e2e/todomvc.spec.ts
```

Shard count is set in the workflow `SHARD_TOTAL` env and matrix; raise both together as the suite grows.

## TestRail and Jira reporting

`tests/support/reporters/testrail-jira-reporter.ts` is registered in `playwright.config.ts`. After every run it:

1. Writes `test-results/testrail-jira-sync.json` — a manifest of every test's outcome, error, screenshot path, TestRail case/run ids and Jira keys. This is always written, even without credentials.
2. When TestRail credentials are set, ensures the section `TESTRAIL_SECTION_NAME` exists in project `TESTRAIL_PROJECT_ID`, looks up each test case by its cleaned title and **creates missing cases**, creates a run (or reuses `TESTRAIL_RUN_ID`), and posts results: passed → Passed, failed → Failed, flaky → Retest (`TESTRAIL_FLAKY_STATUS_ID`), skipped → untested unless `TESTRAIL_SKIPPED_STATUS_ID` is set. Failure screenshots are attached to the result.
3. When Jira credentials are set, first verifies them (`GET /myself`) and that `JIRA_PROJECT_KEY` is visible to that user, then **raises a `JIRA_ISSUE_TYPE` in `JIRA_PROJECT_KEY` for each failed test**. Each test carries a stable label (`pw-test-<hash>`); if an open issue with that label already exists the reporter comments on it instead of creating a duplicate. The Jira key is written into the TestRail result's `defects` field. `sync.jira` is `done` only when every failed test ended up with a Jira key; a rejected token (HTTP 401), an unknown project or any defect that could not be created marks it `failed`.

Credentials come from `.env` locally (see `.env.example`) or from repository secrets in CI. Variable names match the TestRail MCP server, so one `.env` configures both. `JIRA_BASE_URL` is the Jira site URL (for example `https://your-site.atlassian.net`), not the Atlassian MCP endpoint. `JIRA_PROJECT_KEY` is the short project **key** shown in issue keys (`SCRUM` for `SCRUM-12`), not the project name — Jira Cloud answers JQL for anonymous callers, so a wrong key or a revoked token used to surface only as a misleading HTTP 400 on issue creation; the reporter now fails the Jira sync up front instead. The TestRail user must hold a role that can add sections and cases in the target project (the default **Tester** role cannot; **Lead** can) — otherwise the sync fails with HTTP 403 on `add_section`/`add_case`. `TESTRAIL_SECTION_NAME` is a *section* inside project `TESTRAIL_PROJECT_ID`, not the project name; it is created on first use. `TESTRAIL_SUITE_ID` must be a suite **of that project** (TestRail → project → Test Suites, or `get_suites/<project id>`): the reporter validates it before syncing, falls back to the project's only suite when the id is wrong or unset in a multi-suite project, and otherwise fails with the list of valid suite ids instead of TestRail's opaque `Field :suite_id is not a valid test suite` 400.

**Jira API tokens.** `JIRA_EMAIL` must be the email of the Atlassian account that owns the token (`JIRA_EMAIL:JIRA_API_TOKEN` is sent as HTTP Basic auth; a valid token paired with another account's email is a plain HTTP 401). Create one at <https://id.atlassian.com/manage-profile/security/api-tokens> while signed in as `JIRA_EMAIL`; tokens expire on the date chosen at creation. Both classic (unscoped) tokens and *API tokens with scopes* work: scoped tokens are rejected by `<site>.atlassian.net` with HTTP 401, so when the site rejects the token the reporter resolves the site's `cloudId` (`/_edge/tenant_info`) and retries through `https://api.atlassian.com/ex/jira/<cloudId>`, then uses that gateway for every call in the run (`jira.apiBase` in the manifest shows which one was used). A scoped token needs `read:jira-user`, `read:jira-work` and `write:jira-work`. If **both** endpoints answer 401 the token itself is dead — revoked, expired, or minted under a different Atlassian account than `JIRA_EMAIL` — and the reporter says so (`[testrail-jira-reporter] Jira rejected the API token for … HTTP 401 from both …`), including whether the value is malformed (quotes, whitespace, truncated, not an `ATATT…` token) or well-formed. The fix is always a new token in `.env` / the CI secret; no code change can revive a revoked one. Secrets belong in `.env` (gitignored) or CI secrets only: `.env.example` is tracked, Atlassian revokes any token that appears in a commit, and the reporter warns at startup when `.env.example` carries a `TESTRAIL_API_KEY` or `JIRA_API_TOKEN` value — loudly when that value is the one currently in use.

By default the reporter never fails the test run: sync errors are logged with a `[testrail-jira-reporter]` prefix and recorded in the manifest's `sync` block. Set `TESTRAIL_REQUIRED=true` to make results landing in a TestRail run a hard contract — the Playwright run then exits non-zero whenever `sync.testrail` is not `done` (credentials missing, `TESTRAIL_ENABLED=false`, or an API error). In CI, the `report` job's "Verify TestRail/Jira sync succeeded" step reads the manifest's `sync` block and fails the job when credentials for a system were supplied but its sync did not end in `done`, so a broken integration cannot hide behind a green run.

Case mapping: the default is lookup-by-title with auto-create. Pin a test to an existing case by putting `@C123` in its title or adding `test.info().annotations.push({ type: 'testrail', description: 'C123' })`. `@tags` are stripped from the case title; a test id such as `1.0-E2E-001` is copied into the case `refs` field, and backfilled onto existing cases whose `refs` is empty.

In CI the reporter runs once, in the `report` job, over the merged shard results. Shards use the blob reporter and burn-in has no secrets, so neither pushes to TestRail. Pull requests report results to TestRail but do not raise Jira defects (`JIRA_ENABLED` is false for `pull_request` events); change that expression in `.github/workflows/e2e-tests.yml` if PR failures should also file bugs. Required secrets: `TESTRAIL_INSTANCE_URL`, `TESTRAIL_USERNAME`, `TESTRAIL_API_KEY`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`. Optional repository variables: `TESTRAIL_PROJECT_ID`, `TESTRAIL_SUITE_ID`, `TESTRAIL_SECTION_NAME`, `JIRA_PROJECT_KEY`.

Jira support targets Jira Cloud (REST v3, ADF payloads, `/search/jql`).

## MCP servers for the BMad TEA agent

`.vscode/mcp.json` connects the agent to the same tool chain the reporter uses:

| Stack | MCP server | Transport | Auth |
| --- | --- | --- | --- |
| Playwright | `@playwright/mcp` (pinned) | stdio via `npx` | none |
| TestRail | `@uarlouski/testrail-mcp-server` | stdio via `npx` | prompted on first start (`TESTRAIL_INSTANCE_URL`, `TESTRAIL_USERNAME`, `TESTRAIL_API_KEY`); the API key is stored by VS Code as a secret, not in the file |
| Jira | Atlassian Rovo MCP Server `https://mcp.atlassian.com/v2/mcp` | HTTP | OAuth 2.1 sign-in in the browser |

Start the servers from the VS Code MCP view (or accept the prompt when the workspace opens), then sign in to Atlassian when asked. With the servers running, the TEA agent can:

- run or debug a journey interactively through the Playwright MCP server, then run `npm run test:e2e` to produce the manifest;
- read `test-results/testrail-jira-sync.json` and, if `sync.testrail` or `sync.jira` is `skipped` or `failed`, push the cases and results to TestRail or raise the defects through the TestRail and Atlassian servers;
- triage an existing run: open the TestRail run, inspect the failed results, and update or transition the linked `BMAD-*` issues in Jira.

The reporter is the unattended path (CI); the MCP servers are the interactive path. Both write to the same TestRail section and Jira project, so keep `TESTRAIL_PROJECT_ID`, `TESTRAIL_SECTION_NAME` and `JIRA_PROJECT_KEY` aligned between `.env` and the agent's instructions.

## Knowledge References

- Playwright configuration guardrails
- Playwright Utils integration and fixture composition
- Data factories and API-first setup
- Network-first safeguards