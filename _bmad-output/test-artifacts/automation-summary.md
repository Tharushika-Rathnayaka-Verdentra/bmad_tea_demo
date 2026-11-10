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