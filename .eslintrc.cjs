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
    // 数组两端不允许空格
    "array-bracket-spacing": ["error", "never"],
    // 对象两端总是有空格
    "object-curly-spacing": ["error","always"],
    // 不允许存在多余的空格
    "no-trailing-spaces": "error",
    // 不允许使用console
    "no-console": 2,
    // 不允许存在多个空行，最多2行
    "no-multiple-empty-lines": [1, { "max": 2 }],
    // 文件末尾强制换行
    "eol-last": 2,
    // 使用 === 替代 ==
    "eqeqeq": [2, "allow-null"],
    // 禁止变量声明遮蔽外部作用域中已声明的变量
    "@typescript-eslint/no-shadow": "error",
    // 关闭any类型警告
    "@typescript-eslint/no-explicit-any": "off",
    // 要求组件名称必须是多个单词组合
    "vue/multi-word-component-names": [
      "error",
      {
        ignores: ["index"],
      },
    ],
    "vue/html-indent": ["error", 2],
    "vue/v-on-function-call": ["error", "never"],
    "vue/no-ref-object-destructure": "error",
    "vue/component-tags-order": ["error", {
      "order": ["template", "script", "style"]
    }],
    "vue/space-infix-ops": "error",
    "vue/space-in-parens": ["error", "never"],
    "vue/prefer-template": "error",
    "vue/attribute-hyphenation": ["error", "always", {
      "ignore": []
    }],
    "vue/first-attribute-linebreak": ["error", {
      "singleline": "beside",
      "multiline": "below"
    }],
    "vue/html-closing-bracket-newline": [
      "error",
      {
        "singleline": "never",
        "multiline": "never",
        "selfClosingTag": {
          "singleline": "never",
          "multiline": "never"
        }
      }
    ],
    "vue/html-closing-bracket-spacing": ["error", {
      "startTag": "never",
      "endTag": "never",
      "selfClosingTag": "always"
    }],
    "vue/html-quotes": ["error", "double", { "avoidEscape": false }],
    "vue/max-attributes-per-line": ["error", {
      "singleline": {
        "max": 2
      },
      "multiline": {
        "max": 1
      }
    }],
    "vue/multiline-html-element-content-newline": ["error", {
      "ignoreWhenEmpty": true,
      "ignores": [],
      "allowEmptyLines": false
    }],
    "vue/singleline-html-element-content-newline": ["error", {
      "ignoreWhenNoAttributes": true,
      "ignoreWhenEmpty": true,
      "ignores": [],
      "externalIgnores": []
    }],
    "vue/mustache-interpolation-spacing": ["error", "always"],
    "vue/no-multi-spaces": ["error", { "ignoreProperties": false }],
    "vue/no-spaces-around-equal-signs-in-attribute": ["error"],
    "vue/no-template-shadow": ["error", { "allow": [] }],
    "vue/require-default-prop": "error",
    "vue/v-slot-style": ["error", {
      "atComponent": "shorthand",
      "default": "shorthand",
      "named": "shorthand",
    }],
    "vue/attributes-order": ["error", {
      "order": [
        "DEFINITION",
        "LIST_RENDERING",
        "CONDITIONALS",
        "RENDER_MODIFIERS",
        "GLOBAL",
        ["UNIQUE", "SLOT"],
        "TWO_WAY_BINDING",
        "OTHER_DIRECTIVES",
        "OTHER_ATTR",
        "EVENTS",
        "CONTENT"
      ],
      "alphabetical": false
    }]
  }
};
