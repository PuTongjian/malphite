import {
  type ChildProcess,
  spawn as RawSpawn,
  type SpawnOptions,
} from "node:child_process";
import { Logger } from "./logger";

const children = new Set<ChildProcess>();

export function spawn(
  tag: string,
  cmd: string | string[],
  options?: SpawnOptions,
) {
  cmd = typeof cmd === "string" ? cmd.split(" ") : cmd;
  const isPnpmSpawn = cmd[0] === "pnpm";

  const spawnOptions: SpawnOptions = {
    stdio: isPnpmSpawn
      ? ["inherit", "inherit", "inherit"]
      : ["inherit", "pipe", "pipe"],
    shell: true,
    ...options,
    env: { ...process.env, ...options?.env },
  };

  const logger = new Logger(tag);
  logger.info(cmd.join(" "));
  const childProcess = RawSpawn(cmd[0], cmd.slice(1), spawnOptions);
  children.add(childProcess);

  // biome-ignore lint/suspicious/noExplicitAny: 需要在此处使用 any 绕过类型检查
  const drain = (_code: number | null, signal: any) => {
    children.delete(childProcess);

    if (signal === undefined) {
      childProcess.removeListener("exit", drain);
    }
  };

  logger.log(drain);
}

export function executionAsyncId(
  tag: string,
  cmd: string | string[],
  options?: SpawnOptions,
): Promise<void> {
  return new Promise<void>((_resolve, _reject) => {
    const _childProcess = spawn(tag, cmd, options);
  });
}
