import { compact, isEmpty } from 'lodash-es';

import { describeFSx } from '../../lib/aws/fsx';
import getLogger from '../../utils/logger';
import type { CrrDetails } from '../../utils/common-types';

const logger = getLogger();

/**
 * Resolves which peer FSx IDs represent cross-region replicas by describing
 * each peer file system and comparing its region to the source region.
 * A peer is considered cross-region when:
 *   - describe returns an ARN in a different region, OR
 *   - describe throws FileSystemNotFound (the peer exists in a region
 *     the caller's credentials can't see from the source region)
 *
 * Uses a single batched DescribeFileSystems call as the happy path.
 * Falls back to per-ID calls only when the batch throws FileSystemNotFound,
 * since that error doesn't identify which ID was missing.
 */
async function resolveCrossRegionPeerIds(
    crrDetails: CrrDetails[],
    credentialsId: string,
    region: string,
    accountId: string,
    sourceFsxIds?: Set<string>
): Promise<Set<string>> {
    const allPeerIds = [...new Set(compact(crrDetails.map(d => d.peerClusterFsxId).flat()) as string[])];
    const peerFileSystemIds = sourceFsxIds ? allPeerIds.filter(id => !sourceFsxIds.has(id)) : allPeerIds;
    const crossRegionPeerIds = new Set<string>();

    if (isEmpty(peerFileSystemIds)) {
        return crossRegionPeerIds;
    }

    try {
        const fsxInfoBatch = await describeFSx(credentialsId, region, { FileSystemIds: peerFileSystemIds }, accountId, {
            useCache: true
        });
        for (const fs of fsxInfoBatch?.FileSystems ?? []) {
            const peerRegion = fs.ResourceARN?.split(':')[3];
            if (peerRegion && peerRegion !== region && fs.FileSystemId) {
                crossRegionPeerIds.add(fs.FileSystemId);
            }
        }
    } catch (error: unknown) {
        if ((error as { name?: string })?.name !== 'FileSystemNotFound') {
            logger.error('Error batch-describing peer FSx filesystems', { peerFileSystemIds, error });
            return crossRegionPeerIds;
        }
        await Promise.all(
            peerFileSystemIds.map(async (peerFileSystemId: string) => {
                try {
                    const fsxInfo = await describeFSx(
                        credentialsId,
                        region,
                        { FileSystemIds: [peerFileSystemId] },
                        accountId,
                        { useCache: true }
                    );
                    const peerRegion = fsxInfo?.FileSystems?.[0]?.ResourceARN?.split(':')[3];
                    if (peerRegion && peerRegion !== region) {
                        crossRegionPeerIds.add(peerFileSystemId);
                    }
                } catch (individualError: unknown) {
                    if ((individualError as { name?: string })?.name === 'FileSystemNotFound') {
                        crossRegionPeerIds.add(peerFileSystemId);
                    } else {
                        logger.error('Error describing peer FSx filesystem', {
                            peerFileSystemId,
                            error: individualError
                        });
                    }
                }
            })
        );
    }

    return crossRegionPeerIds;
}

/**
 * Sets `isCRREnabled` on each CRR detail based on whether any of its
 * peer FSx IDs appear in the resolved cross-region set.
 *
 * @param preserveExisting - When true, uses `||` so a pre-existing
 *   `isCRREnabled: true` (e.g. set by the SSM script) is never cleared.
 */
function updateCrrDetailsWithCrossRegionStatus(
    crrDetails: CrrDetails[],
    crossRegionPeerIds: Set<string>,
    preserveExisting = false
): void {
    crrDetails.forEach(crrDetail => {
        const peerIds = (
            Array.isArray(crrDetail.peerClusterFsxId) ? crrDetail.peerClusterFsxId : [crrDetail.peerClusterFsxId]
        ).filter((id): id is string => !!id);
        const isCrossRegion = peerIds.some(id => crossRegionPeerIds.has(id));
        crrDetail.isCRREnabled = preserveExisting ? crrDetail.isCRREnabled || isCrossRegion : isCrossRegion;
    });
}

export { resolveCrossRegionPeerIds, updateCrrDetailsWithCrossRegionStatus };
