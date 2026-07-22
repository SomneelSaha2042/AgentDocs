let queryClient;
let lastMutationOptions;

export function __setQueryClient(client) {
  queryClient = client;
}

export function __getLastMutationOptions() {
  return lastMutationOptions;
}

export function useQueryClient() {
  if (!queryClient) throw new Error('No query client set');
  return queryClient;
}

export function useMutation(options) {
  if (!options || typeof options !== 'object' || !('mutationFn' in options)) {
    throw new Error('useMutation must be called with v5 object syntax');
  }
  lastMutationOptions = options;
  return { __kind: 'mutation', options };
}