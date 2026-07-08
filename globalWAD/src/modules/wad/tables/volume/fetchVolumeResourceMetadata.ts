import type { FetchResourceMetadataFn } from '../shared/useResourceTableEnrichment';

const MOCK_SIZE_IN_BYTES = 107_374_182_400;

export const fetchVolumeResourceMetadata: FetchResourceMetadataFn = resources =>
    new Promise(resolve => {
        setTimeout(() => {
            resolve(resources.map(({ id }) => ({ id, metadata: { sizeInBytes: MOCK_SIZE_IN_BYTES } })));
        }, 1500);
    });
