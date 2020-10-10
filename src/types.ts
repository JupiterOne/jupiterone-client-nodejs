export type EntityPropertyValuePrimitive = string | number | boolean;

export type EntityPropertyValue =
  | EntityPropertyValuePrimitive
  | EntityPropertyValuePrimitive[]
  | undefined
  | null;

export type EntityAdditionalProperties = Record<string, EntityPropertyValue>;

export type Entity = EntityAdditionalProperties & {
  _id: string;
  _type: string;
  _class?: string | string[];
  displayName: string;
};

export type RelationshipPropertyValuePrimitive = string | number | boolean;

export type RelationshipPropertyValue =
  | RelationshipPropertyValuePrimitive
  | undefined
  | null;

export type RelationshipAdditionalProperties = Record<
  string,
  RelationshipPropertyValue
>;

export type Relationship = RelationshipAdditionalProperties & {
  _id: string;
  _type: string;
  _class?: string;
  displayName: string;
};

export type GraphObject = Entity | Relationship;

export type EntityForSync = EntityAdditionalProperties & {
  _key: string;
  _class: string | string[];
  _type: string;
  _rawData?: Record<
    string,
    {
      body: string;
      contentType: 'application/json';
    }
  >;
};

export type RelationshipForSync = RelationshipAdditionalProperties & {
  _key: string;
  _class: string | string[];
  _type: string;
  _fromEntityId?: string;
  _toEntityId?: string;
  _fromEntityKey?: string;
  _toEntityKey?: string;
};
