import { logger } from './logger';
interface Enum {
  [id: number]: string | number;
}

export const handleInvalidEnum = (anEnum: Enum, target: string): boolean => {
  if (!Object.values(anEnum).includes(target)) {
    logger('Invalid reference!', target);
    logger(
      'Valid references are:',
      JSON.stringify(
        Object.values(anEnum).filter((rt) => typeof rt === 'string'),
        null,
        4,
      ),
    );

    return false;
  }
  return true;
};
