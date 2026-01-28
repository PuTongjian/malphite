import { Command as BaseCommand } from "clipanion";

import type { CliContext } from "./context";

export abstract class Command extends BaseCommand<CliContext> {
  cmd = this.constructor.paths?.[0][0];
}
