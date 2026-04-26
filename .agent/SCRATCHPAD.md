# SCRATCHPAD.md — Temporary Thoughts & Debug

## Resolved: Forge deploy

### Problem

Forge lint reported errors for handler files and manifest validation.

### Root Causes

1. **Handler format**: Forge only supports `<filename>.<export>` (single dot), not multi-level paths like `backend.resolvers.index.handler`
2. **Missing `handler` exports**: Backend resolver files didn't export a Forge-compatible `handler` function
3. **`render: native`** on issuePanel made it UI Kit (not Custom UI) — couldn't be a directory
4. **Resource key length** exceeded 23 characters
5. **Deprecated egress** permission format

### Solution

1. Created thin entry point files in `src/`:
   - `src/resolver-handler.ts` → re-exports `handler` from `backend/resolvers/index.ts`
   - `src/transition-handler.ts` → re-exports `handler` from `backend/resolvers/workflow-transition.ts`
   - `src/webhook-handler.ts` → re-exports `handler` from `backend/resolvers/github-webhook.ts`
2. Added `handler` export to each backend resolver file:
   - `index.ts`: `export const handler = resolverInstance.getDefinitions()` (for @forge/resolver)
   - `workflow-transition.ts`: `export const handler` wrapping `onJiraWorkflowTransition`
   - `github-webhook.ts`: `export const handler` wrapping `onGitHubWebhook` with webtrigger response format
3. Removed `render: native` from issuePanel (Custom UI doesn't need it)
4. Shortened resource keys to <= 23 chars
5. Fixed egress permissions with `forge lint --fix`

### Result

- `forge lint`: No issues found
- `forge deploy -e kcantero`: Deployed successfully (v2.0.0)
