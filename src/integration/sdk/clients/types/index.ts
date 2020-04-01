import { Entity } from './entity';
import { Relationship } from './relationship';

export * from './entity';
export * from './relationship';

export interface GraphDataClient extends GraphDataCollector {
  flush: () => Promise<void>;
  hasDataToFlush: () => boolean | Promise<boolean>;

  listEntitiesByType: (
    type: string,
    cursor: string,
  ) => Entity[] | Promise<Entity[]>;
  listRelationshipsByType: (
    type: string,
    cursor: string,
  ) => Relationship[] | Promise<Relationship[]>;
}

export interface GraphDataCollector {
  runId: string;
  entities: Entity[];
  relationships: Relationship[];

  addEntity: (entity: Entity) => void | Promise<void>;
  addRelationship: (relationship: Relationship) => void | Promise<void>;
  addEntities: (entities: Entity[]) => void | Promise<void>;
  addRelationships: (relationships: Relationship[]) => void | Promise<void>;
}
