import { createHash } from 'crypto';
import { DATABASE_TYPE } from '@prisma/client';
import getLogger from '../../utils/logger';

const logger = getLogger();

const SIMULATED_WORKLOADS = [DATABASE_TYPE.mssql, DATABASE_TYPE.oracle] as const;

type SimulatedWorkload = (typeof SIMULATED_WORKLOADS)[number];

interface SimulatedScopedVolume {
    volumeUuid: string;
    volumeName: string;
    luns: Array<{ lunUuid: string; lunName: string }>;
}

interface SimulatedVolumeOwnershipRecord {
    uuid: string;
    is_svm_root?: boolean;
}

interface SimulatedLunOwnershipRecord {
    uuid: string;
    name?: string;
    location?: { volume?: { uuid?: string } };
}

interface SimulatedWorkloadPartition {
    scopedVolumes: SimulatedScopedVolume[];
    volumeUuids: string[];
    lunUuids: string[];
}

type SimulatedWorkloadPartitions = Record<SimulatedWorkload, SimulatedWorkloadPartition>;

function emptyPartition(): SimulatedWorkloadPartition {
    return { scopedVolumes: [], volumeUuids: [], lunUuids: [] };
}

function rendezvousScore(id: string, workload: SimulatedWorkload): string {
    return createHash('sha256').update(`${id}\0${workload}`).digest('hex');
}

function assignSimulatedWorkloadOwner(id: string): SimulatedWorkload {
    const [mssql, oracle] = SIMULATED_WORKLOADS;
    return rendezvousScore(id, oracle) > rendezvousScore(id, mssql) ? oracle : mssql;
}

function partitionSimulatedWorkloadInventory(
    scopedVolumes: SimulatedScopedVolume[],
    volumesByUuid: Record<string, SimulatedVolumeOwnershipRecord>,
    lunsByUuid: Record<string, SimulatedLunOwnershipRecord>
): SimulatedWorkloadPartitions {
    const partitions: SimulatedWorkloadPartitions = {
        [DATABASE_TYPE.mssql]: emptyPartition(),
        [DATABASE_TYPE.oracle]: emptyPartition()
    };
    // Owner plus scoped entry per volume, so a LUN attaches to its parent without scanning the partition.
    const ownedVolumes = new Map<string, { owner: SimulatedWorkload; scoped: SimulatedScopedVolume }>();
    const assignedLunUuids = new Set<string>();
    const orphanLunUuids = new Set<string>();

    const candidateVolumes =
        scopedVolumes.length > 0
            ? scopedVolumes
            : Object.keys(volumesByUuid).map(volumeUuid => ({
                  volumeUuid,
                  volumeName: '',
                  luns: [] as SimulatedScopedVolume['luns']
              }));

    for (const scoped of candidateVolumes) {
        if (volumesByUuid[scoped.volumeUuid]?.is_svm_root !== true) {
            const owner = assignSimulatedWorkloadOwner(scoped.volumeUuid);
            const partition = partitions[owner];
            ownedVolumes.set(scoped.volumeUuid, { owner, scoped });
            partition.scopedVolumes.push(scoped);
            partition.volumeUuids.push(scoped.volumeUuid);
            for (const { lunUuid } of scoped.luns) {
                if (lunUuid) {
                    partition.lunUuids.push(lunUuid);
                    assignedLunUuids.add(lunUuid);
                }
            }
        }
    }

    for (const lun of Object.values(lunsByUuid)) {
        if (lun.uuid && !assignedLunUuids.has(lun.uuid)) {
            const parentUuid = lun.location?.volume?.uuid;
            const parent = parentUuid ? ownedVolumes.get(parentUuid) : undefined;
            if (parent) {
                partitions[parent.owner].lunUuids.push(lun.uuid);
                assignedLunUuids.add(lun.uuid);
                parent.scoped.luns.push({ lunUuid: lun.uuid, lunName: lun.name ?? '' });
            } else {
                orphanLunUuids.add(lun.uuid);
            }
        }
    }

    if (orphanLunUuids.size > 0) {
        logger.warn('Skipping simulated LUNs whose parent volume is missing from inventory', {
            lunUuids: [...orphanLunUuids]
        });
    }

    return partitions;
}

export {
    SIMULATED_WORKLOADS,
    assignSimulatedWorkloadOwner,
    partitionSimulatedWorkloadInventory,
    type SimulatedScopedVolume,
    type SimulatedWorkload,
    type SimulatedWorkloadPartition,
    type SimulatedWorkloadPartitions
};
