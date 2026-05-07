# Malphite

当前这是一个基于 `pnpm workspace` 的 monorepo，主要目标是实现一个名为 `malphite` 的 CLI 工具。

## 项目现状

- 仓库结构已经搭好，包含根配置、CLI 包、utils 包和一个 `core` 包占位。
- 当前真正有实质逻辑的命令主要是 `init`。
- `run` 和 `dev` 命令还处于占位实现阶段。
- `packages/frontend/core` 目前基本还是空壳。
- 当前执行 `pnpm typecheck` 无 TypeScript 报错。

## 仓库结构

```text
.
├── package.json
├── pnpm-workspace.yaml
├── biome.json
├── tsconfig.json
├── tsconfig.node.json
├── packages/
│   └── frontend/
│       └── core/
│           └── package.json
└── tools/
    ├── cli/
    │   ├── bin/runner.js
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── command.ts
    │       ├── context.ts
    │       ├── dev.ts
    │       ├── init.ts
    │       ├── malphite.ts
    │       └── run.ts
    └── utils/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── package.ts
            ├── path.ts
            ├── pnpm.ts
            ├── types.ts
            ├── workspace-gen.ts
            └── workspace.ts
```

## 文件与功能说明

### 根目录

#### `package.json`

- 根包配置。
- 定义了 `malphite`、`typecheck`、`postinstall` 等脚本。
- `postinstall` 会执行 `pnpm malphite init`，用于生成 workspace 相关文件。

待完成：

- 补充 `description`、`author` 等基础元信息。
- 增加真实测试脚本。
- 如果后续要正式发布，`main: index.js` 需要和真实产物对应。

#### `pnpm-workspace.yaml`

- 定义 monorepo 包范围：
  - `tools/**`
  - `packages/**`
- 统一管理 catalog 依赖版本。

待完成：

- 后续新增包时同步维护 workspace 范围和 catalog。

#### `biome.json`

- 统一格式化、lint 和 import organize 规则。

待完成：

- 可按团队约定继续收紧或补充规则。

#### `tsconfig.json`

- 全局 TypeScript 严格配置。
- 当前项目引用只挂了 `tools/cli`。

待完成：

- 如果后面要做完整构建图，建议把 `tools/utils` 和 `packages/frontend/core` 也纳入引用。

#### `tsconfig.node.json`

- Node 环境专用 TS 配置扩展。

待完成：

- 当前无明显待补逻辑。

#### `pnpm-lock.yaml`

- 依赖锁文件。

待完成：

- 无需手工维护，跟随依赖变更自动更新。

### `tools/cli`

#### `tools/cli/package.json`

- CLI 包定义。
- 暴露二进制命令 `r`。

待完成：

- 如果后续要发布，建议补齐正式构建产物与导出方式。

#### `tools/cli/tsconfig.json`

- CLI 包的 TypeScript 编译配置。
- 输出目录为 `dist`。

待完成：

- 可以补充与其他 workspace 包的构建引用关系。

#### `tools/cli/bin/runner.js`

- CLI 运行器。
- 负责定位待执行的 JS/TS 文件。
- TS 文件通过 `tsx/esm` 运行。
- 支持 `MALPHITE_DEBUG=1` 时注入 `--inspect-brk` 便于调试。

待完成：

- 错误提示和路径查找策略还能继续打磨。
- 发布态和源码态的兼容策略还可以再明确。

#### `tools/cli/src/malphite.ts`

- CLI 总入口。
- 注册 `run`、`dev`、`init` 命令。
- 初始化 `Workspace` 并注入命令上下文。

待完成：

- 后续继续注册真正可用的命令。

#### `tools/cli/src/command.ts`

- 所有 CLI 命令的基类。
- 封装了 `workspace` 的读写访问。

待完成：

- 如果后续命令增多，可以继续放公共 helper。

#### `tools/cli/src/context.ts`

- 定义 CLI 上下文类型 `CliContext`。

待完成：

- 只有在上下文信息增多时才需要继续扩展。

#### `tools/cli/src/run.ts`

- 定义 `run/r` 命令。
- 当前只接收代理参数并输出占位内容。

待完成：

- `execute()` 目前没有真正执行逻辑。
- `usage` 文案里还残留了 `affine dev`，应清理为当前项目文案。
- 需要明确它最终是做脚本代理、包脚本路由，还是任务执行器。

#### `tools/cli/src/dev.ts`

- 定义 `dev/d` 命令。
- 当前只输出占位内容。

待完成：

- 需要补真正的开发模式逻辑。
- 需要明确 dev 命令是启动某个包、某类任务，还是统一的 monorepo 开发入口。

#### `tools/cli/src/init.ts`

- 当前仓库里最核心的命令实现。
- 会扫描 pnpm workspace。
- 根据结果生成 `tools/utils/src/workspace-gen.ts`。
- 生成后会用 Biome 做格式化。

待完成：

- 注释中预留了 `genProjectTsConfig`，还未实现。
- 后续如果要把它做成完整脚手架，可以继续在这里补更多生成逻辑。

### `tools/utils`

#### `tools/utils/package.json`

- utils 包定义。
- 当前导出 `workspace` 和 `path`。

待完成：

- 如果后面要稳定对外消费，最好明确正式构建产物。

#### `tools/utils/tsconfig.json`

- utils 包的 TypeScript 编译配置。

待完成：

- 后续如果接入完整构建链，建议和根项目引用联动。

#### `tools/utils/src/path.ts`

- 轻量路径封装。
- 提供 `Path` 类、`join()`、`parent()` 和 `ProjectRoot`。

待完成：

- 如后续需要更多文件系统能力，可继续扩展。

#### `tools/utils/src/types.ts`

- 定义 `pnpm ls --json` 输出相关类型。

待完成：

- 如果后面要解析更多字段，再补类型。

#### `tools/utils/src/pnpm.ts`

- 负责执行 `pnpm ls -r --depth=0 --json`。
- 将 workspace 信息转换为内部结构。
- 支持读取 workspace 依赖关系。

待完成：

- 当前 `workspaceDependencies` 保存的是相对路径，不是包名。
- 如果后续要做依赖图、任务筛选或拓扑排序，建议换成更稳定的数据结构。

#### `tools/utils/src/package.ts`

- 单个 workspace 包的抽象。
- 封装包名、路径和所属 workspace。

待完成：

- 后续可扩展读取 `package.json`、执行脚本、读取依赖等能力。

#### `tools/utils/src/workspace.ts`

- 整个 workspace 的抽象。
- 管理包列表。
- 提供按名查包与路径拼接能力。

待完成：

- 构造函数里还有调试用的 `console.log(list)`，应移除。
- 后续可以继续补过滤、遍历、依赖解析等能力。

#### `tools/utils/src/workspace-gen.ts`

- 自动生成文件。
- 保存当前 workspace 的包列表和 `PackageName` 联合类型。

待完成：

- 不建议手工修改，应统一由 `init` 生成。

### `packages/frontend/core`

#### `packages/frontend/core/package.json`

- `@malphite/core` 包定义。
- 当前只有最基础的 npm 元信息和默认测试脚本。

待完成：

- 目前没有源码目录、导出和真实测试。
- 基本可以视为还未开始实现。

## 当前最值得优先补的部分

1. 完成 `tools/cli/src/run.ts` 的真实执行逻辑。
2. 完成 `tools/cli/src/dev.ts` 的真实开发模式逻辑。
3. 清理遗留占位文案和调试输出。
4. 明确 `@malphite/core` 的职责并开始补源码结构。
5. 补基础测试和更完整的构建引用关系。

## 快速回顾这个项目时，优先看这几个文件

1. `package.json`
2. `tools/cli/bin/runner.js`
3. `tools/cli/src/malphite.ts`
4. `tools/cli/src/init.ts`
5. `tools/utils/src/pnpm.ts`
6. `tools/utils/src/workspace.ts`

## 一句话总结

这个仓库当前更像是一个正在搭骨架的 monorepo CLI 工具工程：基础结构和一部分 workspace 元数据生成能力已经有了，但实际命令能力和 `core` 包内容还没有完成。
