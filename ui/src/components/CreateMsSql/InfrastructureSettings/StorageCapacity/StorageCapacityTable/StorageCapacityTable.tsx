import { FlashingDotsLoader, Table, TooltipInfo, Typography, useTable } from '@netapp/design-system';
import styles from './StorageCapacityTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { formatFractionalNumber, isFsxnNew } from '../../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../../utils/appConstants';
import { WIZARD_TYPE } from '../../../../../utils/consts';

type StorageCapacityTableProps = {
    wizardType?: string;
};

const StorageCapacityTable = ({ wizardType = 'mssql' }: StorageCapacityTableProps) => {
    const { getEstimatedCostData, getEstimatedCostLoading } = useAppSelector(state => state.mssql);
    const selectedUnit = useAppSelector(state => state.mssqlForm.storageCapacity.unit);
    const mssqlFormData = useAppSelector(state => state.mssqlForm);
    const fsxNType = useAppSelector((state: any) => state.mssqlForm.fsxN.fsxNType);
    const [sizeData, setSizeData] = useState<any>([]);

    const sizeDataCalc = (sizeData: any) => {
        if (isFsxnNew(fsxNType)) {
            return sizeData?.total;
        } else {
            if (wizardType === WIZARD_TYPE.MSSQL) {
                return (sizeData?.data || 0) + (sizeData?.log || 0) + (sizeData?.tempdb || 0) + (sizeData?.quorum || 0);
            } else {
                if (mssqlFormData?.dbDeploymentModel?.value === 'standalone') {
                    return (sizeData?.data || 0) + (sizeData?.log || 0);
                } else {
                    return (
                        (sizeData?.data || 0) +
                        (sizeData?.log || 0) +
                        (sizeData?.dataReplica || 0) +
                        (sizeData?.logReplica || 0)
                    );
                }
            }
        }
    };

    useEffect(() => {
        const sizeData = getEstimatedCostData?.data?.fsxnStorage?.fsxnCostBreakdownById?.[0]?.size;
        let newList = [];
        newList.push({
            id: 1,
            type: GENERAL.DATA_VOLUME,
            size: sizeData?.data,
            calculation: 'Data volume size with 10% headroom'
        });
        newList.push({
            id: 2,
            type: GENERAL.LOG_VOLUME,
            size: sizeData?.log,
            calculation: `${wizardType === WIZARD_TYPE.MSSQL ? '25%' : '75%'} of ${GENERAL.DATA_SIZE}`
        });
        if (wizardType === WIZARD_TYPE.MSSQL) {
            newList.push({
                id: 3,
                type: GENERAL.TEMPDB_VOLUME,
                size: sizeData?.tempdb,
                calculation: `10% of ${GENERAL.DATA_SIZE}`
            });

            if (sizeData?.quorum) {
                newList.push({
                    id: 4,
                    type: GENERAL.QUORUM_VOLUME,
                    size: sizeData?.quorum,
                    calculation: `Disk Witness for Windows cluster in FCI deployments`
                });
            }
        }

        if (wizardType !== WIZARD_TYPE.MSSQL && mssqlFormData?.dbDeploymentModel?.value !== 'standalone') {
            newList.push({
                id: 5,
                type: GENERAL.DATA_REPLICA_VOLUME,
                size: sizeData?.dataReplica,
                calculation: `Replica data volume size`
            });

            newList.push({
                id: 6,
                type: GENERAL.LOG_REPLICA_VOLUME,
                size: sizeData?.logReplica,
                calculation: `Replica log volume size`
            });
        }

        if (isFsxnNew(fsxNType)) {
            // For existing FSX buffer size should not be considered
            newList.push({
                id: 7,
                type: GENERAL.BUFFER_SIZE,
                size: sizeData?.buffer,
                calculation: `35% headroom over total capacity`
            });
        }
        newList.push({
            id: 8,
            type: GENERAL.TOTAL_VOLUME,
            // For existing FSX removing buffer size
            size: sizeDataCalc(sizeData),
            calculation: `Total FSx for ONTAP file system SSD capacity`
        });
        setSizeData(newList);
    }, [getEstimatedCostData, mssqlFormData]);

    const dataDriveColDefs: ColumnProps[] = [
        {
            Header: 'Capacity requirements',
            accessor: 'type',
            id: '1',
            isSortable: false,
            width: '34%',
            renderCell: (cellData: any, rowData: any) => {
                if (rowData?.size <= 1024 && cellData === GENERAL.TOTAL_VOLUME && isFsxnNew(fsxNType)) {
                    return (
                        <div className={styles.minColTooltip}>
                            {cellData}{' '}
                            <TooltipInfo className={styles.tooltipClass}>
                                {GENERAL.MIN_FSX_CAPACITY_MESSAGE}
                            </TooltipInfo>
                        </div>
                    );
                } else {
                    return cellData;
                }
            }
        },
        {
            Header: 'Size',
            accessor: 'size',
            id: '2',
            width: '24.5%',
            renderCell: (cellData: any) => {
                if (selectedUnit?.label === 'TiB') {
                    return cellData
                        ? `${formatFractionalNumber((cellData || 0) / 1024, 2)} TiB`
                        : GENERAL.NOT_AVAILABLE;
                } else {
                    return cellData ? `${formatFractionalNumber(cellData || 0, 2)} GiB` : GENERAL.NOT_AVAILABLE;
                }
            }
        },
        {
            Header: 'Calculation',
            accessor: 'calculation',
            id: '3',
            width: '49%'
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: dataDriveColDefs,
        rows: sizeData,
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll: false,
        isLazyLoading: getEstimatedCostLoading
    });

    return (
        <div className={styles.table}>
            {getEstimatedCostLoading && (
                <Typography variant="Regular_14" className={styles.loadingTable}>
                    <FlashingDotsLoader />
                    <div>{GENERAL.LOADING_DATA}</div>
                </Typography>
            )}
            {!getEstimatedCostLoading && (
                <Table
                    //@ts-ignore
                    tableProps={tableProps}
                    variant="innerTable"
                />
            )}
        </div>
    );
};

export default StorageCapacityTable;
