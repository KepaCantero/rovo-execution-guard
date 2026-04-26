// [ARCH-SOLID-003] [GIT-CI-211] Conventional commit format with REG ticket reference
// [GIT-CI-205] Custom parser with regex for REG ticket references
// [GIT-CI-213] Subject max 100 chars
// [GIT-CI-214] Subject max line length
// [GIT-CI-308] commit-msg hook invokes commitlint

const conventional = require('@commitlint/config-conventional');

module.exports = {
  parserPreset: {
    parserOpts: {
      headerPattern: '^(\\w*)(?:\\(([\\w\\$\\.\\-\\* ]*)\\))?!?:\\s(.+)\\s\\[(REG-\\d+)\\]$',
      headerCorrespondence: ['type', 'scope', 'subject', 'references'],
      referencePattern: 'REG-\\d+',
      issuePrefixes: ['REG-'],
    },
  },
  rules: {
    ...conventional.rules,
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
