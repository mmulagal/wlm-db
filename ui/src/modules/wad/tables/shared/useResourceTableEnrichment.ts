import { useCallback, useEffect, useRef, useState } from 'react';
import type { ParentResourceRef, ResourceScanRecord, WadApi } from '@tlveng/workload-factory-components';
import type { ResourceTag } from './dialogs/ResourceTagsDialog';

export type ResourceMetadataRef = {
    id: string;
    configurationId: string;
    parentResource?: ParentResourceRef;
};
export type ResourceMetadataResult = { id: string; metadata: Record<string, unknown> };
export type FetchResourceMetadataFn = (
    resources: ResourceMetadataRef[],
    signal: AbortSignal
) => Promise<ResourceMetadataResult[]>;

enum ResourceEnrichmentBatchSize {
    MAX = 20
}

const toChunks = <Type>(array: Type[], size: number): Type[][] =>
    Array.from({ length: Math.ceil(array.length / size) }, (_, index) => array.slice(index * size, (index + 1) * size));

interface TagsDialogState {
    tags: ResourceTag[];
    isPending: boolean;
}

interface UseResourceTableEnrichmentProps {
    wadApi: WadApi;
    fieldKey: string;
    fetchResourceMetadata?: FetchResourceMetadataFn;
}

export function useResourceTableEnrichment({
    wadApi,
    fieldKey,
    fetchResourceMetadata
}: UseResourceTableEnrichmentProps) {
    const abortControllerRef = useRef<AbortController>(new AbortController());
    const { configurationId } = wadApi.context;

    const inFlightIds = useRef(new Set<string>());
    const completedIds = useRef(new Set<string>());
    const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

    useEffect(() => {
        abortControllerRef.current = new AbortController();
        inFlightIds.current.clear();
        completedIds.current.clear();
        setPendingIds(new Set());
        return () => abortControllerRef.current.abort();
    }, [configurationId]);

    const handlePageRowsChange = useCallback(
        async (visibleRows: ResourceScanRecord[]) => {
            if (!fetchResourceMetadata) return;
            const { signal } = abortControllerRef.current;
            const { configurationId: currentConfigurationId } = wadApi.context;

            const isAlreadyEnriched = (row: ResourceScanRecord): boolean =>
                wadApi.getResource(row.id)?.metadata?.[fieldKey] !== undefined || completedIds.current.has(row.id);

            const toEnrich = visibleRows.filter(row => !isAlreadyEnriched(row) && !inFlightIds.current.has(row.id));
            if (toEnrich.length === 0) return;

            const batches = toChunks(toEnrich, ResourceEnrichmentBatchSize.MAX);
            await Promise.all(
                batches.map(async batch => {
                    batch.forEach(row => inFlightIds.current.add(row.id));
                    setPendingIds(
                        previousPendingIds =>
                            new Set([...previousPendingIds, ...batch.map(row => `${fieldKey}:${row.id}`)])
                    );
                    try {
                        const results = await fetchResourceMetadata(
                            batch.map(row => ({
                                id: row.id,
                                configurationId: currentConfigurationId,
                                parentResource: row.parentResource
                            })),
                            signal
                        );
                        if (signal.aborted) return;
                        batch.forEach(row => completedIds.current.add(row.id));
                        results.forEach(result => {
                            wadApi.updateResource({
                                id: result.id,
                                metadata: result.metadata
                            });
                        });
                    } catch {
                        // Leave the resource un-enriched so a later page-rows change retries it.
                    } finally {
                        batch.forEach(row => inFlightIds.current.delete(row.id));
                        if (!signal.aborted) {
                            setPendingIds(previousPendingIds => {
                                const nextPendingIds = new Set(previousPendingIds);
                                batch.forEach(row => nextPendingIds.delete(`${fieldKey}:${row.id}`));
                                return nextPendingIds;
                            });
                        }
                    }
                })
            );
        },
        [fetchResourceMetadata, wadApi, fieldKey]
    );

    const [tagsDialog, setTagsDialog] = useState<TagsDialogState | null>(null);

    const handleViewTags = useCallback(
        async (resource: ResourceScanRecord) => {
            const { signal } = abortControllerRef.current;
            const { configurationId: currentConfigurationId } = wadApi.context;
            setTagsDialog({ tags: [], isPending: true });
            try {
                const results = await fetchResourceMetadata?.(
                    [
                        {
                            id: resource.id,
                            configurationId: currentConfigurationId,
                            parentResource: resource.parentResource
                        }
                    ],
                    signal
                );
                if (signal.aborted) return;
                const metadata = results?.[0]?.metadata;
                const tags = Array.isArray(metadata?.tags) ? (metadata.tags as ResourceTag[]) : [];
                setTagsDialog({ tags, isPending: false });
            } catch {
                if (signal.aborted) return;
                setTagsDialog({ tags: [], isPending: false });
            }
        },
        [fetchResourceMetadata, wadApi]
    );

    const handleCloseTags = useCallback(() => setTagsDialog(null), []);

    return { handlePageRowsChange, pendingIds, tagsDialog, handleViewTags, handleCloseTags };
}
