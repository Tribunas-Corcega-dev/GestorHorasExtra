import reactHooks from "eslint-plugin-react-hooks"

export default [
  {
    ignores: [".next/**", "node_modules/**", "lib/generated/**"],
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {},
  },
]
