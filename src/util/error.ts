import chalk from 'chalk';

export function fatal(message: string, code = 1) {
  console.log(chalk.red(message));
  process.exit(code);
}
