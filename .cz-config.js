module.exports = {
  types: [
    { value: 'feat', name: '✨ Features | 新功能' },
    { value: 'fix', name: '🐛 Bug Fixes | Bug 修复' },
    { value: 'docs', name: '📝 Documentation | 文档' },
    { value: 'style', name: '💄 Styles | 风格（代码样式更改，例如空格、格式、缺少分号等）' },
    { value: 'refactor', name: '💡 Code Refactoring | 代码重构' },
    { value: 'perf', name: '⚡️ Performance Improvements | 性能优化' },
    { value: 'revert', name: '⏪ Reverts | 回退' },
    { value: 'test', name: '✅ Tests | 测试（添加缺失或修正测试代码）' },
    { value: 'chore', name: '🔨 chore（构建相关的代码或工具库，如文档生成等）' },
    { value: 'build', name: '👷‍ Build System | 构建（如升级 npm 包、修改 脚手架 配置等）' },
    { value: 'ci', name: '🔧 Continuous Integration | CI 配置' },
    { value: 'chore', name: '🎫 Chores | 其他更新（不影响源文件、测试用例）' },
  ],
  scopes: [
    ['projects', '项目搭建'],
    ['components', '组件相关'],
    ['hooks', 'hook 相关'],
    ['utils', 'utils 相关'],
    ['types', 'ts类型相关'],
    ['styles', '样式相关'],
    ['deps', '项目依赖'],
    ['auth', '对 auth 修改'],
    ['other', '其他修改'],
    ['custom', '以上都不是？我要自定义']
  ].map(([value, description]) => {
    return {
      value,
      name: `${value.padEnd(30)} (${description})`
    }
  }),
  messages: {
    type: '请选择提交类型：（必填）',
    customScope: '请输入影响范围：（可选）',
    subject: '请输入简要描述：（必填）',
    body: '请输入详细描述，使用 "|" 分行：（可选）',
    breaking: '请列出所有的破坏性变更，例如：描述、理由或迁移方式等：（可选）',
    footer: '请列出需关闭的 issue，例如：#31, #34：（可选）',
    confirmCommit: '请确认此提交信息？'
  },
  subjectLimit: 100,// subject文字长度默认
  allowCustomScopes: true,
  allowBreakingChanges: ['feat', 'fix'],
  skipQuestions: ['scope', 'footer'] //默认跳过
}