// eslint.config.js
import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import vue from "eslint-plugin-vue";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parser: tsParser,
    },
    plugins: {
      vue,
      prettier,
      "@typescript-eslint": ts,
    },
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
  },
];
