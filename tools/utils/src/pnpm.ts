import { execSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import type { PnpmWorkspaceItem } from "./types";

export function pnpmWorkspaces() {
  const cwd = process.cwd();

  const output = execSync("pnpm ls -r --depth=-1 --json", {
    cwd,
    encoding: "utf8",
  });

  const pnpmList = JSON.parse(output) as PnpmWorkspaceItem[];

  return pnpmList
    .filter((pkg) => path.resolve(pkg.path) !== cwd)
    .map((pkg) => ({
      name: pkg.name,
      path: path.relative(cwd, pkg.path).replace(/\\/g, "/"),
    }));
}
