import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export class Path {
  static dir(url: string) {
    return new Path(fileURLToPath(url)).join("..");
  }

  get value() {
    return this.path;
  }

  get relativePath() {
    return `./${this.path.slice(ProjectRoot.path.length).replace(/\\/g, "/")}`;
  }

  constructor(private readonly path: string) {}

  join(...paths: string[]) {
    return new Path(join(this.path, ...paths));
  }

  parent() {
    return this.join("..");
  }

  exists() {
    return existsSync(this.path);
  }

  stats() {
    return statSync(this.path);
  }

  isFile() {
    return this.exists() && this.stats().isFile();
  }

  toString() {
    return this.path;
  }
}

export const ProjectRoot = Path.dir(import.meta.url).join("../../../");
