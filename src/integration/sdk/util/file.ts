import fs from 'fs-extra';
import { v4 as uuid } from 'uuid';
import flatten from 'lodash/flatten';
import pMap from 'p-map';

const integrationCacheDirname = '.j1integration';

export async function collectDataInDirectory<T>(dir: string): Promise<T[]> {
  const filePaths = await fs.readdir(dir);

  const results = await pMap(
    filePaths,
    async (path) => {
      const rawData = await fs.readFile(`${dir}/${path}`, 'utf8');
      return JSON.parse(rawData);
    },
    { concurrency: 3 },
  );

  return flatten(results) as T[];
}

export async function writeDataToDisk(path: string, data: any) {
  await fs.ensureFile(path);
  await fs.writeFile(path, JSON.stringify(data, null, 2), data);
}

export function buildEntitiesFilePath(runId: string) {
  return `${getEntitiesDirectory()}/${runId}-${uuid()}.json`;
}

export function buildEntitiesIndexFilePath(type: string, runId: string) {
  return `${getEntitiesIndexDirectory(type)}/${runId}-${uuid()}.json`;
}

export function buildRelationshipsFilePath(runId: string) {
  return `${getRelationshipsDirectory()}/${runId}-${uuid()}.json`;
}

export function buildRelationshipsIndexFilePath(type: string, runId: string) {
  return `${getRelationshipsIndexDirectory(type)}/${runId}-${uuid()}.json`;
}

export function getEntitiesIndexDirectory(type: string) {
  return `${getEntitiesDirectory()}/index/${type}`;
}

export function getRelationshipsIndexDirectory(type: string) {
  return `${getRelationshipsDirectory()}/index/${type}`;
}

export function getEntitiesDirectory() {
  return `${getIntegrationCacheDirectory()}/entities`;
}

export function getRelationshipsDirectory() {
  return `${getIntegrationCacheDirectory()}/relationships`;
}

export function getIntegrationCacheDirectory() {
  return `${process.cwd()}/${integrationCacheDirname}`;
}
