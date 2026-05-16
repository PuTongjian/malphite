import chalk from "chalk";
import { identity } from "lodash-es";

interface StringLike {
  toString: () => string;
}

export const newLineSeparator = /\r\n|[\n\r\x85\u2028\u2029]/g;

const loggerStyles = {
  log: chalk.hex("#000000").bgHex("#B3B1AD"),
  info: chalk.hex("#000000").bgHex("#009AC4"),
  warn: chalk.hex("#000000").bgHex("#F2AE54"),
  error: chalk.hex("#000000").bgHex("#E94332"),
  success: chalk.hex("#000000").bgHex("#86B300"),
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
