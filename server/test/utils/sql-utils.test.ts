import { DatabaseTypes } from '../../src/utils/consts';
import { parseMappedVolumeData } from '../../src/utils/sql-utils';

describe('parseMappedVolumeData', () => {
    it('should process Oracle volume records when volumeRecords is a records envelope', () => {
        const result = parseMappedVolumeData(
            {
                'fsx-1': {
                    volumeMappings: [
                        {
                            ORCL: {
                                isCDB: false,
                                ontapVolumes: {
                                    DATA_FILES: {
                                        records: [
                                            {
                                                volumeId: 'vol-1',
                                                volumeName: 'volume-1',
                                                lunId: 'lun-1',
                                                lunName: '/vol/volume-1/lun-1'
                                            }
                                        ],
                                        num_records: 1
                                    }
                                }
                            }
                        }
                    ]
                }
            },
            'fsx-1',
            DatabaseTypes.ORACLE
        );

        expect(result.combinedOntapVolumes).toEqual([
            {
                id: 'vol-1',
                name: 'volume-1',
                luns: [{ id: 'lun-1', name: '/vol/volume-1/lun-1' }],
                instance: 'ORCL'
            }
        ]);
        expect(result.luns).toEqual([{ id: 'lun-1', name: '/vol/volume-1/lun-1' }]);
    });

    it('should ignore Oracle volume records that are not arrays or record envelopes', () => {
        const result = parseMappedVolumeData(
            {
                'fsx-1': {
                    volumeMappings: [
                        {
                            ORCL: {
                                isCDB: false,
                                ontapVolumes: {
                                    DATA_FILES: { num_records: 1 }
                                }
                            }
                        }
                    ]
                }
            },
            'fsx-1',
            DatabaseTypes.ORACLE
        );

        expect(result.combinedOntapVolumes).toEqual([]);
        expect(result.luns).toEqual([]);
    });

    it('should ignore Oracle volume records when volumeRecords is null or undefined', () => {
        const nullResult = parseMappedVolumeData(
            {
                'fsx-1': {
                    volumeMappings: [
                        {
                            ORCL: {
                                isCDB: false,
                                ontapVolumes: {
                                    DATA_FILES: null
                                }
                            }
                        }
                    ]
                }
            },
            'fsx-1',
            DatabaseTypes.ORACLE
        );

        const undefinedResult = parseMappedVolumeData(
            {
                'fsx-1': {
                    volumeMappings: [
                        {
                            ORCL: {
                                isCDB: false,
                                ontapVolumes: {
                                    DATA_FILES: undefined
                                }
                            }
                        }
                    ]
                }
            },
            'fsx-1',
            DatabaseTypes.ORACLE
        );

        expect(nullResult.combinedOntapVolumes).toEqual([]);
        expect(nullResult.luns).toEqual([]);
        expect(undefinedResult.combinedOntapVolumes).toEqual([]);
        expect(undefinedResult.luns).toEqual([]);
    });
});
