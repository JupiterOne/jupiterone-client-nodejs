import yaml from 'js-yaml';

/**
 * Pins the YAML scalar behavior the CLI (`j1cli.ts` -> `jParse`) relies on.
 *
 * js-yaml 4 moved from the YAML 1.1 schema (js-yaml 3) to the YAML 1.2 core
 * schema. That silently changes how some unquoted scalars resolve. These tests
 * lock the 1.2 behavior so a future js-yaml change that reverts it is caught.
 */
describe('js-yaml 4 (YAML 1.2 core schema) scalar parsing', () => {
  test('leading-zero integers are decimal, not octal (1.1 parsed 0777 as 511)', () => {
    expect(yaml.load('0777')).toBe(777);
  });

  test('colon-separated values are strings, not sexagesimal (1.1 parsed 12:30 as 750)', () => {
    expect(yaml.load('window: 12:30')).toEqual({ window: '12:30' });
  });

  test('explicit octal still works via the 0o prefix', () => {
    expect(yaml.load('0o777')).toBe(511);
  });
});
