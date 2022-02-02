import c from 'chance';
const chance = new c();

interface Entity {
  _key: string;
  _class: string;
  _type: string;
  displayName: string;
  from: string;
}

export const generateEntity = (): Entity => {
  const packageName = chance.word();

  return {
    _key: `npm_package:${packageName}`,
    _class: 'CodeModule',
    _type: 'npm_package',
    displayName: packageName,
    from: 'testing',
  };
};

export const generateNumberOfEntities = (records: number): Entity[] => {
  return [...Array(records)].map(generateEntity);
};
