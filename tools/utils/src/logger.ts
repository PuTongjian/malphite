import chalk from "chalk";
import { identity } from "lodash-es";

interface StringLike {
  toString: () => string;
}

export const newLineSeparator = /\r\n|[\n\r\x85\u2028\u2029]/g;

const loggerStyles = {
  log: chalk.bgWhite.black,
  info: chalk.bgBlueBright.whiteBright,
  warn: chalk.bgYellow.black,
  error: chalk.bgRed.whiteBright,
  success: chalk.bgGreen.black,
};

export class Logger {
  log = this.getLineLogger(console.log.bind(console), loggerStyles.log);
  info = this.getLineLogger(console.info.bind(console), loggerStyles.info);
  warn = this.getLineLogger(console.warn.bind(console), loggerStyles.warn);
  error = this.getLineLogger(console.error.bind(console), loggerStyles.error);
  success = this.getLineLogger(console.log.bind(console), loggerStyles.success);

  constructor(private readonly tag: string = "") {}

  getLineLogger(
    logLine: (...line: string[]) => void,
    color: (...text: string[]) => string = identity,
  ) {
    return (...args: StringLike[]) => {
      args.forEach((arg) => {
        arg
          .toString()
          .split(newLineSeparator)
          .forEach((line) => {
            if (line.length !== 0) {
              if (this.tag) {
                logLine(color(`[${this.tag}] ${line}`));
              } else {
                logLine(color(line));
              }
            }
          });
      });
    };
  }
}
