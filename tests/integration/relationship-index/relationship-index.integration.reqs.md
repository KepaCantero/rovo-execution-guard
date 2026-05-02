# Relationship Index Integration Tests — Requirements

## Acceptance Criteria

| AC    | Function                  | Behavior                                            | Rule Tags                      |
| ----- | ------------------------- | --------------------------------------------------- | ------------------------------ |
| AC-01 | `bootstrapProjectIndex()` | Indexes all issues from searchByJQL into storage    | TEST-QA-201, ARCH-SOLID-049-03 |
| AC-02 | `bootstrapProjectIndex()` | Returns zero stats for empty project                | TEST-QA-201                    |
| AC-03 | `bootstrapProjectIndex()` | Propagates JiraApiError when search fails           | ARCH-SOLID-053                 |
| AC-04 | `indexJiraIssue()`        | Creates node, edges, neighborhood, updates stats    | TEST-QA-201                    |
| AC-05 | `indexJiraIssue()`        | Creates topic-match edges from labels without links | TEST-QA-201                    |
| AC-06 | `extractJiraReferences()` | Extracts Jira keys from content, caps at 50         | ARCH-SOLID-049-03              |
| AC-07 | `extractPageTopics()`     | Creates topic-match edges from labels and title     | ARCH-SOLID-049-03              |
| AC-08 | `stalenessFactor()`       | 1.0 for fresh, 0.5 at 30+ days, linear decay        | ARCH-SOLID-049-03              |

## Mock Strategy

- `jest.mock('@forge/api')` with in-memory Map-backed `storage`
- `jest.mock('jira-adapter')` for `searchByJQL` override
- No mocks for pure functions (extractJiraReferences, extractPageTopics, stalenessFactor)
