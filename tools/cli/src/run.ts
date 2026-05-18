import type { Package, PackageName } from "@malphite-tools/utils/workspace";
import { Option } from "clipanion";
import { PackageCommand } from "./command";

interface RunScriptOptions {
  includeDependencies?: boolean;
  waitDependencies?: boolean;
  ignoreIfNotFound?: boolean;
}

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
    }
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
