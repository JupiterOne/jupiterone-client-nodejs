import { Entity, Relationship, GraphDataCollector } from './types';

export class InMemoryGraphDataCollector implements GraphDataCollector {
  runId: string;
  entities: Entity[];
  relationships: Relationship[];

  constructor(runId: string) {
    this.runId = runId;
    this.entities = [];
    this.relationships = [];
  }

  hasDataToFlush() {
    return this.entities.length > 0 || this.relationships.length > 0;
  }

  addEntity(entity: Entity) {
    this.entities.push(entity);
  }

  addEntities(entities: Entity[]) {
    this.entities = this.entities.concat(entities);
  }

  addRelationship(relationship: Relationship) {
    this.relationships.push(relationship);
  }

  addRelationships(relationships: Relationship[]) {
    this.relationships = this.relationships.concat(relationships);
  }
}
