import { FlashingDotsLoader, Table, TooltipInfo, Typography, useTable } from '@netapp/design-system';
import styles from './StorageCapacityTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { formatFractionalNumber, isFsxnNew } from '../../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../../utils/appConstants';

const StorageCapacityTable = () => {
    const { getEstimatedCostData, getEstimatedCostLoading } = useAppSelector(state => state.mssql);
    const selectedUnit = useAppSelector(state => state.mssqlForm.storageCapacity.unit);
    const fsxNType = useAppSelector((state: any) => state.mssqlForm.fsxN.fsxNType);
    const [sizeData, setSizeData] = useState<any>([]);

    useEffect(() => {
        const sizeData = getEstimatedCostData?.data?.fsxnStorage?.size;
        let newList = [];
        newList.push({
            id: 1,
            type: GENERAL.DATA_VOLUME,
            size: sizeData?.data,
            calculation: 'Data volume size with 10% buffer'
        });
        newList.push({
            id: 2,
            type: GENERAL.LOG_VOLUME,
            size: sizeData?.log,
            calculation: `25% of ${GENERAL.DATA_SIZE}`
        });
        newList.push({
            id: 3,
            type: GENERAL.TEMPDB_VOLUME,
            size: sizeData?.tempdb,
            calculation: `10% of ${GENERAL.DATA_SIZE}`
        });
        newList.push({
            id: 4,
            type: GENERAL.QUORUM_VOLUME,
            size: sizeData?.quorum,
            calculation: `Witness disk for Windows cluster`
        });
        if (isFsxnNew(fsxNType)) {
            // For existing FSX buffer size should not be considered
            newList.push({
                id: 5,
                type: GENERAL.BUFFER_SIZE,
                size: sizeData?.buffer,
                calculation: `Upto 20% headroom over total capacity`
            });
        }
        newList.push({
            id: 6,
            type: GENERAL.TOTAL_VOLUME,
            // For existing FSX removing buffer size
            size: isFsxnNew(fsxNType) ? sizeData?.total : sizeData?.total - (sizeData?.buffer || 0),
            calculation: `Total FSx for ONTAP SSD capacity`
        });
        setSizeData(newList);
    }, [getEstimatedCostData]);

    const dataDriveColDefs: ColumnProps[] = [
        {
            Header: 'Volume type',
            accessor: 'type',
            id: '1',
            isSortable: false,
            width: '290px',
            renderCell: (cellData: any, rowData: any) => {
                if (rowData?.size <= 1024 && cellData === GENERAL.TOTAL_VOLUME) {
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
            width: '240px',
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
            width: '350px'
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: dataDriveColDefs,
        rows: sizeData,
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll: true,
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
