import { AliasToPackage } from "@malphite-tools/utils/distribution";
import { Logger } from "@malphite-tools/utils/logger";
import { type PackageName, Workspace } from "@malphite-tools/utils/workspace";
import { Command as BaseCommand, Option } from "clipanion";
import * as t from "typanion";
import type { CliContext } from "./context";

export abstract class Command extends BaseCommand<CliContext> {
  cmd = this.constructor.paths?.[0][0];

  get logger() {
    return new Logger(this.cmd);
  }

  get workspace() {
    return this.context.workspace;
  }

  set workspace(workspace: CliContext["workspace"]) {
    this.context.workspace = workspace;
  }
}

export abstract class PackageCommand extends Command {
  protected availablePackageNameArgs = (
    Workspace.PackageNames as string[]
  ).concat(Array.from(AliasToPackage.keys()));

  protected packageNameValidator = t.isOneOf(
    this.availablePackageNameArgs.map((k) => t.isLiteral(k)),
  );

  protected packageNameOrAlias = Option.String("--package,-p", {
    required: true,
    validator: this.packageNameValidator,
    description: "The package name or alias to run with",
  });

  get package(): PackageName {
    const name =
      AliasToPackage.get(this.packageNameOrAlias) ??
      (this.packageNameOrAlias as PackageName);

    this.workspace.getPackage(name);

    return name;
  }

  protected _deps = Option.Boolean("--deps", false, {
    description:
      "Execute the same command in workspace dependencies, if defined",
  });

  get deps() {
    return this._deps;
  }

  waitDeps = Option.Boolean("--wait-deps", false, {
    description: "Wait for dependencies to be ready before running the command",
  });
}
