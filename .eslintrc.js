module.exports = {
    env: {
        es6: true,
        node: true,
        browser: true,
    },
    extends: ['plugin:prettier/recommended', 'eslint:recommended', 'plugin:vue/essential', 'plugin:@typescript-eslint/eslint-recommended'],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
    },
    parserOptions: {
        ecmaVersion: 2020,
        parser: '@typescript-eslint/parser',
        sourceType: 'module',
    },
    plugins: ['vue', 'prettier', '@typescript-eslint'],
    rules: {
        'prettier/prettier': [
            'error',
            {
                tabWidth: 4,
                printWidth: 200,
                vueIndentScriptAndStyle: false,
                semi: false,
                singleQuote: true,
                quoteProps: 'as-needed',
            },
        ],
        'linebreak-style': ['error', 'unix'],
        curly: ['error', 'all'],
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                vars: 'all',
                args: 'after-used',
                ignoreRestSiblings: false,
            },
        ],
        'vue/html-indent': [
            'error',
            4,
            {
                attribute: 1,
                baseIndent: 1,
                closeBracket: 0,
                alignAttributesVertically: true,
                ignores: [],
            },
        ],
    },
}
