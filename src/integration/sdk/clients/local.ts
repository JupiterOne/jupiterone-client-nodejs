import groupBy from 'lodash/groupBy';

import { Entity, Relationship, GraphDataClient } from './types';
import { InMemoryGraphDataCollector } from './memory';

import {
  writeDataToDisk,
  collectDataInDirectory,
  buildEntitiesFilePath,
  buildEntitiesIndexFilePath,
  getEntitiesIndexDirectory,
  buildRelationshipsFilePath,
  buildRelationshipsIndexFilePath,
  getRelationshipsIndexDirectory,
} from '../util/file';

export class LocalGraphDataClient extends InMemoryGraphDataCollector
  implements GraphDataClient {
  constructor(runId: string) {
    super(runId);
  }

  async flush() {
    const entitiesPath = buildEntitiesFilePath(this.runId);
    const relationshipsPath = buildRelationshipsFilePath(this.runId);

    const entitiesGroupedByType = groupBy(this.entities, '_type');
    const relationshipsGroupedByType = groupBy(this.relationships, '_type');

    await Promise.all([
      writeDataToDisk(entitiesPath, this.entities),
      writeDataToDisk(relationshipsPath, this.relationships),
      ...Object.entries(entitiesGroupedByType).map(([type, value]) =>
        writeDataToDisk(buildEntitiesIndexFilePath(type, this.runId), value),
      ),
      ...Object.entries(relationshipsGroupedByType).map(([type, value]) =>
        writeDataToDisk(
          buildRelationshipsIndexFilePath(type, this.runId),
          value,
        ),
      ),
    ]);

    this.entities = [];
    this.relationships = [];
  }

  async listEntitiesByType(type: string): Promise<Entity[]> {
    return [
      ...this.entities.filter((e: Entity) => e._type === type),
      ...(await collectDataInDirectory<Entity>(
        getEntitiesIndexDirectory(type),
      )),
    ];
  }

  async listRelationshipsByType(type: string): Promise<Relationship[]> {
    return [
      ...this.relationships.filter((e: Entity) => e._type === type),
      ...(await collectDataInDirectory<Relationship>(
        getRelationshipsIndexDirectory(type),
      )),
    ];
  }
}
