---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-11-11'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/test-artifacts/test-design-epic-1.md'
  - 'package.json'
  - 'playwright.config.ts'
  - 'tests/e2e/todomvc.spec.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/factories/todo-factory.ts'
  - 'tests/support/reporters/testrail-jira-reporter.ts'
  - 'tests/support/reporters/testrail-client.ts'
  - '.env.example'
  - '.github/workflows/e2e-tests.yml'
  - 'test-results/testrail-jira-sync.json'
  - 'tests/support/auth-fixture.ts'
  - 'tests/support/todo-app-fixture.ts'
  - 'tests/api/site-availability.spec.ts'
  - '_bmad-output/test-artifacts/test-review.md'
---

# Test Automation: Epic 1 P0/P1

## Preflight and Context

- Mode: BMad-integrated, using the Epic 1 test design.
- Framework: Playwright Test with TypeScript; root config and dependencies are present.
- Target: `https://todomvc.com/examples/react/dist/` via the configured `BASE_URL`.
- Scope: the plan has no P0 scenarios and two P1 scenarios: `1.0-E2E-001` todo creation and `1.0-E2E-002` completion plus All/Active/Completed filter membership.
- Excluded: P2 deletion and target-availability check, because the request is limited to P0/P1 scenarios.
- Integration: `tea_use_playwright_utils` is true and the package is installed. Generated specs will import `test`, `expect`, and `log` from `tests/support/merged-fixtures.ts`; no unsupported API routes, interception needs, or auth flow are assumed.
- Existing coverage: `tests/e2e/todomvc.spec.ts` currently combines create and complete, but does not assert filter membership. It will be refocused as the create scenario; a separate mixed-state P1 filter scenario will be added.
- Browser exploration: shared-browser observations from the Epic 1 design confirmed the accessible textbox, filters, and checkbox behavior; temporary data was removed. `playwright-cli` is unavailable.
- Knowledge loaded: test levels, priorities, factories, selective execution, CI/burn-in, test quality, Playwright Utils mandate and utility references, fixture composition, network-first principles, and Playwright CLI guidance.

## Identified Targets

No ATDD output exists for Epic 1. The test design is the source of scope.

| Test ID | Priority | Level | Target |
| --- | --- | --- | --- |
| 1.0-E2E-001 | P1 | E2E | Create a unique todo; assert one visible row with an unchecked checkbox. |
| 1.0-E2E-002 | P1 | E2E | Create one active and one completed todo; assert membership in All, Active, and Completed, including completion state. |

No P0 cases are defined in the plan. P2 deletion and target-availability coverage are intentionally excluded by the request. Use role/name locators observed in the live app, Faker-generated titles, independent Playwright contexts, and web-first assertions. No API interception or auth setup is warranted for this client-side UI scope.

## Generated Tests

- Updated `tests/e2e/todomvc.spec.ts` with two P1 browser scenarios:
  - `1.0-E2E-001`: create a unique todo and assert exactly one matching row with an unchecked checkbox.
  - `1.0-E2E-002`: create one active and one completed todo; assert All shows both, Active shows only the active item, and Completed shows only the completed item.
- Priority tags include both `@p1` for selection and `[P1]` plus the test-plan IDs for readability and traceability.
- Test level: E2E 2; API/component/unit: 0. P0: 0, P1: 2, P2: 0, P3: 0 generated.
- No fixtures, factories, helpers, package scripts, or CI files were added; existing merged fixtures and the Faker todo factory were reused.
- API worker returned no tests because the plan has no P0/P1 API targets. The P2 availability check and P2 delete test were not expanded.

## Validation

- `npx tsc --noEmit`: passed.
- `npm run test:e2e -- --grep "@p1"`: 2 passed.
- `npm run test:e2e`: 3 passed (the two generated P1 tests plus the existing P2 availability check).
- Test quality: user-facing role/name locators, web-first assertions, independent Playwright contexts, and no hard waits or CSS-class assertions.
- Playwright Utils deviations: None.
- Pact.js Utils: no contract artifacts generated; no consumer-provider boundary is in scope.
- Auth and network-recorder utilities were not needed for this UI-only target; the existing auth fixture remains disabled by default.
- Recommended next step: review the generated tests against the plan before adding the P2 deletion scenario or CI.

---

# Run 2: TestRail Test-Run Publication (2026-11-10)

## Preflight and Context

- Mode: Standalone (target supplied by the user: a `npx playwright test` screenshot showing `TestRail sync skipped: set TESTRAIL_INSTANCE_URL, TESTRAIL_USERNAME and TESTRAIL_API_KEY to enable.`).
- Stack: `frontend` (Playwright Test + TypeScript); framework present, 3 specs passing.
- Scope: every run must end with results stored in TestRail as a test run. No new product tests were requested; the target is the reporting pipeline in `tests/support/reporters/`.
- Root causes found:
  1. `.env` did not exist; `playwright.config.ts` loads only `.env`, and the credentials had been written into the tracked `.env.example`, so the reporter never saw them.
  2. The TestRail user held the **Tester** role, which cannot add sections or cases â†’ HTTP 403 on `add_section` once credentials were loaded.
  3. `TESTRAIL_SECTION_NAME` was set to the project name (`Automation Test Suite`); no such section existed.
  4. The uncommitted CI workflow had regressed `${{ secrets.X }}` to literal `process.env.X` strings, so CI sync could never authenticate.
  5. The `refs` regex `[A-Z]+` could not match plan ids containing digits (`1.0-E2E-001`), so traceability refs never reached TestRail.
- Security: a live TestRail API key was committed in `.env.example` (present in `HEAD`). It was removed from the tracked file; the key is in git history and **must be rotated** in TestRail.

## Identified Targets

| Target | Level | Priority | Outcome |
| --- | --- | --- | --- |
| Local run publishes a TestRail run | Reporter / integration | P0 | `.env` created (gitignored) from the populated example; reporter now explains *why* the sync was skipped and hints to copy `.env.example` when `.env` is absent |
| Sync must not fail silently | Reporter contract | P0 | New `TESTRAIL_REQUIRED` opt-in: `onEnd` returns `{ status: 'failed' }` when `sync.testrail !== 'done'` |
| CI run publishes a TestRail run | CI workflow | P1 | `${{ secrets.* }}` / `${{ vars.* }}` expressions restored in `.github/workflows/e2e-tests.yml` |
| Permission failure is diagnosable | Reporter | P1 | 403 from TestRail now logs the required role / `@C<id>` pinning alternative |
| Traceability refs reach TestRail | Reporter + client | P2 | Regex fixed to `[A-Z][A-Z0-9]*`; `updateCaseRefs` backfills refs on existing cases with empty `refs` |

## Generated / Updated Files

- `tests/support/reporters/testrail-jira-reporter.ts`: skip-reason diagnostics, `TESTRAIL_REQUIRED` enforcement, 403 hint, refs regex fix, refs backfill, `onEnd` status override.
- `tests/support/reporters/testrail-client.ts`: `updateCaseRefs()` (`update_case`).
- `.env.example`: API key blanked, `TESTRAIL_REQUIRED` documented; `.env` (gitignored) created locally with the real values.
- `.github/workflows/e2e-tests.yml`: GitHub Actions expression syntax restored for all TestRail/Jira env entries.
- `README.md`: `.env` vs `.env.example` loading rule, role requirement, section-vs-project note, `TESTRAIL_REQUIRED`, refs backfill.
- TestRail (out-of-repo, with user approval): user role changed Tester â†’ Lead via `update_user/1`; section `Automation Test Suite` and cases C2011â€“C2013 created by the reporter.
- No product tests, fixtures, factories or package scripts were added or changed.

## Validation

- `npx tsc --noEmit`: passed.
- `npx playwright test` (run 1): 3 passed; cases mapped 3 (3 created); **TestRail run #23** created with 3 passed results.
- `npx playwright test` (run 2): 3 passed; cases mapped 3 (0 created, 2 refs updated); **TestRail run #24** created; cases C2012/C2013 now carry `refs` `1.0-E2E-001`/`1.0-E2E-002`.
- `TESTRAIL_ENABLED=false` + `TESTRAIL_REQUIRED=true`: sync skipped with reason, run exits 1 as designed.
- `.env` absent: reporter prints `missing TESTRAIL_INSTANCE_URL, TESTRAIL_USERNAME, TESTRAIL_API_KEY. No .env file found: copy .env.example to .env ...`.
- Manifest `test-results/testrail-jira-sync.json`: `sync.testrail: done`, `runId`, `runUrl` populated.
- Playwright Utils deviations: None (no spec changes in this run).
- Pact.js Utils: N/A (no contract artifacts).

## Assumptions and Risks

- Jira sync remains skipped (`JIRA_API_TOKEN` empty); not in scope for this request.
- `TESTRAIL_SUITE_ID=1` is set although project 1 is single-suite mode; TestRail accepts it. Remove it if the project is ever switched to multi-suite with a different master suite id. **(Materialized on 2026-11-11 â€” see the addendum below.)**
- Each local run creates a new TestRail run; set `TESTRAIL_RUN_ID` to accumulate results into one run.
- The committed API key in git history must be rotated; this cannot be fixed by a working-tree change.

## Next Recommended Workflow

- Rotate the TestRail API key, update `.env`, and commit the sanitized `.env.example` + workflow fix.
- Add `TESTRAIL_*` repository secrets/variables so the `report` job publishes CI runs (its verify step will now fail loudly if the sync does not complete).
- `bmad-testarch-trace` to refresh the traceability matrix now that TestRail cases carry plan refs.
---

## Addendum 2026-11-11: TestRail sync failure (suite id) â€” fixed

### Preflight and Context

- Mode: Standalone (request: "run the current project and fix the TestRail errors"); stack `frontend`, Playwright config and dependencies present.
- Baseline run: 3 passed, but `[testrail-jira-reporter] TestRail case/run sync failed. HTTP 400 ... get_sections/3&suite_id=3: {"error":"Field :suite_id is not a valid test suite."}`; `TESTRAIL_REQUIRED=true` correctly turned the run red (exit 1).

### Root Cause

- `.env` had drifted to `TESTRAIL_PROJECT_ID=3` + `TESTRAIL_SUITE_ID=3` (the previous manifest shows an earlier attempt with suite `1`). `.env.example` already carried the correct `10`.
- `get_project/3` â†’ `suite_mode: 3` (multiple suites, so `suite_id` is mandatory); `get_suites/3` â†’ exactly one suite, **id 10 "Master"**. Suite 3 belongs to another project.

### Changes

- `.env` (gitignored): `TESTRAIL_SUITE_ID=10`; removed the duplicated `TESTRAIL_REQUIRED` block.
- `tests/support/reporters/testrail-client.ts`: `TestRailProject`/`TestRailSuite` types, `getProject()`, `getSuites()`, `suiteId` getter and `resolveSuite()` â€” validates the configured suite against the project, self-heals to the project's only suite (wrong id, or unset in a multi-suite project), otherwise throws listing the valid suite ids.
- `tests/support/reporters/testrail-jira-reporter.ts`: `syncCasesAndRun` calls `resolveSuite(info)` first; the resolved suite id is written to the manifest; a 400 mentioning `suite_id` now prints a config hint next to the existing 403 hint.
- `README.md`: suite-id requirement and the new validation behaviour documented.

### Validation

- `npx tsc --noEmit`: passed.
- `npx playwright test`: 3 passed; cases mapped 3 (3 created in section "Automation Test Suite", suite 10); **TestRail run #33** created, 3 results posted; manifest `sync.testrail: done`, `suiteId: 10`; exit 0.
- Regression replay with the broken config (`TESTRAIL_SUITE_ID=3`, `TESTRAIL_RUN_ID=33`): reporter logged `TESTRAIL_SUITE_ID=3 does not belong to project 3 "Automation Test Suite"; using its only suite 10 "Master"`, mapped 3 cases (0 created â€” title dedupe holds), re-posted into run 33; exit 0.

### Assumptions and Risks

- `.env.example` (tracked, currently modified in the working tree) contains a real `TESTRAIL_API_KEY`. Blank it before committing and rotate the key; the reporter and MCP server only need the key in the gitignored `.env`.
- Multi-suite projects with more than one suite still require an explicit, correct `TESTRAIL_SUITE_ID`; the reporter will name the candidates rather than guess.

---

# Run 3: Suite Optimization (2026-11-11)

## Preflight and Context

- Mode: Standalone (request: "optimize the current project and then finally run"); stack `frontend`, root `playwright.config.ts` and dependencies present, `tea_use_playwright_utils: true` with the package installed.
- Baseline: 4 tests — 3 passing, 1 intentional defect-pipeline probe (`1.0-E2E-003 clearing completed…`) failing on every attempt (4 × ~13 s). Test design `1.0-E2E-003` (delete, P2) was still unimplemented; the test review flagged the API test as untagged.
- User decisions: keep the probe failing (still demoing Jira); switch `video` to `on-first-retry`; let the final run sync to TestRail/Jira.
- Knowledge loaded: core set plus Playwright Utils mandate, fixtures composition, network-error-monitor, burn-in, network-first/fixture-architecture principles.

## Identified Targets

| Target | Level | Priority | Outcome |
| --- | --- | --- | --- |
| Duplicated add/complete/locator boilerplate across specs | Infra | P1 | New `todoApp` fixture (`tests/support/todo-app-fixture.ts`) merged via `mergeTests` |
| Slow `load` event caused by Google Tag Manager (3+ s per page) | Perf | P1 | Third-party analytics blocked in the fixture (`page.route` on non-app traffic — a permitted exception under the mandate) |
| Planned-but-missing delete scenario (design `1.0-E2E-003`) | E2E | P2 | Implemented as `1.0-E2E-004` (ID 003 is held by the probe; renaming it would break its TestRail case and Jira dedupe key, which hashes `project|file|title`) |
| API test lacked priority tag / plan ID | API | P2 | Retitled `@p2 [P2] 1.0-API-001 …` (new TestRail case C2021) |
| `test:burn-in` pointed at non-existent `tests/playwright.config.ts` | CI | P1 | Uses root config, `--reporter=list` so burn-in iterations never reach TestRail/Jira |
| No selective-run scripts | Ops | P3 | `test:p1`, `test:p2`, `typecheck` scripts |
| Video recorded for every test and discarded on pass | Perf | P2 | `video: 'on-first-retry'`; reporter borrows the first-retry video when the final attempt has none |
| **Video never reached bug reports** (pre-existing) | Reporter | P1 | Root cause: playwright-utils `createAuthFixtures().context` calls `browser.newContext()` directly, bypassing Playwright's context fixture and dropping `recordVideo` and device `use` options. Fixed by dropping those overrides and injecting auth storage via the native `storageState` option |

## Generated / Updated Files

- `tests/support/todo-app-fixture.ts` (new): `TodoApp` driver (`open`, `item`, `checkbox`, `add`, `addMany`, `complete`, `delete`, `clearCompleted`, `filterBy`, `expectRemainingCount`) + `todoApp` fixture with analytics blocking.
- `tests/support/merged-fixtures.ts`: merges `todoAppFixture`; re-exports `TodoApp`/`TodoFilter` types.
- `tests/support/auth-fixture.ts`: keeps `authOptions`/`authSessionEnabled`/`authToken`; removes library `context`/`page` overrides; adds `storageState` override.
- `tests/e2e/todomvc.spec.ts`: all four scenarios on `todoApp`; new `1.0-E2E-004` delete scenario; probe title/steps unchanged.
- `tests/api/site-availability.spec.ts`: tagged `@p2 [P2] 1.0-API-001`.
- `tests/support/reporters/testrail-jira-reporter.ts`: evidence collection falls back to the most recent attempt carrying a video.
- `playwright.config.ts`: `video: 'on-first-retry'`.
- `package.json`: `test:p1`, `test:p2`, `typecheck`; `test:burn-in` fixed.
- `README.md`: scripts, fixture, probe-title rule, burn-in reporter note, auth-fixture rationale.

## Validation

- `npx tsc --noEmit`: passed.
- Green subset (`1.0-E2E-001/002/004`, `1.0-API-001`, sync disabled): 4 passed — wall time 20.9 s → 10.0 s after analytics blocking; per-test 10–17 s → 4–6 s.
- Video A/B probe: vanilla `test` recorded `video.webm`, merged `test` did not; bisect isolated `authFixture`. After the fix, `--retries=1` run produced `…-retry1/video.webm` (472 KB).
- Final `npx playwright test` with sync: 4 passed, probe failed ×4 (exit 1 by design). TestRail cases mapped 5 (C2018–C2022), **run #62** updated, 5 results posted; **Jira SCRUM-5** updated with Image + Trace + **Video** evidence (first run to carry video); manifest `sync: { testrail: done, jira: done }`.
- Test quality: role/name locators, web-first assertions inside the driver, no hard waits, independent contexts, factory-generated titles.
- Playwright Utils deviations: `tests/support/auth-fixture.ts:30`: library `context`/`page` fixtures intentionally not used — they bypass Playwright's context fixture and lose video/device options; auth storage goes through the native `storageState` option. `tests/support/todo-app-fixture.ts:78`: `page.route` aborts Google Tag Manager/Analytics only (non-app traffic, permitted exception).
- Pact.js Utils: N/A (no contract artifacts).

## Assumptions and Risks

- Retitled tests created new TestRail cases (C2021 `1.0-API-001`, C2022 `1.0-E2E-004`); the old untitled availability case remains in the section and can be retired manually.
- The probe test still exits the run with code 1 by design; CI will stay red until it is fixed to `1 item left` or removed.
- `test:all` runs the suite twice (`test:e2e` then `test:ci`); left unchanged, candidate for removal.
- Upstream issue worth reporting to `@seontechnologies/playwright-utils`: `createAuthFixtures().context` should extend Playwright's `context` fixture (or pass `recordVideo` and `use` options) instead of calling `browser.newContext()` with `browser._options.contextOptions`.

## Next Recommended Workflow

- `bmad-testarch-test-review` on the refactored specs and new fixture.
- `bmad-testarch-trace` to map `1.0-E2E-004` to E1-R4 and refresh the matrix now that every test carries a plan ID.