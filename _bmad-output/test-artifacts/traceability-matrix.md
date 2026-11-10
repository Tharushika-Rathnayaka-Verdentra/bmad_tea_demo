---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-11-10'
workflowType: 'testarch-trace'
workflowStatus: 'completed'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design-epic-1.md'
  - '_bmad-output/test-artifacts/nfr-assessment.md'
  - 'tests/e2e/todomvc.spec.ts'
  - 'tests/api/site-availability.spec.ts'
  - 'test-results/junit.xml'
  - 'playwright.config.ts'
coverageBasis: 'acceptance_criteria'
oracleConfidence: 'medium'
oracleResolutionMode: 'formal_requirements'
oracleSources: ['_bmad-output/test-artifacts/test-design-epic-1.md']
externalPointerStatus: 'not_used'
collectionStatus: 'COLLECTED'
sourceSha: '88cfc93e4c27e16104253a71f924c931ea656a73'
tempCoverageMatrixPath: 'c:/Users/TharushikaRathnayaka/.copilot/session-state/f6cda1de-03d2-40f9-bb7c-f73aff1623e7/files/tea-trace-coverage-matrix-2026-11-10T09-20-00-000Z.json'
---

# Traceability Matrix & Gate Decision - Epic 1: TodoMVC Core Todo Actions

**Target:** Epic 1 - TodoMVC Core Todo Actions (`epic-1`)
**Date:** 2026-11-10
**Evaluator:** TharushikaRathnayaka (TEA Agent: Murat)
**Coverage Oracle:** acceptance_criteria (formal requirements)
**Oracle Confidence:** medium
**Oracle Sources:** `_bmad-output/test-artifacts/test-design-epic-1.md`
**Source SHA:** `88cfc93e4c27e16104253a71f924c931ea656a73` (`master`)
**Collection Mode / Status:** contract_static / COLLECTED
**Execution Mode:** auto → sequential (5 criteria, 3 tests)

---

Note: This workflow does not generate tests. If gaps exist, run `/bmad-testarch-atdd` or `/bmad-testarch-automate` to create coverage.

## Oracle Resolution

| Candidate | Found | Used |
| --- | --- | --- |
| Story / epic acceptance criteria | No story file exists in the repository | — |
| PRD / tech spec | `docs/prd.md` does not exist (confirmed in the NFR audit) | — |
| Test design | `test-design-epic-1.md` — risk matrix E1-R1..R5 and coverage plan 1.0-E2E-001/002/003, 1.0-API-001 | **Yes — primary oracle** |
| Contract / spec artifacts (OpenAPI etc.) | None; no application API in scope | — |
| External pointers | None present | not_used |
| Synthetic source inference | Not needed; formal oracle resolved | — |

**Why medium confidence:** the test design is a formal, versioned planning artifact with stable IDs, but it states that *"No formal Epic 1 story or acceptance-criteria document was supplied; the plan's outcomes are derived from the user's action list."* The five criteria below are the behaviours that plan commits to; they should be confirmed against a story before this trace is treated as authoritative.

### Derived Acceptance Criteria

| ID | Criterion | Priority | Risk | Planned test(s) |
| --- | --- | --- | --- | --- |
| E1-AC-1 | Create a todo through the UI and it appears exactly once as an active item in the default All view | P1 | E1-R1 | 1.0-E2E-001 |
| E1-AC-2 | With one active and one completed todo, All shows both, Active shows only the active one, Completed shows only the completed one | P1 | E1-R2 | 1.0-E2E-002 |
| E1-AC-3 | Completing a todo checks its checkbox and moves it from the Active view into the Completed view | P1 | E1-R3 | 1.0-E2E-002 |
| E1-AC-4 | Deleting one of two todos removes only the selected row; the other row remains | P2 | E1-R4 | 1.0-E2E-003 |
| E1-AC-5 | The configured public target root responds successfully (HTTP 200) | P2 | E1-R5 | 1.0-API-001 |

No P0 criteria: the test design identifies no revenue-critical, security-critical, compliance, or no-workaround failure in scope.

---

## PHASE 1: REQUIREMENTS TRACEABILITY

### Test Inventory (static discovery in `tests/`)

| Test ID | Title | File:Line | Level | Status |
| --- | --- | --- | --- | --- |
| `1.0-E2E-001` | @p1 [P1] 1.0-E2E-001 unique todo creation | `tests/e2e/todomvc.spec.ts:4` | E2E | active |
| `1.0-E2E-002` | @p1 [P1] 1.0-E2E-002 mixed active/completed todo membership through All, Active, Completed | `tests/e2e/todomvc.spec.ts:21` | E2E | active |
| *(no ID)* | TodoMVC serves its root document | `tests/api/site-availability.spec.ts:3` | API | active |

- **Files:** 2 · **Cases:** 3 · **Skipped / fixme / pending in source:** 0 / 0 / 0
- No unit or component tests exist (the application source is not in this repository).
- `1.0-E2E-003` (delete) is planned but not implemented.
- The API test carries no test ID or priority tag; mapped to E1-AC-5 by behaviour, not by ID.
- **Live Verification Results:** `_bmad-output/test-artifacts/live-verification-results.json` not present → `freshness: not_present`, 0 records.

```json
{
  "title": "Live Verification Results",
  "liveManifestHeader": { "present": false, "results_file": "_bmad-output/test-artifacts/live-verification-results.json", "source_sha": "", "observed_at": "", "producer": "", "read_error": "", "current_source_sha": "88cfc93e4c27e16104253a71f924c931ea656a73" },
  "liveRecords": []
}
```

### Coverage Summary

| Priority  | Total Criteria | FULL Coverage | Coverage % | Status |
| --------- | -------------- | ------------- | ---------- | ------ |
| P0        | 0              | 0             | 100% (n/a) | ✅ PASS |
| P1        | 3              | 3             | 100%       | ✅ PASS |
| P2        | 2              | 1             | 50%        | ⚠️ WARN |
| P3        | 0              | 0             | 100% (n/a) | — |
| **Total** | **5**          | **4**         | **80%**    | **✅ PASS (at minimum)** |

**Legend:**

- ✅ PASS - Coverage meets quality gate threshold
- ⚠️ WARN - Coverage below threshold but not critical
- ❌ FAIL - Coverage below minimum threshold (blocker)

---

### Detailed Mapping

#### E1-AC-1: Create a todo through the UI and it appears exactly once as an active item in the default All view (P1)

- **Coverage:** FULL ✅
- **Tests:**
  - `1.0-E2E-001` - `tests/e2e/todomvc.spec.ts:4`
    - **Given:** the TodoMVC app is open
    - **When:** a unique (Faker) title is entered in `New Todo Input` and Enter is pressed
    - **Then:** exactly one list item matches the title (`toHaveCount(1)`) and its checkbox is not checked
- **Justification:** Both scenarios the criterion states (appears once; appears active) are asserted with auto-retrying role-based locators.
- **Considered and rejected:** none.

---

#### E1-AC-2: All shows both, Active shows only the active todo, Completed shows only the completed todo (P1)

- **Coverage:** FULL ✅
- **Tests:**
  - `1.0-E2E-002` - `tests/e2e/todomvc.spec.ts:21`
    - **Given:** one active and one completed todo created through the UI
    - **When:** each of the All, Active, Completed links is clicked in turn
    - **Then:** All shows both titles; Active shows the active title and hides the completed one; Completed shows the completed title and hides the active one
- **Justification:** Positive and negative membership is asserted for each of the three filters.
- **Considered and rejected:** none.

---

#### E1-AC-3: Completing a todo checks its checkbox and moves it from Active into Completed (P1)

- **Coverage:** FULL ✅
- **Tests:**
  - `1.0-E2E-002` - `tests/e2e/todomvc.spec.ts:21`
    - **Given:** a second todo has been created
    - **When:** its checkbox is checked
    - **Then:** the checkbox is `toBeChecked()`; the todo is not visible under Active; it is visible under Completed with its checkbox still checked
- **Justification:** State change and filter movement are both asserted. Shared test with E1-AC-2 is acceptable overlap — one journey, two risks (E1-R2, E1-R3), as the test design intended.
- **Considered and rejected:** none.

---

#### E1-AC-4: Deleting one of two todos removes only the selected row (P2)

- **Coverage:** NONE ❌
- **Tests:** none
- **Gaps:**
  - Missing: the `Delete todo` control is never exercised
  - Missing: assertion that the non-deleted row survives (risk E1-R4 — "remove a different todo")
- **Considered and rejected:** none.
- **Recommendation:** Implement planned `1.0-E2E-003` in `tests/e2e/todomvc.spec.ts`: create two uniquely titled todos, scope `getByRole('button', { name: 'Delete todo' })` to the first row (hover to reveal if needed), assert that row has count 0 and the second row has count 1.

---

#### E1-AC-5: The configured public target root responds successfully (P2)

- **Coverage:** FULL ✅
- **Tests:**
  - *(no ID; planned `1.0-API-001`)* - `tests/api/site-availability.spec.ts:3`
    - **Given:** the configured `BASE_URL`
    - **When:** `GET ./` is issued through the `apiRequest` fixture
    - **Then:** status is 200
- **Justification:** The criterion states one scenario and the test asserts it. This is environment-availability evidence, not feature coverage (per the test design).
- **Considered and rejected:** none.
- **Recommendation:** Rename to include `1.0-API-001` and a priority tag so the trace resolves by ID.

---

### Gap Analysis

#### Critical Gaps (BLOCKER) ❌

0 gaps found. No P0 criteria exist in this oracle.

#### High Priority Gaps (PR BLOCKER) ⚠️

0 gaps found. All three P1 criteria are FULL.

#### Medium Priority Gaps (Nightly) ⚠️

1 gap found. **Address in nightly test improvements.**

1. **E1-AC-4: Deleting one of two todos removes only the selected row** (P2)
   - Current Coverage: NONE
   - Recommend: `1.0-E2E-003` (E2E)
   - Impact: Risk E1-R4 (DATA, score 4) has no mitigation evidence; this single gap is what holds overall coverage at exactly the 80% floor.

#### Low Priority Gaps (Optional) ℹ️

0 gaps found.

#### Partial / Unit-only / Integration-only

None.

#### Rejected Evidence

None — every test that names a criterion establishes it.

---

### Coverage Heuristics Findings

#### Endpoint Coverage Gaps

- Endpoints without direct API tests: 0
- No application API is in Epic 1 scope (test design: Not in Scope). The only API-level check is the root availability request.

#### Auth/Authz Negative-Path Gaps

- Criteria missing denied/invalid-path tests: 0
- No authentication flow exists for the target; `tests/support/auth-fixture.ts` disables auth sessions explicitly.

#### Happy-Path-Only Criteria

- Criteria missing error/edge scenarios: 0 (strict count — the oracle declares no error, validation, empty-state, or persistence criteria)
- **Advisory:** the *oracle* is happy-path-only, not just the tests. Behaviours a TodoMVC story would normally state and that nothing covers today: empty/whitespace title rejected, title trimmed on submit, editing a todo, "Clear completed", toggle-all, item-count footer, and persistence across reload (risk E1-R3 literally says "may not persist"). Add them to the story before the next trace or they stay invisible to the gate.

#### UI Journey Coverage

- Oracle journeys without E2E coverage: 1 (E1-AC-4 Delete)

#### UI State Coverage

- Not applicable for a formal (non-synthetic) oracle. Note: no test asserts the empty-list state or the footer item count.

---

### Quality Assessment

#### Tests with Issues

**BLOCKER Issues** ❌

- *(run-level, not a single test)* — The only recorded execution artifact, `test-results/junit.xml` (2026-11-10 07:38Z), lists `1.0-E2E-001` and `1.0-E2E-002` five times each, **all `skipped`, `time=0`, 0 executed**. The spec source contains no `test.skip`, so the skip originated at run time (interrupted run, failed global setup, or filtered run). This coverage has never been demonstrated green on record. — Re-run `npm run test:e2e` and republish.

**WARNING Issues** ⚠️

- `tests/api/site-availability.spec.ts:3` — no test ID or priority tag; traceability relies on a title match — add `[P2] 1.0-API-001` to the title.
- `test-results/api-users-lists-users-chromium*/` — stale failure artifacts for a deleted `tests/api/users.spec.ts` (404 on `/api/users`) — clean `test-results/` before the next evidence publish.

**INFO Issues** ℹ️

- `1.0-E2E-002` covers two criteria (E1-AC-2, E1-AC-3). Acceptable defence-in-depth for one journey, but a failure will need triage to tell which risk tripped; the `log.step` labels already make this readable.

#### Tests Passing Quality Gates

**3/3 tests (100%) meet static quality criteria** ✅ — role-based locators, auto-retrying assertions, unique data per test via `createTodo()`, independent contexts, Given/When/Then via `log.step`, no hard waits, no committed skips.

---

### Duplicate Coverage Analysis

#### Acceptable Overlap (Defense in Depth)

- E1-AC-2 / E1-AC-3: one E2E journey (`1.0-E2E-002`) proves both filter membership and completion movement. One journey, two risks — intentional per the test design. ✅

#### Unacceptable Duplication ⚠️

- None.

---

### Coverage by Test Level

| Test Level | Tests | Criteria Covered | Coverage % |
| ---------- | ----- | ---------------- | ---------- |
| E2E        | 2     | 3                | 60%        |
| API        | 1     | 1                | 20%        |
| Component  | 0     | 0                | 0%         |
| Unit       | 0     | 0                | 0%         |
| Live       | 0     | 0                | 0%         |
| **Total**  | **3** | **4**            | **80%**    |

Unit/component levels are not applicable: the application under test is an external public demo with no source in this repository.

---

### Traceability Recommendations

#### Immediate Actions (Before PR Merge)

1. **Publish an executed run** — `npm run test:e2e`; confirm `junit.xml` has no `<skipped>` elements and both P1 cases have `time > 0`. Until this exists the PASS below is a statement about test *existence*, not test *results*.
2. **Clean stale artifacts** — remove `test-results/api-users-lists-users-*` so the deleted `users.spec.ts` failure cannot be mistaken for Epic 1 evidence.

#### Short-term Actions (This Milestone)

1. **Implement `1.0-E2E-003` (E1-AC-4 delete)** — via `/bmad-testarch-automate`. Lifts overall coverage from 80% → 100% and closes risk E1-R4.
2. **Tag the API test** — `[P2] 1.0-API-001 TodoMVC serves its root document`.

#### Long-term Actions (Backlog)

1. **Promote the oracle** — write the Epic 1 story with explicit acceptance criteria (including the error/edge behaviours listed under Happy-Path-Only) so oracle confidence moves from medium to high.
2. **Run `/bmad-testarch-test-review`** for a full quality pass once the suite is green on record.

---

## PHASE 2: QUALITY GATE DECISION

**Gate Type:** epic
**Decision Mode:** deterministic
**Gate Eligible:** yes (`allow_gate=true`, `collection_status=COLLECTED`)

---

### Evidence Summary

#### Test Execution Results

Source: `test-results/junit.xml` (local run, 2026-11-10T07:38:29Z; no `staging` branch or CI run exists).

- **Total Tests**: 10 entries (2 unique cases × 5 identical suites)
- **Passed**: 0 (0%)
- **Failed**: 0 (0%)
- **Skipped**: 10 (100%)
- **Duration**: 0.77s (all `time=0` per case)

**Priority Breakdown:**

- **P0 Tests**: 0/0 — none exist
- **P1 Tests**: 0/2 passed — **not measurable (0 executed)** ❌
- **P2 Tests**: 0/1 — `1.0-API-001` not in the recorded run (informational)
- **P3 Tests**: none

**Overall Pass Rate**: undefined — 0 executed ❌

#### Coverage Summary (from Phase 1)

- **P0 Acceptance Criteria**: 0/0 (100%, vacuous) ✅
- **P1 Acceptance Criteria**: 3/3 covered (100%) ✅
- **P2 Acceptance Criteria**: 1/2 covered (50%) — informational
- **Overall Coverage**: 80% (exactly the minimum)

**Code Coverage**: not applicable — application source not in repository.

#### Non-Functional Requirements (NFRs)

Source: `_bmad-output/test-artifacts/nfr-assessment.md` (2026-11-10)

- **Security**: CONCERNS ⚠️ — no auth threshold declared; no auth tests
- **Performance**: CONCERNS ⚠️ — 5 user-supplied thresholds, 0 measurements
- **Reliability**: CONCERNS ⚠️ — no uptime baseline; pass-rate gates unmeasurable (0 executed)
- **Maintainability**: NOT_ASSESSED — excluded by user
- Critical NFR failures: 0

#### Flakiness Validation

- **Burn-in**: not available — no CI, no repeated executed runs. Flaky count unknown.

---

### Decision Criteria Evaluation

#### P0 Criteria (Must ALL Pass)

| Criterion             | Threshold | Actual           | Status |
| --------------------- | --------- | ---------------- | ------ |
| P0 Coverage           | 100%      | 100% (0 of 0)    | ✅ PASS (vacuous) |
| P0 Test Pass Rate     | 100%      | n/a (no P0 tests)| ✅ PASS (vacuous) |
| Security Issues       | 0         | 0 found / 0 tested | ✅ PASS (no evidence either way) |
| Critical NFR Failures | 0         | 0 (all CONCERNS) | ✅ PASS |
| Flaky Tests           | 0         | unknown          | ⚠️ not measurable |

**P0 Evaluation**: ✅ ALL PASS — but every pass is vacuous. There are no P0 criteria and no executed tests.

#### P1 Criteria (Required for PASS, May Accept for CONCERNS)

| Criterion              | Threshold | Actual     | Status |
| ---------------------- | --------- | ---------- | ------ |
| P1 Coverage            | ≥90%      | 100%       | ✅ PASS |
| P1 Test Pass Rate      | ≥95%      | undefined (0 executed) | ⚠️ not measurable |
| Overall Test Pass Rate | ≥90%      | undefined (0 executed) | ⚠️ not measurable |
| Overall Coverage       | ≥80%      | 80%        | ✅ PASS (at floor) |

**P1 Evaluation**: ✅ coverage rules pass; ⚠️ execution rules cannot be evaluated.

#### P2/P3 Criteria (Informational, Don't Block)

| Criterion         | Actual | Notes |
| ----------------- | ------ | ----- |
| P2 Coverage       | 50%    | E1-AC-4 uncovered; tracked, doesn't block |
| P2 Test Pass Rate | n/a    | `1.0-API-001` not in recorded run |
| P3                | none   | — |

---

### GATE DECISION: PASS

---

### Rationale

**Derived decision (Rules 1–5, coverage-based):** P0 coverage is 100%, P1 coverage is 100% (target: 90%), and overall coverage is 80% (minimum: 80%). No synthetic-oracle or live-only overlay applies. → **PASS**.

**What drove it:** both P1 journeys (create; complete + filter) are fully established by `1.0-E2E-001` and `1.0-E2E-002`; the availability check establishes E1-AC-5. The one uncovered criterion is P2 and does not enter Rules 1–5.

**Caveats the number does not show — read before acting on this gate:**

1. **This PASS is about test existence, not test results.** `contract_static` collection traces the suite on disk. The only recorded execution (`junit.xml`) executed **zero** tests. A suite that has never been seen green is not release evidence; it is a promise.
2. **Overall coverage is exactly at the 80% floor.** One P2 criterion short of 100%, one criterion away from FAIL if any future requirement is added without a test.
3. **The oracle is medium-confidence and happy-path-only.** No story exists; the five criteria are the test design's reading of an action list. Real TodoMVC acceptance criteria (validation, edit, clear-completed, persistence) would widen the denominator and almost certainly drop this below the floor.
4. **NFR status is CONCERNS across all three audited domains**, which this coverage gate does not weigh.

**Test Architect's recommendation:** treat this as **PASS (coverage) / NOT YET RELEASE-READY (evidence)**. Hold the release gate until an executed, non-skipped run is published; then this decision stands on real ground.

### Waiver Register Review

No register found at `_bmad-output/test-artifacts/gate-waivers.md`. No waivers filed, none applied.

---

### Machine-Readable Outputs

- `_bmad-output/test-artifacts/e2e-trace-summary.json` (schema 0.3.0) — `gate_status: PASS`, `confidence: medium`
- `_bmad-output/test-artifacts/gate-decision.json` (schema 0.1.0) — `gate_status: PASS`, `critical_open: 0`

---

### Gate Decision Summary

```text
🚨 GATE DECISION: PASS

📊 Coverage Analysis:
- P0 Coverage: 100% (Required: 100%) → MET (0 P0 criteria)
- P1 Coverage: 100% (PASS target: 90%, minimum: 80%) → MET
- Overall Coverage: 80% (Minimum: 80%) → MET (at floor)

✅ Decision Rationale:
P0 coverage is 100%, P1 coverage is 100% (target: 90%), and overall coverage is 80% (minimum: 80%).

⚠️ Critical Gaps: 0 (P0 criteria below FULL coverage)
⚠️ Medium Gaps: 1 (E1-AC-4 delete — 1.0-E2E-003 not implemented)
🔴 Execution evidence: last recorded run executed 0 of 10 testcases (all skipped)

📝 Recommended Actions:
1. Publish an executed run (npm run test:e2e) — the suite has never been green on record
2. Implement 1.0-E2E-003 for E1-AC-4 → overall 100%
3. Write the Epic 1 story with explicit ACs to raise oracle confidence

📂 Full Report: _bmad-output/test-artifacts/traceability-matrix.md

✅ GATE: PASS - coverage meets standards. Proceed only once execution evidence exists.
```

**Generated by:** BMad TEA Test Architect (Murat)
**Workflow:** `bmad-testarch-trace`
