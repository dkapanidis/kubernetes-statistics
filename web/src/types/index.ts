export interface Resource {
  id: number;
  cluster: string;
  namespace: string;
  kind: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
}

export interface ResourceValue {
  key: string;
  value: string;
  valueInt?: number;
  valueFloat?: number;
  firstSeen: string;
  lastSeen: string;
}

export interface ResourceDetail extends Resource {
  values: ResourceValue[];
}

export interface StatEntry {
  label: string;
  count: number;
}

export interface Stats {
  totalResources: number;
  byKind: StatEntry[];
  byCluster: StatEntry[];
}
