# Confluence Adapter Integration Tests — Requirements

## Acceptance Criteria

| AC    | Function            | Behavior                                            | Rule Tags                    |
| ----- | ------------------- | --------------------------------------------------- | ---------------------------- |
| AC-01 | `searchPages()`     | Returns mapped ConfluencePageData[] from CQL search | TEST-QA-201, TEST-QA-058     |
| AC-02 | `searchPages()`     | Returns empty array when no pages match             | TEST-QA-201                  |
| AC-03 | `searchPages()`     | Throws ConfluenceApiError for invalid response      | ARCH-SOLID-053, TEST-QA-0853 |
| AC-04 | `searchPages()`     | Retries on 429 and succeeds                         | TEST-QA-0853                 |
| AC-05 | `getPageContent()`  | Returns plain text from HTML storage format         | TEST-QA-201                  |
| AC-06 | `getPageContent()`  | Throws PageNotFoundError for 404                    | ARCH-SOLID-053               |
| AC-07 | `getPageContent()`  | Throws TimeoutError on abort                        | TEST-QA-0853                 |
| AC-08 | `getPageMetadata()` | Returns labels, version, space from metadata        | TEST-QA-201                  |
| AC-09 | `getPageMetadata()` | Throws PageNotFoundError for 404                    | ARCH-SOLID-053               |
| AC-10 | `getPageMetadata()` | Throws ConfluenceApiError for invalid response      | TEST-QA-0853                 |
| AC-11 | `getSpacePages()`   | Returns pages from space listing                    | TEST-QA-201                  |
| AC-12 | `getSpacePages()`   | Throws SpaceNotFoundError for 404                   | ARCH-SOLID-053               |
| AC-13 | `getSpacePages()`   | Clamps limit to 1-100 range                         | ARCH-SOLID-049-03            |

## Mock Strategy

- `jest.mock('@forge/api')` with `requestConfluence` mock
- Fixture: `tests/integration/fixtures/confluence-pages.json`
