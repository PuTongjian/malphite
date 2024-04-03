module.exports = {
  "env": {
    "browser": true,
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:vue/vue3-essential"
  ],
  "overrides": [
    {
      "env": {
        "node": true
      },
      "files": [
        ".eslintrc.{js,cjs}"
      ],
      "parserOptions": {
        "sourceType": "script"
      }
    }
  ],
  "parserOptions": {
    "ecmaVersion": "latest",
    "parser": "@typescript-eslint/parser",
    "sourceType": "module"
  },
  "plugins": [
    "@typescript-eslint",
    "vue"
  ],
  "rules": {
    "indent": [
      "error",
      2,
    ],
    "linebreak-style": ["error", process.platform === "win32" ? "windows" : "unix"],
    "quotes": [
      "error",
      "double"
    ],
    "semi": [
      "error",
      "always"
    ],
    "no-trailing-spaces": "error",
    "vue/multi-word-component-names": [
      "error",
      {
        ignores: ["index"],
      },
    ],
  }
};
