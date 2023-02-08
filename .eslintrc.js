module.exports = {
  env: {
    es6: true,
    node: true,
    browser: true,
  },
  extends: ["eslint:recommended", "plugin:vue/essential"],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parserOptions: {
    ecmaVersion: 2020,
    parser: "@typescript-eslint/parser",
    sourceType: "module",
  },
  plugins: ["vue", "prettier", "@typescript-eslint"],
  rules: {
    "prettier/prettier": [
      "error",
      {
        tabWidth: 2,
        printWidth: 200,
        vueIndentScriptAndStyle: true,
        semi: true,
        singleQuote: false,
        quoteProps: "as-needed",
      },
    ],
    "linebreak-style": ["error", "unix"],
    curly: ["error", "all"],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        vars: "all",
        args: "after-used",
        ignoreRestSiblings: false,
      },
    ],
    "vue/html-indent": [
      "error",
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
