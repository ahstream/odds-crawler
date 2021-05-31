module.exports = {
  // ESLint will stop looking in parent folders once it finds this configuration.
  root: true,

  // A configuration file can extend the set of enabled rules from base configurations.
  extends: [
    // Airbnb's base config.
    // https://github.com/airbnb/javascript/tree/master/packages/eslint-config-airbnb-base
    'airbnb-base',

    // Turns off all rules that are unnecessary or might conflict with Prettier. Make sure to put it
    // last, so it gets the chance to override other configs.
    // https://github.com/prettier/eslint-config-prettier
    'prettier'
  ],

  // ESLint supports the use of third-party plugins.
  plugins: [
    // Runs Prettier as an ESLint rule and reports differences as individual ESLint issues.
    // https://github.com/prettier/eslint-plugin-prettier
    'prettier'
  ],

  // ESLint comes with a large number of rules. Don't use numbers to specify the type of rule,
  // instead use 'off', 'warn' and 'error'.
  rules: {
    // Report differences from Prettier config.
    'prettier/prettier': 'error',

    // Don't enforce destructuring from arrays and objects.
    'prefer-destructuring': 'off',

    // Ensure consistent use of file extension within the import path. Enforces the use of
    // extensions for all import statements except packages and .js/.ts extensions.
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        ts: 'never'
      }
    ],

    // Don't ensure that there is no resolvable path back to the module via its dependencies.
    // Dependency cycles aren't always an issue, you just need to know that you're doing.
    'import/no-cycle': 'off',

    // Require or disallow a space immediately following the // or /* in a comment.
    'spaced-comment': ['error', 'always', { exceptions: ['-', '+', '*', '!', '='] }],

    // When there is only a single export from a module, don't prefer using default export
    // over named export.
    'import/prefer-default-export': 'off',

    // Forbid the import of external modules that are not declared in the package.json's
    // dependencies, devDependencies, optionalDependencies or peerDependencies. Option
    // 'devDependencies' is set because we don't want the response "'xxx' should be listed in the
    // project's dependencies, not devDependencies".
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],

    // Specify the maximum length of a line. This works together with Prettier's printWidth, but in
    // different ways. Make sure to sync the length for consistency. max-len just says what the
    // maximum allowed line length is, but not what the generally preferred length is – which is
    // what printWidth from Prettier specifies.
    'max-len': [
      'error',
      {
        code: 100,
        comments: 100,
        tabWidth: 2,
        ignoreUrls: true,
        ignoreComments: false,
        ignoreRegExpLiterals: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true
      }
    ],

    // Enforce a convention in module import order. Divide imports in two groups and enforce a new
    // line between them. Built-in and external packages are imported first (group 1) and then the
    // rest after (group 2).
    'import/order': [
      'error',
      {
        alphabetize: { order: 'asc', caseInsensitive: true },
        groups: [['builtin', 'external']],
        'newlines-between': 'always'
      }
    ],

    // Allow global require().
    // https://eslint.org/docs/rules/global-require
    'global-require': 'off',

    // Allow console logs.
    // https://eslint.org/docs/rules/no-console
    'no-console': 'off',

    // Allow await in loop. Should we do this?
    // https://eslint.org/docs/rules/no-await-in-loop
    'no-await-in-loop': 'off',

    // Allow specified syntax.
    // https://eslint.org/docs/rules/no-restricted-syntax
    'no-restricted-syntax': 'off',

    // Extend the base eslint/no-unused-vars rule.
    'no-unused-vars': 'off'
  },

  // ESLint allows you to specify the JavaScript language options you want to support.
  parserOptions: {
    // 9th edition of ECMAScript syntax.
    ecmaVersion: 2018,

    // ECMAScript modules.
    sourceType: 'module'
  },

  // Which environments your script is designed to run in. Each environment brings with it a
  // certain set of predefined global variables.
  env: {
    // Browser global variables.
    browser: true,
    // Node.js global variables and Node.js scoping.
    node: true,
    // Enable all ECMAScript 6 features except for modules.
    es6: true,
    // https://www.npmjs.com/package/eslint-plugin-jest
    jest: true
  },

  // Shared settings.
  settings: {
    // Using eslint-import-resolver-alias to solve Webpack aliases.
    // https://github.com/johvin/eslint-import-resolver-alias
    'import/resolver': {
      alias: {
        map: [['@', './']],
        extensions: ['.ts', '.js']
      }
    }
  }
};