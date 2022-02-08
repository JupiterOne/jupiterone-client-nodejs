export const sleep = async (time: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      return resolve(true);
    }, time);
  });
};
