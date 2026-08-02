import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist', 'storybook-static', 'node_modules', 'coverage', '*.config.*', '.storybook'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      // Story metas are used only in type positions (StoryObj<typeof meta>).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^\\w*Meta$', argsIgnorePattern: '^_' },
      ],
      // react-hooks v7 experimental rules: false positives on idiomatic
      // patterns (passing ref props through wrapper components, documented
      // lazy-ref init, test scaffolding). Keep the battle-tested rules above.
      'react-hooks/refs': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  prettier,
);
