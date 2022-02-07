export const getProp = <T, V>(
  object: T,
  keys: string[] | string,
  defaultVal?: V,
): V | undefined => {
  keys = Array.isArray(keys) ? keys : keys.split('.');
  const result = object[keys[0]];
  if (result && keys.length > 1) {
    return getProp(result, keys.slice(1));
  }
  return result === undefined ? defaultVal : result;
};
