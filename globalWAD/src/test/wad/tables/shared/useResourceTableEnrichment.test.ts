import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useResourceTableEnrichment } from '@wad/tables/shared/useResourceTableEnrichment';
import { createMockResource, createMockWadApi } from '@test/helpers/testUtils';

describe('useResourceTableEnrichment', () => {
    it('updates resources from fetched metadata', async () => {
        const updateResource = vi.fn();
        const fetchResourceMetadata = vi.fn().mockResolvedValue([{ id: 'resource-1', metadata: { sizeInBytes: 100 } }]);
        const wadApi = createMockWadApi({ updateResource, getResource: vi.fn().mockReturnValue(undefined) });

        const { result } = renderHook(() =>
            useResourceTableEnrichment({
                wadApi,
                fieldKey: 'sizeInBytes',
                fetchResourceMetadata
            })
        );

        await result.current.handlePageRowsChange([createMockResource('resource-1')]);

        await waitFor(() => {
            expect(updateResource).toHaveBeenCalledWith({
                id: 'resource-1',
                metadata: { sizeInBytes: 100 }
            });
        });
    });

    it('loads tags into dialog state when viewing tags', async () => {
        const fetchResourceMetadata = vi
            .fn()
            .mockResolvedValue([{ id: 'resource-1', metadata: { tags: [{ key: 'env', value: 'dev' }] } }]);
        const wadApi = createMockWadApi();

        const { result } = renderHook(() =>
            useResourceTableEnrichment({
                wadApi,
                fieldKey: 'tags',
                fetchResourceMetadata
            })
        );

        await result.current.handleViewTags(createMockResource('resource-1'));

        await waitFor(() => {
            expect(result.current.tagsDialog).toEqual({
                tags: [{ key: 'env', value: 'dev' }],
                isPending: false
            });
        });
    });
});
