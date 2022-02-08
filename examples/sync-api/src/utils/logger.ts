import chalk from 'chalk';

export const logger = (...messages: string[]): void => {
  console.log(chalk.red(...messages));
};

export const successLog = (...messages: string[]): void => {
  console.log(chalk.green(...messages));
};
