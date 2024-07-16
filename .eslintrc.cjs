module.exports = {
  "env": {
    "browser": true, // 设置环境为浏览器环境
  },
  // 继承推荐规则
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
  // 解析器选项
  "parserOptions": {
    "ecmaVersion": "latest", // ECMAScript
    "parser": "@typescript-eslint/parser", // 解析器为@typescript-eslint/parser
    "sourceType": "module" // 源码类型
  },
  "plugins": [
    "@typescript-eslint",
    "vue"
  ],
  "rules": {
    // 缩进为2个空格
    "indent": [
      "error",
      2,
      { "SwitchCase": 1 }
    ],
    // 行尾风格
    "linebreak-style": ["error", process.platform === "win32"? "windows": "unix"],
    // 引号为双引号
    "quotes": [
      "error",
      "double"
    ],
    // 分号始终存在
    "semi": [
      "error",
      "always"
    ],
    // 不允许存在多余的空格
    "no-trailing-spaces": "error",
    // 要求组件名称必须是多个单词组合
    "vue/multi-word-component-names": [
      "error",
      {
        ignores: ["index"],
      },
    ],
    // 不允许使用console
    "no-console": 2,
    // 不允许存在多个空行，最多2行
    "no-multiple-empty-lines": [1, {"max": 2}],
    // 文件末尾强制换行
    "eol-last": 2,
    // 使用 === 替代 ==
    "eqeqeq": [2, "allow-null"],
    // 禁止变量声明遮蔽外部作用域中已声明的变量
    "@typescript-eslint/no-shadow": "error",
    // 关闭any类型警告
    "@typescript-eslint/no-explicit-any": "off"
  }
};
