// [ARCH-SOLID-003] [GIT-CI-211] Conventional commit format with JIRA ticket reference
// [GIT-CI-205] Custom parser with regex for JIRA ticket references
// [GIT-CI-213] Subject max 100 chars
// [GIT-CI-214] Subject max line length
// [GIT-CI-308] commit-msg hook invokes commitlint
module.exports = {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      headerPattern: '^(\\w*)(?:\\(([\\w\\$\\.\\-\\* ]*)\\))?!?:\\s(.+)\\s\\[(REG-\\d+)\\]$',
      referencePattern: 'REG-\\d+',
      issuePrefixes: ['REG-'],
    },
  },
  rules: {
    'references-empty': [2, 'never'],
    'subject-max-length': [2, 'always', 100],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'test',
        'docs',
        'style',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
  },
};
