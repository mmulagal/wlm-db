import { describe, expect, it } from 'vitest';
import { DATABASE_TYPE } from '@prisma/client';
import {
    assignSimulatedWorkloadOwner,
    partitionSimulatedWorkloadInventory
} from '../../../src/operations/continuous-optimization/simulated-volume-ownership';

describe('simulated volume ownership', () => {
    it('puts each volume on exactly one hashed workload, LUNs follow the parent, SVM roots and orphans are skipped', () => {
        const dataUuid = 'data-vol';
        const owner = assignSimulatedWorkloadOwner(dataUuid);
        const other = owner === DATABASE_TYPE.mssql ? DATABASE_TYPE.oracle : DATABASE_TYPE.mssql;
        const partitions = partitionSimulatedWorkloadInventory(
            [
                { volumeUuid: 'root', volumeName: 'vol0', luns: [] },
                {
                    volumeUuid: dataUuid,
                    volumeName: 'flexcache_writearound1',
                    luns: [{ lunUuid: 'child-lun', lunName: 'child-lun' }]
                }
            ],
            {
                root: { uuid: 'root', is_svm_root: true },
                [dataUuid]: { uuid: dataUuid }
            },
            {
                'child-lun': { uuid: 'child-lun', location: { volume: { uuid: dataUuid } } },
                'orphan-lun': { uuid: 'orphan-lun', location: { volume: { uuid: 'missing-vol' } } }
            }
        );

        expect(partitions[owner].volumeUuids).toEqual([dataUuid]);
        expect(partitions[other].volumeUuids).toEqual([]);
        expect(partitions[owner].lunUuids).toEqual(['child-lun']);
        expect(partitions[other].lunUuids).toEqual([]);
        expect([...partitions.mssql.lunUuids, ...partitions.oracle.lunUuids]).not.toContain('orphan-lun');
    });
});
