import { RelationshipForSync } from '@jupiterone/jupiterone-client-nodejs/dist/types';
import c from 'chance';
const chance = new c();

export enum RelationshipTypes {
  ID_TO_KEY,
  KEY_TO_KEY,
  KEY_WITH_SCOPE_AND_SOURCE_TO_KEY,
}

interface RelationshipConnections {
  _fromEntityId?: string;
  _fromEntityKey?: string;
  _toEntityKey?: string;
  _fromEntitySource?: string;
  _fromEntityScope?: string;
}

const relationshipConnections = {
  // This will work -
  // Matches on IDs are not source/scope specific
  // Our `entityTo` is within the scope/source of our upload
  [RelationshipTypes.ID_TO_KEY]: (
    entityFrom,
    entityTo,
  ): RelationshipConnections => {
    return {
      _fromEntityId: entityFrom.entity._id,
      _toEntityKey: entityTo.entity._key,
    };
  },
  // This will NOT work -
  // Our `entityFrom` _key is in a different scope/source and we didn't specify that
  // Our `entityTo` is within the scope/source of our upload
  [RelationshipTypes.KEY_TO_KEY]: (
    entityFrom,
    entityTo,
  ): RelationshipConnections => {
    return {
      _fromEntityKey: entityFrom.entity._key,
      _toEntityKey: entityTo.entity._key,
    };
  },
  // This will work -
  // Our `entityFrom` _key is in a different scope/source and we DID specify it
  // Our `entityTo` is within the scope/source of our upload
  [RelationshipTypes.KEY_WITH_SCOPE_AND_SOURCE_TO_KEY]: (
    entityFrom,
    entityTo,
  ): RelationshipConnections => {
    return {
      _fromEntitySource: entityFrom.entity._source,
      _fromEntityScope: entityFrom.entity._integrationInstanceId,
      _fromEntityKey: entityFrom.entity._key,
      _toEntityKey: entityTo.entity._key,
    };
  },
};

export const generateRelationships = (
  entitiesFrom,
  entitiesTo,
  relationshipType,
): RelationshipForSync[] => {
  return entitiesFrom.map((entityFrom, i) => {
    const entityTo = entitiesTo[i];
    const version = chance.semver();

    console.log('relationshipType :>> ', relationshipType);

    return {
      _key: `${entityTo.entity.displayName}:USES:${entityFrom.entity.displayName}`,
      _type: 'code_repo:USES:npm_package',
      _class: 'USES',
      displayName: `USES v${version}`,
      version,
      ...(relationshipConnections?.[relationshipType]?.(entityFrom, entityTo) ??
        {}),
    };
  });
};
