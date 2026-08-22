import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default [
	...tseslint.config(
		{ ignores: ['dist'] },
		{
			extends: [js.configs.recommended, ...tseslint.configs.recommended],
			files: ['**/*.{ts,tsx}'],
			languageOptions: {
				ecmaVersion: 2020,
				globals: globals.browser
			},
			plugins: {
				'react-hooks': reactHooks,
				'react-refresh': reactRefresh
			},
			rules: {
				...reactHooks.configs.recommended.rules,
				// v7 adds stricter rules; keep existing patterns until we adopt them deliberately.
				'react-hooks/set-state-in-effect': 'off',
				'react-hooks/refs': 'off',
				'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
			}
		}
	),
	eslintConfigPrettier
]
