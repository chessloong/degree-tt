module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'no-debugger': 'warn',
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }],
    'no-new': 'off',
    'new-cap': ['warn', {
      properties: false,
      newIsCapExceptionPattern: '^[a-z][a-zA-Z0-9]*$',
      capIsNewExceptionPattern: '^(App|Page|Component)$'
    }]
  },
  globals: {
    tt: true,
    App: true,
    Page: true,
    Component: true,
    getApp: true,
    uCharts: true
  }
}
