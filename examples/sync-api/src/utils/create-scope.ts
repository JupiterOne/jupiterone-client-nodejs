import fs from 'fs';
import { v4 as uuidV4 } from 'uuid';

const j1UniqueKeyFileLocation = `${process.cwd()}/j1-scope-key`;

export const createScope = () => {
  let scope;
  if (!fs.existsSync(j1UniqueKeyFileLocation)) {
    scope = uuidV4();
    fs.writeFileSync(j1UniqueKeyFileLocation, scope, 'utf8');
  } else {
    scope = fs.readFileSync(j1UniqueKeyFileLocation, 'utf8');
  }

  return scope;
};
