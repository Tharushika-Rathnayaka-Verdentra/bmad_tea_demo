---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-11-10'
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
  2. The TestRail user held the **Tester** role, which cannot add sections or cases → HTTP 403 on `add_section` once credentials were loaded.
  3. `TESTRAIL_SECTION_NAME` was set to the project name (`Test-Tharushika`); no such section existed.
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
- TestRail (out-of-repo, with user approval): user role changed Tester → Lead via `update_user/1`; section `Test-Tharushika` and cases C2011–C2013 created by the reporter.
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
- `TESTRAIL_SUITE_ID=1` is set although project 1 is single-suite mode; TestRail accepts it. Remove it if the project is ever switched to multi-suite with a different master suite id.
- Each local run creates a new TestRail run; set `TESTRAIL_RUN_ID` to accumulate results into one run.
- The committed API key in git history must be rotated; this cannot be fixed by a working-tree change.

## Next Recommended Workflow

- Rotate the TestRail API key, update `.env`, and commit the sanitized `.env.example` + workflow fix.
- Add `TESTRAIL_*` repository secrets/variables so the `report` job publishes CI runs (its verify step will now fail loudly if the sync does not complete).
- `bmad-testarch-trace` to refresh the traceability matrix now that TestRail cases carry plan refs.