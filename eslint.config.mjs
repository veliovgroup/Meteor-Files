import babelParser from '@babel/eslint-parser';
import globals from 'globals';

const meteorGlobals = {
  Meteor: 'readonly',
  Package: 'readonly',
  Npm: 'readonly',
};

const rules = {
      "strict": [
        2,
        "never"
      ],
      "no-shadow": 2,
      "no-shadow-restricted-names": 2,
      "no-unused-vars": [
        2,
        {
          "vars": "local",
          "args": "after-used",
          "caughtErrors": "none"
        }
      ],
      "no-use-before-define": [
        2,
        "nofunc"
      ],
      "no-cond-assign": [
        2,
        "always"
      ],
      "no-console": 1,
      "no-debugger": 1,
      "no-alert": 1,
      "no-constant-condition": 1,
      "no-dupe-keys": 2,
      "no-duplicate-case": 2,
      "no-empty": 2,
      "no-ex-assign": 2,
      "no-extra-boolean-cast": 0,
      "no-func-assign": 2,
      "no-inner-declarations": 2,
      "no-invalid-regexp": 2,
      "no-irregular-whitespace": 2,
      "no-obj-calls": 2,
      "no-sparse-arrays": 2,
      "no-unreachable": 2,
      "use-isnan": 2,
      "block-scoped-var": 0,
      "no-undef": "error",
      "consistent-return": 2,
      "curly": [
        2,
        "multi-line"
      ],
      "default-case": 2,
      "dot-notation": [
        2,
        {
          "allowKeywords": true
        }
      ],
      "eqeqeq": 2,
      "guard-for-in": 2,
      "no-caller": 2,
      "no-else-return": 2,
      "no-eq-null": 2,
      "no-eval": 2,
      "no-extend-native": 2,
      "no-extra-bind": 2,
      "no-fallthrough": 2,
      "no-floating-decimal": 2,
      "no-implied-eval": 2,
      "no-lone-blocks": 2,
      "no-loop-func": 2,
      "no-multi-str": 2,
      "no-global-assign": 2,
      "no-new": 2,
      "no-new-func": 2,
      "no-new-wrappers": 2,
      "no-octal": 2,
      "no-octal-escape": 2,
      "no-param-reassign": 2,
      "no-proto": 2,
      "no-redeclare": 2,
      "no-return-assign": 2,
      "no-script-url": 2,
      "no-self-compare": 2,
      "no-sequences": 2,
      "no-throw-literal": 2,
      "no-with": 2,
      "wrap-iife": [
        2,
        "any"
      ],
      "yoda": 2,
      "indent": [
        2,
        2
      ],
      "brace-style": [
        2,
        "1tbs",
        {
          "allowSingleLine": true
        }
      ],
      "quotes": [
        2,
        "single",
        "avoid-escape"
      ],
      "camelcase": [
        2,
        {
          "properties": "never"
        }
      ],
      "comma-spacing": [
        2,
        {
          "before": false,
          "after": true
        }
      ],
      "comma-style": [
        2,
        "last"
      ],
      "eol-last": 2,
      "key-spacing": [
        2,
        {
          "beforeColon": false,
          "afterColon": true
        }
      ],
      "new-cap": [
        2,
        {
          "newIsCap": true
        }
      ],
      "no-multiple-empty-lines": [
        2,
        {
          "max": 2
        }
      ],
      "no-nested-ternary": 2,
      "no-new-object": 2,
      "no-array-constructor": 2,
      "no-trailing-spaces": 2,
      "no-underscore-dangle": 0,
      "one-var": [
        2,
        "never"
      ],
      "padded-blocks": [
        2,
        "never"
      ],
      "semi": [
        2,
        "always"
      ],
      "semi-spacing": [
        2,
        {
          "before": false,
          "after": true
        }
      ],
      "space-infix-ops": 2
    };

const languageOptions = (extraGlobals, sourceType = 'module') => ({
  parser: babelParser,
  sourceType,
  ecmaVersion: 'latest',
  parserOptions: { requireConfigFile: false },
  globals: { ...meteorGlobals, ...extraGlobals },
});

export default [
  {
    ignores: [
      '.superpowers/**',
      '.meteor/**',
      '.npm/**',
      '.versions',
      'node_modules/**',
      'demo*/**',
      'worker.min.js',
      'eslint.config.mjs',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: languageOptions({ ...globals.es2021 }),
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules,
  },
  // shared code (client and server)
  {
    files: ['core.js', 'cursor.js', 'lib.js'],
    languageOptions: languageOptions({ ...globals.es2021, ...globals.browser, ...globals.node }),
  },
  // client code
  {
    files: ['client.js', 'upload.js'],
    languageOptions: languageOptions({ ...globals.es2021, ...globals.browser }),
  },
  // Web Worker script (classic script, not a module)
  {
    files: ['worker.js'],
    languageOptions: languageOptions({ ...globals.es2021, ...globals.worker, ...globals.browser }, 'script'),
    rules: { strict: 'off' },
  },
  // server code and tests
  {
    files: ['server.js', 'write-stream.js', 'mime.js', 'download-token.js', 'storage.js', 'tests/**/*.js'],
    languageOptions: languageOptions({ ...globals.es2021, ...globals.node }),
  },
  // browser tests
  {
    files: ['tests/client.js'],
    languageOptions: languageOptions({ ...globals.es2021, ...globals.browser }),
  },
];
