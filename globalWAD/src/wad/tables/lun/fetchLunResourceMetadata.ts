import type { FetchResourceMetadataFn } from '../shared/useResourceTableEnrichment';

/** OS type metadata is provided by scan results; this stub exists for future enrichment hooks. */
export const fetchLunResourceMetadata: FetchResourceMetadataFn = async resources =>
    resources.map(({ id }) => ({ id, metadata: {} }));
