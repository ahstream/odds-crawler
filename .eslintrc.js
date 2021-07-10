module.exports = {
  root: true,
  extends: [
    'airbnb-base',
    // Turns off all rules that are unnecessary or might conflict with Prettier.
    // Make sure to put it last, so it gets the chance to override other configs.
    'prettier'
  ],
  plugins: ['prettier'], // , 'require-sort'],

  rules: {
    'prettier/prettier': 'off', // Report differences from Prettier config

    'global-require': 'off',
    'no-console': 'off',
    'no-await-in-loop': 'off',
    'no-restricted-syntax': 'off',
    'no-unused-vars': 'off',
    'no-use-before-define': ['error', 'nofunc'],
    'no-plusplus': 'off',
    'prefer-destructuring': 'off',
    'no-underscore-dangle': 'off',
    'class-methods-use-this': 'off',
    'no-continue': 'off',
    'no-param-reassign': 'off',
    'no-case-declarations': 'off',
    'no-multiple-empty-lines': 'warn',

    'import/no-named-as-default-member': 'off',
    'import/prefer-default-export': 'off',
    'import/extensions': 'off',
    'import/named': 'off',
    'import/no-unresolved': 'off',
    'import/no-self-import': 'off',
    // 'sort-imports': 'error',
    // 'require-sort/require-sort': 'error',

    // Don't ensure that there is no resolvable path back to the module via its dependencies.
    // Dependency cycles aren't always an issue, you just need to know that you're doing.
    'import/no-cycle': 'off',

    // Forbid the import of external modules that are not declared in the package.json's
    // dependencies, devDependencies, optionalDependencies or peerDependencies. Option
    // 'devDependencies' is set because we don't want the response "'xxx' should be listed in the
    // project's dependencies, not devDependencies".
    'import/no-extraneous-dependencies': 'off', //  ['error', { devDependencies: true }],

    // Enforce a convention in module import order. Divide imports in two groups and enforce a new line between them.
    // Built-in and external packages are imported first (group 1) and then the rest after (group 2).
    'import/order': [
      'error',
      {
        alphabetize: { order: 'asc', caseInsensitive: true },
        groups: ['builtin', 'external'],
        'newlines-between': 'always'
      }
    ],

    // Require or disallow a space immediately following the // or /* in a comment.
    'spaced-comment': ['error', 'always', { exceptions: ['-', '+', '*', '!', '='] }],

    // Specify the maximum length of a line. This works together with Prettier's printWidth, but in different ways.
    // Make sure to sync the length for consistency. max-len just says what the maximum allowed line length is, but not
    // what the generally preferred length is – which is what printWidth from Prettier specifies.
    'max-len': [
      'warn',
      {
        code: 120,
        comments: 120,
        tabWidth: 2,
        ignoreUrls: true,
        ignoreComments: false,
        ignoreRegExpLiterals: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true
      }
    ]
  },

  // ESLint allows you to specify the JavaScript language options you want to support.
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },

  // Which environments your script is designed to run in.
  env: {
    browser: true, // Browser global variables
    node: true, // Node.js global variables and Node.js scoping
    es6: true, // Enable all ECMAScript 6 features except for modules
    jest: true // https://www.npmjs.com/package/eslint-plugin-jest
  },

  // Shared settings
  settings: {
    // Solve Webpack aliases: https://github.com/johvin/eslint-import-resolver-alias
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      },
      alias: {
        map: [['@', './']],
        extensions: ['.ts', '.js']
      }
    }
  }
};
