# Vitest Migration Notes

## What Was Migrated

The repo now has a `Vitest`-based test runner that covers the current Atlas test landscape in three layers:

- `specs/unit/**`
  - direct unit tests for isolated backend modules
- `specs/audits/**`
  - legacy audit scripts executed under `Vitest`
- `specs/integration/**`
  - legacy live/integration scripts executed under `Vitest`
- `specs/qa/**`
  - legacy QA runners executed under `Vitest`

This means the current test ecosystem can now be driven from `Vitest` without rewriting the production backend.

## Commands

- `npm run test:unit`
  - runs only `specs/unit/**`
- `npm run test:vitest`
  - runs the full `Vitest` suite
  - unit tests + audit harness
  - live and QA suites are present but skipped unless explicitly enabled
- `npm run test:vitest:watch`
  - watch mode for the `Vitest` suite

## Environment Gates

### Live/integration suite

Set `RUN_ATLAS_LIVE=1` before `npm run test:vitest` to execute wrappers for:

- `tests/scripts/test_runner.js`
- `tests/scripts/session-debug.js`
- `tests/scripts/test_agent.js`
- `tests/scripts/atlas-master-test.js`
- `tests/scripts/test-stress-arende.js`
- `tests/scripts/test-simulator.js`
- `tests/scripts/rag-debug.js`

### QA suite

Set `RUN_ATLAS_QA=1` before `npm run test:vitest` to execute wrappers for:

- `tests/scripts/qa-test-runner.js`
- `tests/scripts/qa-test-runner-v2.js`
- `tests/scripts/qa-test-runner-v3.js`
- `tests/scripts/qa-test-runner-v4.js`

## Why Gates Are Used

The legacy test system contains several classes of scripts:

- fast deterministic unit/module tests
- static audits that can run offline
- live backend tests that require Atlas to run locally
- expensive QA suites that call OpenAI and can take a long time
- interactive/debug tools that need stdin or signal-driven shutdown

Putting everything behind a single always-on run would make normal development slower and risk accidental API cost. `Vitest` now orchestrates all of them, but only the safe layers run by default.

## Important Technical Detail

The repository ignores `/tests/` in [`.gitignore`](C:/Atlas/.gitignore), so the new tracked `Vitest` specs live in `specs/` instead of `tests/`.

## Proof Of Migration

Verified locally:

- `Vitest` runs correctly in this CommonJS repo
- unit tests pass for:
  - `utils/priceResolver.js`
  - `middleware/auth.js`
- legacy audit scripts can be executed from `Vitest` through the new process harness
- legacy live and QA scripts are represented in `Vitest` and can be turned on through env flags

## Current Migration Shape

This is a compatibility migration first, not a full rewrite of every legacy script into `describe()`/`it()` internals.

That means:

- the old scripts still exist unchanged as the source of truth for their current logic
- `Vitest` can now orchestrate them from one runner
- we can next refactor script-by-script into native `Vitest` tests without losing coverage during the transition

## Recommended Next Native Conversions

Best next targets for true native `Vitest` rewrites:

- `tests/scripts/test_agent.js`
- `tests/scripts/atlas-master-test.js`
- `tests/scripts/test-stress-arende.js`
- `tests/scripts/audit_server.js`
- `tests/scripts/audit_1_server_db_renderer.js`

These are the scripts where the most value will come from replacing log-driven flow with direct assertions.
