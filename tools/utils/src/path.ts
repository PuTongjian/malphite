import { join } from "node:path";
import { fileURLToPath } from "node:url";

export class Path {
  static dir(url: string) {
    return new Path(fileURLToPath(url)).join("..");
  }

  get value() {
    return this.path;
  }

  constructor(private readonly path: string) {}

  join(...paths: string[]) {
    return new Path(join(this.path, ...paths));
  }

  parent() {
    return this.join("..");
  }
}

export const ProjectRoot = Path.dir(import.meta.url).join("../../../");
