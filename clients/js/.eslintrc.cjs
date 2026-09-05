module.exports = {
  extends: ['@solana/eslint-config-solana'],
  ignorePatterns: ['.eslintrc.cjs', 'tsup.config.ts', 'src/generated/**'],
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/sort-type-constituents': 'off',
    // The heterogeneous guard registry (AnyGuardManifest) is typed with `any`.
    '@typescript-eslint/no-explicit-any': 'off',
    // The guard mint/route parser interface is async-typed, but some guards
    // (noop, thirdPartySigner, …) resolve synchronously without an `await`.
    '@typescript-eslint/require-await': 'off',
    'prefer-destructuring': 'off',
    'simple-import-sort/imports': 'off',
    'sort-keys-fix/sort-keys-fix': 'off',
    'typescript-sort-keys/interface': 'off',
  },
};
