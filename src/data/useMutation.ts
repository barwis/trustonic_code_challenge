import { useCallback, useEffect, useRef, useState } from 'react';
import { executeGraphQL, formatError, mergeVariables } from './transport';

export type UseMutationResult<TData, TVars> = {
  loading: boolean;
  errors: string[];
  mutateData: (variables?: TVars, replace?: boolean) => Promise<TData | undefined>;
};

export type UseMutationOptions<TVars> = {
  variables?: TVars;
  throwError?: boolean;
};

export function useMutation<TData, TVars>(
  query: string,
  options: UseMutationOptions<TVars>,
): UseMutationResult<TData, TVars> {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const latest = useRef({ query, options });
  useEffect(() => {
    latest.current = { query, options };
  });

  const mutateData = useCallback(async (variables?: TVars, replace = false): Promise<TData | undefined> => {
    const { query: q, options: o } = latest.current;
    const vars = mergeVariables(o.variables, variables, replace);

    setLoading(true);
    setErrors([]);
    try {
      const result = await executeGraphQL<TData, TVars>(q, vars);
      const messages = result.errors.map(formatError);
      setErrors(messages);
      if (messages.length && o.throwError) throw new Error(messages.join('; '));
      return result.data;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, errors, mutateData };
}
