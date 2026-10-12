import { executeGraphQL, type GraphQLError, type GraphQLResult } from './transport';

const TTL_MS = 30_000;

export type Variables = Record<string, unknown>;

type EntryInfo = {
  queryKey: string;
  variables: Variables;
};

type EntrySnapshot<TData = unknown> = {
  data: TData | undefined;
  errors: GraphQLError[];
  settled: boolean;
  loading: boolean;
};

export type Predicate = (entry: EntryInfo) => boolean;

export type Updater<TData> = (data: TData) => TData;

type Layer = {
  predicate: Predicate;
  apply: Updater<unknown>;
};

type Entry = EntryInfo & {
  key: string;
  query: string;
  server: GraphQLResult<unknown> | undefined;
  fetchedAt: number;
  inflight:
    | {
        controller: AbortController;
        promise: Promise<void>;
      }
    | undefined;
  snapshot: EntrySnapshot;
};

type FetchParams = EntryInfo & {
  query: string;
};

const EMPTY: EntrySnapshot = {
  data: undefined,
  errors: [],
  settled: false,
  loading: false,
};

const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const layers = new Set<Layer>();

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export function operationName(query: string): string {
  return /\b(?:query|mutation)\s+(\w+)/.exec(query)![1];
}

export function cacheKey(query: string, queryKey: string, variables: Variables): string {
  return `${queryKey}::${stableStringify(variables)}::${query}`;
}

function publish(entry: Entry) {
  let data = entry.server?.data;
  if (data !== undefined) {
    for (const layer of layers) if (layer.predicate(entry)) data = layer.apply(data);
  }
  entry.snapshot = {
    data,
    errors: entry.server?.errors ?? [],
    settled: entry.server !== undefined,
    loading: entry.inflight !== undefined,
  };
  listeners.get(entry.key)?.forEach((l) => l());
}

export function getSnapshot<TData>(key: string): EntrySnapshot<TData> {
  return (entries.get(key)?.snapshot ?? EMPTY) as EntrySnapshot<TData>;
}

export function subscribe(key: string, listener: () => void): () => void {
  let set = listeners.get(key);

  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);

  // TODO: abort when the last subscriber leaves, deferred a tick to survive StrictMode's double mount.
  return () => {
    set.delete(listener);

    if (set.size === 0) listeners.delete(key);
  };
}

function startRequest(entry: Entry): Promise<void> {
  entry.inflight?.controller.abort();

  const controller = new AbortController();
  const promise = executeGraphQL<unknown, Variables>(entry.query, entry.variables, controller.signal).then(
    (result) => {
      if (entry.inflight?.controller !== controller) return;
      entry.inflight = undefined;
      entry.server =
        result.data === undefined && entry.server?.data !== undefined
          ? {
              data: entry.server.data,
              errors: result.errors,
            }
          : result;
      entry.fetchedAt = Date.now();
      publish(entry);
    },
    (e) => {
      if (!controller.signal.aborted) throw e;
      if (entry.inflight && entry.inflight.controller !== controller) return entry.inflight.promise;
    },
  );

  entry.inflight = {
    controller,
    promise,
  };

  publish(entry);
  return promise;
}

export function fetchQuery(p: FetchParams, opts: { force?: boolean } = {}): Promise<void> {
  const key = cacheKey(p.query, p.queryKey, p.variables);
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      ...p,
      key,
      server: undefined,
      fetchedAt: 0,
      inflight: undefined,
      snapshot: EMPTY,
    };
    entries.set(key, entry);
  }
  if (!opts.force) {
    if (entry.inflight) return entry.inflight.promise;
    if (entry.server && Date.now() - entry.fetchedAt < TTL_MS) return Promise.resolve();
  }
  return startRequest(entry);
}

function matching(predicate: Predicate): Entry[] {
  return [...entries.values()].filter(predicate);
}

export function invalidate(predicate: Predicate) {
  for (const entry of matching(predicate)) {
    entry.fetchedAt = 0;
    if (listeners.has(entry.key)) void startRequest(entry);
  }
}

export function remove(predicate: Predicate) {
  for (const entry of matching(predicate)) {
    entry.inflight?.controller.abort();
    entries.delete(entry.key);
    listeners.get(entry.key)?.forEach((l) => l());
  }
}

export function updateServerData<TData>(predicate: Predicate, update: Updater<TData>) {
  for (const entry of matching(predicate)) {
    if (entry.server?.data === undefined) continue;
    entry.server = {
      ...entry.server,
      data: update(entry.server.data as TData),
    };
    publish(entry);
  }
}

export function addOptimisticLayer<TData>(predicate: Predicate, apply: Updater<TData>): () => void {
  const layer: Layer = {
    predicate,
    apply: apply as Updater<unknown>,
  };
  const refresh = () => matching(predicate).forEach(publish);
  layers.add(layer);
  refresh();
  return () => {
    if (layers.delete(layer)) refresh();
  };
}

export function clearCache() {
  remove(() => true);
  layers.clear();
}
