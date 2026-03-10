import { execSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { once } from "lodash-es";
import type { PnpmWorkspaceItem } from "./types";

function getWorkspaceDependencies(pkg: PnpmWorkspaceItem): string[] {
  const deps: (Record<string, { version?: string }> | undefined)[] = [
    pkg.dependencies,
    pkg.devDependencies,
  ];
  return deps.flatMap((d) =>
    d
      ? Object.entries(d)
          .filter(([, info]) => info?.version?.startsWith("link:"))
          .map(([name]) => name)
      : [],
  );
}

export const pnpmWorkspaces = once(() => {
  const cwd = process.cwd();

  // 使用 --depth=0 才能获取 dependencies/devDependencies
  const output = execSync("pnpm ls -r --depth=0 --json", {
    cwd,
    encoding: "utf8",
  });

  const pnpmList = JSON.parse(output) as PnpmWorkspaceItem[];

  return pnpmList
    .filter((pkg) => path.resolve(pkg.path) !== cwd)
    .map((pkg) => ({
      name: pkg.name,
      path: path.relative(cwd, pkg.path).replace(/\\/g, "/"),
      workspaceDependencies: getWorkspaceDependencies(pkg),
    }));
});
