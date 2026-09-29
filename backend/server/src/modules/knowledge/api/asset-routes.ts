import { TRPCError } from '@trpc/server';
import { assetDownloadInputSchema, assetUploadInputSchema } from '@fouc/shared/knowledge/contracts';
import { KnowledgeAssetError } from '../assets/errors';
import { knowledgeAssetStorage } from '../assets/runtime';
import { confirmWorkspaceAssetUpload, prepareWorkspaceAssetUpload, presignWorkspaceAssetDownload } from '../assets/service';
import { knowledgeMutation, knowledgeQuery } from './procedures';

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof KnowledgeAssetError) {
      const code = error.code === 'ASSET_ACCESS_DENIED' ? 'FORBIDDEN'
        : error.code === 'ASSET_NOT_FOUND' ? 'NOT_FOUND'
          : error.code === 'ASSET_STORAGE_UNAVAILABLE' ? 'SERVICE_UNAVAILABLE' : 'BAD_REQUEST';
      throw new TRPCError({ code });
    }
    throw error;
  }
}

export const knowledgeAssetRouterRecord = {
  prepare: knowledgeMutation({
    input: assetUploadInputSchema.omit({ userId: true }), scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant((db, authority) =>
      prepareWorkspaceAssetUpload(knowledgeAssetStorage(), db, { ...input, userId: authority.userId }))),
  }),
  confirm: knowledgeMutation({
    input: assetUploadInputSchema.omit({ userId: true }), scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant((db, authority) =>
      confirmWorkspaceAssetUpload(knowledgeAssetStorage(), db, { ...input, userId: authority.userId }))),
  }),
  download: knowledgeQuery({
    input: assetDownloadInputSchema.omit({ userId: true }), scopes: ['read'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant((db, authority) =>
      presignWorkspaceAssetDownload(knowledgeAssetStorage(), db, { ...input, userId: authority.userId }))),
  }),
};
