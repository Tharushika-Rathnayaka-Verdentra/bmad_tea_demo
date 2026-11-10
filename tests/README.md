# Playwright Tests

## Setup

Use Node.js 26 and install dependencies with `npm install`. Install the browser once with `npx playwright install chromium`. Copy `.env.example` to `.env` only when overriding the default target URL.

The default `BASE_URL` is `https://todomvc.com/examples/react/dist/`. The root `playwright.config.ts` reads `BASE_URL` from the process environment; `TEST_ENV` and `API_URL` are reserved for later environment-specific setup.

## Running

- `npm run test:e2e` runs the suite headlessly.
- `npm run test:e2e:headed` runs with a visible browser.
- `npm run test:e2e:debug` opens Playwright Inspector.
- `npx playwright show-report` opens the latest HTML report.

The config writes HTML output to `playwright-report/`, JUnit XML and failure artifacts to `test-results/`.

## Structure

- `tests/e2e/` contains browser journeys.
- `tests/api/` contains request-level availability checks.
- `tests/support/merged-fixtures.ts` is the single test import for Playwright and `@seontechnologies/playwright-utils` fixtures.
- `tests/support/factories/` contains data factories.

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
- **report** merges the shard blobs into the HTML and JUnit reports defined in `playwright.config.ts`, uploads them as `playwright-report` and `junit-results` (30-day retention), and fails if any shard failed.

The config already sets `forbidOnly`, `retries: 2`, and `workers: 1` when `CI` is set. No secrets are required; `BASE_URL` defaults to the public TodoMVC site. Override it with a repository variable or workflow `env` entry when pointing at another environment.

Local parity:

```sh
npm run test:ci -- --shard=1/2      # one shard, blob + list reporters -> blob-report/
npm run test:ci:merge -- blob-report # html -> playwright-report/, junit -> test-results/junit.xml
npm run test:burn-in -- tests/e2e/todomvc.spec.ts
```

Shard count is set in the workflow `SHARD_TOTAL` env and matrix; raise both together as the suite grows.

## Knowledge References

- Playwright configuration guardrails
- Playwright Utils integration and fixture composition
- Data factories and API-first setup
- Network-first safeguards