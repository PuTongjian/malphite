import { Path } from "@malphite-tools/utils/path";
import type { Package, PackageName } from "@malphite-tools/utils/workspace";
import { Option } from "clipanion";
import { PackageCommand } from "./command";

interface RunScriptOptions {
  includeDependencies?: boolean;
  waitDependencies?: boolean;
  ignoreIfNotFound?: boolean;
}

const currentDir = Path.dir(import.meta.url);
const tsxRuntimeLoader = currentDir
  .join("../tsx-register.js")
  .toFileUrl()
  .toString();

const ingoreLoaderScripts = ["vite", "tsx"];

export class RunCommand extends PackageCommand {
  static override paths = [["run"], ["r"], PackageCommand.Default];

  static override usage = PackageCommand.Usage({
    description: "`Malphite Monorepo scripts`",
    details: `
      \`malphite dev\`             A proxy for package's \`dev\` script
    `,
  });

  args = Option.Proxy({ name: "args", required: 1 });

  async execute() {
    this.run(this.package, this.args, {
      includeDependencies: this.deps,
      waitDependencies: this.waitDeps,
    });
  }

  async run(name: PackageName, args: string[], opts: RunScriptOptions = {}) {
    opts = {
      includeDependencies: false,
      waitDependencies: true,
      ignoreIfNotFound: false,
      ...opts,
    };

    const pkg = this.workspace.getPackage(name);
    const scriptName = args[0];
    const pkgScript = pkg.scripts[scriptName];

    if (pkgScript) {
      await this.runScript(pkg, scriptName, args.slice(1), opts);
    }

    this.logger.success(name);
  }

  async runScript(
    pkg: Package,
    scriptName: string,
    args: string[],
    opts: RunScriptOptions = {},
  ) {
    const rawScript = pkg.scripts[scriptName];

    if (!rawScript) {
      if (opts.ignoreIfNotFound) {
        return;
      }

      throw new Error(`Script ${scriptName} not found in ${pkg.name}`);
    }

    const rawArgs = [...rawScript.split(" "), ...args];

    const { args: extractedArgs, envs } = this.extractEnvs(rawArgs);

    args = extractedArgs;

    if (opts.includeDependencies) {
      const depsRun = Promise.all(
        pkg.deps.map((dep) => {
          return this.runScript(
            pkg.workspace.getPackage(dep.name),
            scriptName,
            [],
            {
              ...opts,
              ignoreIfNotFound: true,
            },
          );
        }),
      );

      if (opts.waitDependencies) {
        await depsRun;
      } else {
        depsRun.catch((e) => {
          this.logger.error(e);
        });
      }
    }

    const isMalphiteCommand = args[0] === "affine";
    if (isMalphiteCommand) {
      // remove 'malphie' from 'malphite xxx' command
      args.shift();
      args.push("-p", pkg.name);

      process.env = {
        ...process.env,
        ...envs,
      };

      await this.cli.run(args);
    } else {
      await this.runCommand(pkg, rawArgs);
    }
  }

  async runCommand(_pkg: Package, args: string[]) {
    const { args: extractedArgs, envs } = this.extractEnvs(args);
    args = extractedArgs;

    const bin = args[0] === "pnpm" ? args[1] : args[0];
    const loader = tsxRuntimeLoader;
    const hasKnownLoader =
      process.env.NODE_OPTIONS?.includes("tsx") ||
      process.env.NODE_OPTIONS?.includes(tsxRuntimeLoader);

    const isLoaderRequired =
      !ingoreLoaderScripts.some((ignore) => new RegExp(ignore).test(bin)) ||
      hasKnownLoader ||
      process.env.NODE_OPTIONS?.includes(loader);

    const NODE_OPTIONS = process.env.NODE_OPTIONS
      ? [process.env.NODE_OPTIONS]
      : [];

    if (isLoaderRequired) {
      NODE_OPTIONS.push(`--import=${loader}`);
    }

    if (args[0] !== "pnpm") {
      // add 'pnpm' to the command so we can bypass bin execution to it
      args.unshift("pnpm");
    }

    // await execAsync
  }

  private extractEnvs(args: string[]) {
    const envs: Record<string, string> = {};

    let i = 0;

    while (i < args.length) {
      const arg = args[i];

      if (arg === "cross-env") {
        i++;
        continue;
      }

      const match = arg.match(/^([A-Z_]+)=(.+)$/);

      if (match) {
        envs[match[1]] = match[2];
        i++;
      } else {
        // not envs any more
        break;
      }
    }

    return {
      args: args.slice(i),
      envs,
    };
  }
}
