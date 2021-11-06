export const getEnvironmentVariable = (
  key: string,
  defaultValue?: any,
): any => {
  let pointer = process.env[key];

  if (pointer === undefined) {
    console.warn(`There is no environment variable set for ${key}.`);

    if (defaultValue !== undefined) {
      console.warn(`Using a default value of ${defaultValue}`);
      pointer = defaultValue;
    }
  }

  return pointer;
};
