---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-11-10'
workflowType: 'testarch-test-review'
workflowStatus: 'completed'
executionMode: 'sequential'
runTimestamp: '2026-11-10T09-32-43-873Z'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - 'package.json'
  - 'playwright.config.ts'
  - 'tests/e2e/todomvc.spec.ts'
  - 'tests/api/site-availability.spec.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/auth-fixture.ts'
  - 'tests/support/global-setup.ts'
  - 'tests/support/factories/todo-factory.ts'
  - 'tests/README.md'
  - '_bmad-output/test-artifacts/test-design-epic-1.md'
  - '_bmad-output/test-artifacts/traceability-matrix.md'
  - '_bmad-output/test-artifacts/automation-summary.md'
  - '.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/test-levels-framework.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/selective-testing.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/test-healing-patterns.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/timing-debugging.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/playwright-utils-mandate.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/overview.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/api-request.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/auth-session.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/intercept-network-call.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/recurse.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/log.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/file-utils.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/burn-in.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/network-error-monitor.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/fixtures-composition.md'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/playwright-cli.md'
---

# Test Quality Review: bmad_tea_demo (suite)

**Quality Score**: 100/100 (A - Excellent)
**Raw Deduction Score**: 100/100
**Score Cap**: 100/100
**Score Override Rule**: No severity cap: no findings; effective score equals raw deduction score 100.
**Review Date**: 2026-11-10
**Review Scope**: suite
**Reviewer**: TharushikaRathnayaka (TEA Agent: Murat)

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Excellent

**Recommendation**: Approve
**Verdict Rule**: No findings => Approve.

**Context Basis**: pr_diff

**Context Waivers Applied**: 0

**Execution Mode**: sequential

<!-- tea_execution_mode is `auto`. The review set is two files totalling 64 lines, so the four worker
     steps (03a determinism, 03b isolation, 03c maintainability, 03e performance) were executed inline
     by the orchestrating agent under one run timestamp (2026-11-10T09-32-43-873Z) rather than dispatched
     to subagents. Worker outputs were written to the OS temp directory as
     tea-test-review-{dimension}-2026-11-10T09-32-43-873Z.json and aggregated in step 3F. -->

### Key Strengths

✅ Every spec imports `test`, `expect`, and `log` from `tests/support/merged-fixtures.ts` (never from `@playwright/test`), and the merged fixture composes `apiRequest`, `interceptNetworkCall`, `networkErrorMonitor`, `recurse`, and the project auth fixture via `mergeTests` — exactly the entry point `playwright-utils-mandate.md` requires.
✅ All UI lookups are role/name locators (`getByRole('textbox', { name: 'New Todo Input' })`, `getByRole('listitem')`, `getByRole('link', { name: 'Active' })`) with auto-retrying web-first assertions (`toHaveCount(1)`, `toBeChecked`, `toBeVisible`); no CSS classes, XPath, hard waits, or conditionals anywhere.
✅ Perfect isolation: unique titles from the `createTodo()` factory, a fresh Playwright context per test (so TodoMVC `localStorage` cannot leak), `fullyParallel: true`, and no module-level mutable state. Live run: 3 passed in 19.0s (0.5s / 3.6s / 3.9s per test).

### Advisory Observations

ℹ️ **Random-title substring collision (no registry row; unscored).** `createTodo()` returns unseeded `faker.lorem.words({ min: 2, max: 4 })` with no uniqueness suffix, and `todomvc.spec.ts` locates rows with `filter({ hasText: title })`, which is a *substring* match. In `1.0-E2E-002` two random titles share one list; if one happens to be a substring of the other, the locator resolves to two elements and `toBeVisible()` throws a strict-mode error at random. Use an exact match (`getByText(title, { exact: true })` or `hasText: new RegExp(`^${escaped}$`)`) and/or append a short unique suffix in the factory per `data-factories.md`.
ℹ️ **Inline setup duplication (no registry row; unscored).** The "fill `New Todo Input` + press Enter" sequence is written out three times in `todomvc.spec.ts`. A small `addTodo(page, title)` helper (or a fixture) would remove the duplication without changing behaviour; this is also why the *Comprehensive Fixtures* bonus was not awarded.
ℹ️ **API spec carries no test ID or priority marker (context-raised; L2 gate closed).** `test-design-epic-1.md` assigns `tests/api/site-availability.spec.ts` the ID `1.0-API-001` at P2, and the traceability matrix had to map it by behaviour. Convention row L2 cannot fire because the baseline is unavailable (see below), so there is no deduction — but renaming the test to `@p2 [P2] 1.0-API-001 TodoMVC serves its root document` makes `--grep @p2` selection and ID-based tracing work.
ℹ️ **Broken `test:burn-in` script (no registry row; unscored).** `package.json` runs `playwright test --config tests/playwright.config.ts --repeat-each=5 --retries=0`, but the only config is the root `playwright.config.ts`. The burn-in job described in `tests/README.md` cannot execute as written. Point the script at the root config (or drop the `--config` flag).

### Summary

The suite is small (two spec files, three tests) and built the way the TEA knowledge base asks: merged-fixture entry point, playwright-utils `apiRequest` and `log` in use, factory-generated data, role-based locators, web-first assertions, Given/When/Then step logging, and nothing that can pass while the behaviour is broken. Every Absolute row in the criteria registry was evaluated against both files and none fired; every Applicability gate that was open (L1 fragile selector, M2 repeated payload, M6 unawaited async, H10 shape-only assertion) was satisfied; and every Convention row is `PASS (n/a)` because, at suite scope, no corpus exists outside the review set to measure a house convention against.

The four advisory items above are worth a short follow-up PR — the substring-collision risk in particular is the one thing that could ever make this suite flake — but none maps to a registry row, so none moves the score. Coverage gaps (the unimplemented `1.0-E2E-003` delete scenario) belong to `trace`, which already reports them.

---

## Quality Criteria Assessment

| Criterion                            | Status          | Violations | Basis                                                                              | Notes                                                                                                                                                       |
| ------------------------------------ | --------------- | ---------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BDD Format (Given-When-Then)         | ✅ PASS (n/a)   | 0          | Convention: bddNaming (0 of 0 sampled)                                             | Baseline unavailable (no corpus outside the review set). Observed: `log.step('Given/When/Then …')` in every UI test; names state behaviour.                 |
| Test IDs                             | ✅ PASS (n/a)   | 0          | Convention: testIds (0 of 0 sampled)                                               | Baseline unavailable. Observed: role/name locators throughout; no `data-testid` needed. Test-plan IDs `1.0-E2E-001/002` present in UI test names.          |
| Priority Markers (P0/P1/P2/P3)       | ✅ PASS (n/a)   | 0          | Convention: priorityMarkers (0 of 0 sampled)                                       | Baseline unavailable. Observed: `@p1 [P1]` on both UI tests; API test unmarked (advisory, see above).                                                       |
| Disabled or Focused Tests            | ✅ PASS         | 0          | Absolute                                                                           | No `.skip`, `.only`, `fixme`, or `todo` in either file (C1, C2).                                                                                            |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS         | 0          | Absolute                                                                           | No `waitForTimeout`, `sleep`, or timer-ordered steps (H1).                                                                                                  |
| Determinism (no conditionals)        | ✅ PASS         | 0          | Absolute                                                                           | No `if`/ternary/`try`-`catch` around assertions (H3); no wall-clock fixtures (H2 gate closed).                                                              |
| Isolation (cleanup, no shared state) | ✅ PASS         | 0          | Absolute                                                                           | Fresh context per test, unique factory data, no module-level state (H4); no mocks (C5 n/a).                                                                 |
| Fixture Patterns                     | ✅ PASS (n/a)   | 0          | Convention: fixtures (0 of 0 sampled)                                              | Baseline unavailable. Observed: both specs consume `merged-fixtures.ts` (`mergeTests` of 5 fixtures).                                                       |
| Data Factories                       | ✅ PASS         | 0          | Applicability: the file constructs domain payloads                                 | `createTodo()` factory with overrides used for every todo; no inline literal payloads (M2).                                                                 |
| Network-First Pattern                | ✅ PASS (n/a)   | 0          | Applicability: the file navigates and then reads data-dependent content            | Gate closed: TodoMVC React is a static client-side app with no application API; list content comes from the test's own UI actions, not a fetch (M1).         |
| Playwright Utils Adoption            | ✅ PASS (n/a)   | 0          | Convention: playwrightUtils (0 of 0 sampled)                                       | Baseline unavailable. Observed in review set: 2 of 2 files import from merged fixtures; `apiRequest` and `log` in use; no banned vanilla pattern (M9, L9).  |
| Pact.js Utils Adoption               | ✅ PASS (n/a)   | 0          | Run-level precondition `pactjsUtilsActive` false                                   | `@seontechnologies/pactjs-utils` is not installed and no contract tests are in scope; row M10 does not exist for this run.                                   |
| Explicit Assertions                  | ✅ PASS         | 0          | Absolute                                                                           | Every test asserts (C4); no tautologies (C3); UI presence/state and a status *value* (`toBe(200)`), so H10 does not fire.                                   |
| Test Length (≤1000 lines)            | ✅ PASS         | 56 / 8     | Absolute                                                                           | `todomvc.spec.ts` 56 lines; `site-availability.spec.ts` 8 lines (H5).                                                                                       |
| Test Duration (≤1.5 min)             | ✅ PASS         | 3.9s max   | Absolute                                                                           | Measured live run 2026-11-10: 0.5s, 3.6s, 3.9s; whole suite 19.0s with 3 workers.                                                                           |
| Flakiness Patterns                   | ✅ PASS         | 0          | Absolute                                                                           | No hard waits, conditionals, or shared state. One unscored risk noted: substring `hasText` match on unseeded random titles (see Advisory Observations).     |

**Total Violations**: 0 Critical, 0 High, 0 Medium, 0 Low

**Convention Baseline**: unavailable: suite scope places every test file in the review set, so no corpus exists outside it to sample

<!-- Run-level note per criteria-registry.md § Mandate-backed keys: playwright-utils is installed and
     `tea_use_playwright_utils` is true; the corpus outside the review set is empty, so adoption could not
     be measured against a house baseline. Within the review set itself adoption is 2 of 2 files. -->

---

## Quality Score Breakdown

```text
Starting Score:          100
Critical Violations:     -0 × 10 = -0
High Violations:         -0 × 5 = -0
Medium Violations:       -0 × 2 = -0
Low Violations:          -0 × 1 = -0

Bonus Points:
  Excellent BDD:         +5
  Comprehensive Fixtures: +0
  Data Factories:        +5
  Network-First:         +0
  Perfect Isolation:     +5
  All Test IDs:          +0
                         --------
Total Bonus:             +15

Raw Deduction Score:     100/100
Score Cap:               100/100 (none)
Effective Score:         100/100
Grade:                   A
```

<!-- Bonus rationale (each 0 or 5, must hold across every reviewed file):
     Excellent BDD +5 — every test name states behaviour; UI tests carry Given/When/Then log.step markers.
     Comprehensive Fixtures +0 — todo creation setup is inlined three times rather than taken from a fixture/helper.
     Data Factories +5 — all domain data comes from createTodo(); the API test constructs none.
     Network-First +0 — the suite declares no network interception, so the pattern is not demonstrated.
     Perfect Isolation +5 — fresh context per test, unique data, no shared mutable state, fullyParallel.
     All Test IDs +0 — lookups are role/label based (which satisfies L1) rather than stable test ids.
     100 - 0 + 15 = 115, clamped to 100. -->

---

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

No additional recommendations. Test quality is excellent. ✅

The four items under **Advisory Observations** are unscored because the criteria registry has no row for them (or, for the missing API-test priority marker, because the L2 Convention gate is closed). They are listed with concrete fixes and are worth a short follow-up PR, but they do not affect this score or verdict.

---

## Best Practices Found

### 1. Merged-fixture entry point with playwright-utils composition

**Location**: `tests/support/merged-fixtures.ts:9`
**Pattern**: `mergeTests` composition, single project entry point
**Knowledge Base**: [fixtures-composition.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/fixtures-composition.md), [playwright-utils-mandate.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/playwright-utils-mandate.md)

**Why This Is Good**:
Both specs reach `apiRequest`, `interceptNetworkCall`, `networkErrorMonitor`, `recurse`, and the auth fixture through one import, and re-export `expect` from `@playwright/test` as the mandate prescribes. No spec imports `test` from `@playwright/test` directly.

**Code Example**:

```typescript
// ✅ Excellent pattern demonstrated in this test
export const test = mergeTests(apiRequestFixture, interceptFixture, networkErrorFixture, recurseFixture, authFixture);
export { expect } from '@playwright/test';
export { log };
```

**Use as Reference**:
Any new spec (including the planned `1.0-E2E-003` delete scenario) should start with `import { test, expect, log } from '../support/merged-fixtures';`.

### 2. Role-based locators with scoped, auto-retrying assertions

**Location**: `tests/e2e/todomvc.spec.ts:15`
**Pattern**: Selector hierarchy (role > text > CSS) + web-first assertions
**Knowledge Base**: [selector-resilience.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md), [test-quality.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Why This Is Good**:
Rows are addressed by accessible role and scoped to the test's own title; the checkbox is found *inside* that row. `toHaveCount(1)` and `not.toBeChecked()` retry until the UI settles, so no explicit wait is needed and no CSS class (`.completed`) is asserted.

**Code Example**:

```typescript
// ✅ Excellent pattern demonstrated in this test
const todoItems = page.getByRole('listitem').filter({ hasText: todo.title });
await expect(todoItems).toHaveCount(1);
await expect(todoItems.getByRole('checkbox')).not.toBeChecked();
```

**Use as Reference**:
Keep this shape for the delete scenario: scope the `Delete todo` button to the uniquely titled row rather than using positional or CSS selectors.

### 3. `apiRequest` for the availability check, structured `log.step` narration

**Location**: `tests/api/site-availability.spec.ts:4`
**Pattern**: playwright-utils `apiRequest` (REQUIRED substitution) + `log`
**Knowledge Base**: [api-request.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/api-request.md), [log.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/log.md)

**Why This Is Good**:
The test uses the mandated `apiRequest({ method, path })` instead of the raw `request` context, destructures the already-parsed `{ status }`, and narrates the step through `log.step` so it appears in the HTML report.

**Code Example**:

```typescript
// ✅ Excellent pattern demonstrated in this test
await log.step('Request the configured TodoMVC base URL');
const { status } = await apiRequest({ method: 'GET', path: './' });
expect(status).toBe(200);
```

**Use as Reference**:
Any future API-level setup or assertion should go through `apiRequest` the same way.

---

## Test File Analysis

### File 1: `tests/e2e/todomvc.spec.ts`

#### File Metadata

- **File Path**: `tests/e2e/todomvc.spec.ts`
- **File Size**: 56 lines, 2.7 KB
- **Test Framework**: Playwright
- **Language**: TypeScript

#### Test Structure

- **Describe Blocks**: 0 (M4 does not fire: fewer than 3 tests)
- **Test Cases (it/test)**: 2
- **Average Test Length**: 25 lines per test
- **Fixtures Used**: 2 (`page`; `log` via merged fixtures)
- **Data Factories Used**: 1 (`createTodo`)

#### Test Scope

- **Test IDs**: `1.0-E2E-001`, `1.0-E2E-002`
- **Priority Distribution**:
  - P0 (Critical): 0 tests
  - P1 (High): 2 tests
  - P2 (Medium): 0 tests
  - P3 (Low): 0 tests
  - Unknown: 0 tests

#### Assertions Analysis

- **Total Assertions**: 10
- **Assertions per Test**: 5 (avg)
- **Assertion Types**: `toHaveCount`, `toBeChecked`, `not.toBeChecked`, `toBeVisible`, `not.toBeVisible`

### File 2: `tests/api/site-availability.spec.ts`

#### File Metadata

- **File Path**: `tests/api/site-availability.spec.ts`
- **File Size**: 8 lines, 0.3 KB
- **Test Framework**: Playwright
- **Language**: TypeScript

#### Test Structure

- **Describe Blocks**: 0 (M4 does not fire: 1 test)
- **Test Cases (it/test)**: 1
- **Average Test Length**: 6 lines per test
- **Fixtures Used**: 2 (`apiRequest`; `log` via merged fixtures)
- **Data Factories Used**: 0 (no domain payload constructed)

#### Test Scope

- **Test IDs**: none in the test name (test design assigns `1.0-API-001`)
- **Priority Distribution**:
  - P0 (Critical): 0 tests
  - P1 (High): 0 tests
  - P2 (Medium): 0 tests
  - P3 (Low): 0 tests
  - Unknown: 1 test

#### Assertions Analysis

- **Total Assertions**: 1
- **Assertions per Test**: 1 (avg)
- **Assertion Types**: `toBe` (HTTP status value)

### Reviewed Files

| File                                   | Lines | Tests | Violations |
| -------------------------------------- | ----: | ----: | ---------: |
| `tests/e2e/todomvc.spec.ts`            |    56 |     2 |          0 |
| `tests/api/site-availability.spec.ts`  |     8 |     1 |          0 |

### Excluded From Review Set

None. Both files discovered under `tests/**/*.spec.ts` were read, parsed, and scored. Support modules (`tests/support/**`) are not tests and were read as context for the fixture and factory checks only.

---

## Context and Integration

### What the Context Said

Three context artifacts were supplied and read (`context_basis: pr_diff`). They were used to understand what the tests are *for*; none was scored, and none waived anything.

- **`test-design-epic-1.md`** defines risks E1-R1..R5 and scenarios `1.0-E2E-001` (create, P1), `1.0-E2E-002` (filter membership, P1), `1.0-E2E-003` (delete, P2), and `1.0-API-001` (target availability, P2). It states that no application API exists and that state must be created through the UI — which is why the Network-First gate is closed here and why inline UI setup is a design choice rather than an oversight. It also explicitly designs `1.0-E2E-002` as one scenario covering All/Active/Completed, so that test's four assertion groups are one concern (M3 does not fire).
- **`traceability-matrix.md`** maps the three tests to E1-AC-1..3 and E1-AC-5 at FULL coverage and notes the API test "carries no test ID or priority tag; mapped by behaviour". That observation is reproduced here as a context-raised advisory; L2 cannot deduct because the Convention baseline is unavailable. It also records `1.0-E2E-003` as planned-but-unimplemented — a coverage gap owned by `trace`, not this review.
- **`automation-summary.md`** claims "no hard waits or CSS-class assertions", "Playwright Utils deviations: None", and that specs import from merged fixtures. Every one of those claims was verified against the files and holds.

Nothing in the context contradicts a test, and no test contradicts its acceptance criterion.

### Related Artifacts

- **Test Design**: [test-design-epic-1.md](./test-design-epic-1.md)
- **Risk Assessment**: Medium (5 risks, all score 4; none ≥ 6)
- **Priority Framework**: P0-P3 applied
- **Traceability**: [traceability-matrix.md](./traceability-matrix.md)
- **Automation Summary**: [automation-summary.md](./automation-summary.md)

---

## Knowledge Base References

This review consulted the following knowledge base fragments (deterministic selection for stack `frontend`, Playwright runner, `playwrightUtilsActive = true`, `tea_browser_automation: auto`):

- **[criteria-registry.md](../../.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)** - The single rule registry: every row, predicate, pinned severity, and gate
- **[test-quality.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)** - Definition of Done (no hard waits, ≤1000 lines, <1.5 min, self-cleaning)
- **[data-factories.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)** - Factory functions with overrides, unique data
- **[test-levels-framework.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/test-levels-framework.md)** - E2E vs API appropriateness
- **[selective-testing.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/selective-testing.md)** - Priority tags and grep-based selection
- **[test-healing-patterns.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/test-healing-patterns.md)** - Failure signatures
- **[selector-resilience.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md)** - data-testid > role > text > CSS hierarchy
- **[timing-debugging.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/timing-debugging.md)** - Deterministic waiting
- **[playwright-utils-mandate.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/playwright-utils-mandate.md)** - REQUIRED/RECOMMENDED substitution table (rows M9, L9)
- **[overview.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/overview.md)**, **[api-request.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/api-request.md)**, **[intercept-network-call.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/intercept-network-call.md)**, **[recurse.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/recurse.md)**, **[log.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/log.md)**, **[file-utils.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/file-utils.md)**, **[network-error-monitor.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/network-error-monitor.md)**, **[auth-session.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/auth-session.md)**, **[network-recorder.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md)**, **[burn-in.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/burn-in.md)**, **[fixtures-composition.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/fixtures-composition.md)** - playwright-utils reference fragments
- **[playwright-cli.md](../../.agents/skills/bmad-testarch-test-review/resources/knowledge/playwright-cli.md)** - CLI evidence collection (not used: `playwright-cli` is not installed; a live `npx playwright test` run supplied duration evidence instead)

For coverage mapping, consult `trace` workflow outputs.

See [tea-index.csv](../../.agents/skills/bmad-testarch-test-review/resources/tea-index.csv) for the complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

None required. The suite is approved as-is.

### Follow-up Actions (Future PRs)

1. **Harden title matching against substring collisions** - Switch `filter({ hasText: title })` to an exact match and/or add a unique suffix in `createTodo()`.
   - Priority: P2
   - Target: next PR touching `tests/e2e/`

2. **Tag the API test with its design ID and priority** - Rename to `@p2 [P2] 1.0-API-001 TodoMVC serves its root document`.
   - Priority: P3
   - Target: next PR touching `tests/api/`

3. **Fix `test:burn-in` config path** - Point the script at the root `playwright.config.ts` so the burn-in CI job in `tests/README.md` can run.
   - Priority: P2
   - Target: before enabling the burn-in CI job

4. **Extract an `addTodo(page, title)` helper** - Remove the triplicated fill-and-Enter sequence ahead of adding `1.0-E2E-003` (delete), which will need it a fourth time.
   - Priority: P3
   - Target: alongside `1.0-E2E-003`

### Re-Review Needed?

✅ No re-review needed - approve as-is

---

## Decision

**Recommendation**: Approve

**Rationale**:
Zero registry rows fired across both reviewed files. Every Absolute row (disabled/focused tests, tautological or missing assertions, hard waits, conditionals, shared state, unawaited async, file length, shape-only assertions) passes on evidence; every open Applicability gate (fragile selectors, repeated payloads) is satisfied; and the suite's playwright-utils adoption — merged fixtures, `apiRequest`, `log` — matches the mandate without a single banned vanilla pattern. A live run confirms all three tests pass in under four seconds each.

> Test quality is excellent with 100/100 score. The four advisory observations (substring-match collision risk, inline setup duplication, untagged API test, broken burn-in script) carry no registry row and can be addressed in follow-up PRs. Tests are production-ready and follow best practices.

---

## Appendix

### Violation Summary by Location

No scored violations. ✅

| Line | Severity | Criterion | Issue | Fix |
| ---- | -------- | --------- | ----- | --- |
| —    | —        | —         | none  | —   |

### Unscored Observations by Location

| File:Line                                   | Observation                                                              | Fix                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `tests/support/factories/todo-factory.ts:9` | Unseeded `faker.lorem.words`, no uniqueness suffix                       | Append a short unique suffix (e.g. `faker.string.alphanumeric(6)`)           |
| `tests/e2e/todomvc.spec.ts:15,35,41-53`     | `filter({ hasText })` substring match on random titles                   | Exact match: `getByText(title, { exact: true })` or `^…$` RegExp             |
| `tests/e2e/todomvc.spec.ts:11-13,29-31,34-35` | Todo-creation sequence inlined three times                             | `addTodo(page, title)` helper or fixture                                     |
| `tests/api/site-availability.spec.ts:3`     | No test ID / priority marker (design: `1.0-API-001`, P2)                 | Rename to `@p2 [P2] 1.0-API-001 TodoMVC serves its root document`            |
| `package.json` (`test:burn-in`)             | `--config tests/playwright.config.ts` does not exist                     | Use root `playwright.config.ts`                                              |
