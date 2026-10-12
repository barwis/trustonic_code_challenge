export type GraphQLError = {
  message: string;
  path?: ReadonlyArray<string | number>;
};

export type GraphQLResult<TData> = {
  data: TData | undefined;
  errors: GraphQLError[];
};

type GraphQLResponseBody<TData> = {
  data?: TData | null;
  errors?: GraphQLError[];
};

export function mergeVariables<TVars>(
  base: TVars | undefined,
  patch: TVars | undefined,
  replace: boolean,
): TVars | undefined {
  return replace ? patch : ({ ...base, ...patch } as TVars);
}

export async function executeGraphQL<TData, TVars>(
  query: string,
  variables: TVars | undefined,
  signal?: AbortSignal,
): Promise<GraphQLResult<TData>> {
  let response: Response;
  try {
    response = await fetch('http://localhost:3000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    return { data: undefined, errors: [{ message: `Network error: ${(e as Error).message}` }] };
  }

  let body: GraphQLResponseBody<TData>;
  try {
    body = (await response.json()) as GraphQLResponseBody<TData>;
  } catch (e) {
    if (signal?.aborted) throw e;
    return { data: undefined, errors: [{ message: `HTTP ${response.status}: unreadable response` }] };
  }

  const errors = body.errors ?? [];
  if (!response.ok && errors.length === 0) {
    errors.push({ message: `HTTP ${response.status}` });
  }
  return { data: body.data ?? undefined, errors };
}

export function formatError(e: GraphQLError): string {
  return e.path?.length ? `${e.path.join('.')}: ${e.message}` : e.message;
}
