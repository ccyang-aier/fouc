'use client';

import { QueryClient, useQuery } from '@tanstack/react-query';
import { modelCatalogSchema } from '@fouc/shared/model-catalog';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';

// Public metadata has no account boundary. Deduplicate requests across composer instances.
const catalogClient = new QueryClient();

export function useModelCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ['public-model-catalog'],
    enabled,
    staleTime: 15 * 60_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const { origin } = await getFoucApiOrigin();
      const response = await fetch(`${origin}/api/models`, { signal });
      if (!response.ok) throw new Error('Model catalog unavailable');
      return modelCatalogSchema.parse(await response.json()).items;
    },
  }, catalogClient);
}
