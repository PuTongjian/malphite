import type { Package } from "@malphite-tools/utils/workspace";
import { Option } from "clipanion";
import { createServer } from "vite";
import { PackageCommand } from "./command";
import { createHTMLTargetConfig } from "./vite/index";

export class BundleCommand extends PackageCommand {
  static override paths = [["bundle"], ["pack"], ["bun"]];

  override _deps = false;
  override waitDeps = false;

  dev = Option.Boolean("--dev,-d", false, {
    description: "Run in Development mode",
  });

  async execute() {
    const pkg = this.workspace.getPackage(this.package);

    if (this.dev) {
      await BundleCommand.dev(pkg);
    }
  }

  static async dev(pkg: Package) {
    process.env.NODE_ENV = "development";

    const server = await createServer(createHTMLTargetConfig(pkg));

    await server.listen();
    server.printUrls();
  }
}
