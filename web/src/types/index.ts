export interface Resource {
  id: number;
  cluster: string;
  namespace: string;
  kind: string;
  name: string;
  source: string;
  firstSeen: string;
  lastSeen: string;
}

export interface ResourceValue {
  key: string;
  value: string;
  valueInt?: number;
  valueFloat?: number;
  line: number;
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

export interface FilterOptions {
  clusters: string[];
  namespaces: string[];
  kinds: string[];
  names: string[];
  sources: string[];
}

export const EMPTY_FILTER_OPTIONS: FilterOptions = {
  clusters: [],
  namespaces: [],
  kinds: [],
  names: [],
  sources: [],
};

export interface GroupByResult {
  value: string;
  count: number;
}

export interface StackedGroupByResult {
  value: string;
  stacks: Record<string, number>;
}

export interface TimeseriesPoint {
  date: string;
  values: Record<string, number>;
}

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetConfig {
  id: string;
  type: "counter" | "bar" | "table" | "timeseries";
  title: string;
  query: {
    kind?: string;
    groupBy: string;
    filterKey?: string;
    filterOp?: string;
    filterValue?: string;
    stackBy?: string;
  };
  counterMode?: "total" | "distinct";
  color?: string;
  barColor?: string;
  layout?: WidgetLayout;
}

export interface KeyValueEntry {
  cluster: string;
  namespace: string;
  kind: string;
  name: string;
  key: string;
  value: string;
  valueInt?: number;
  valueFloat?: number;
  firstSeen: string;
  lastSeen: string;
  resourceId: number;
}
