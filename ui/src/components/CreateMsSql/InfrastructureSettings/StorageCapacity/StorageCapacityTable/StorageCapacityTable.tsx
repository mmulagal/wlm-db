import { FlashingDotsLoader, Table, TooltipInfo, Typography, useTable } from '@netapp/design-system';
import styles from './StorageCapacityTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { formatFractionalNumber } from '../../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../../utils/appConstants';
import { ReactComponent as NoDataIcon } from '../../../../../assets/ic_file.svg';

const StorageCapacityTable = () => {
    const { getEstimatedCostData, getEstimatedCostLoading } = useAppSelector(state => state.mssql);
    const [sizeData, setSizeData] = useState<any>([]);

    useEffect(() => {
        const sizeData = getEstimatedCostData?.data?.fsxnStorage?.size;
        let newList = [];
        if (sizeData?.data) {
            newList.push({
                id: 1,
                type: GENERAL.DATA_VOLUME,
                size: sizeData?.data,
                calculation: 'Data volume size with 10% buffer'
            });
        }
        if (sizeData?.log) {
            newList.push({
                id: 2,
                type: GENERAL.LOG_VOLUME,
                size: sizeData?.log,
                calculation: `25% of ${GENERAL.DATA_SIZE}`
            });
        }
        if (sizeData?.tempdb) {
            newList.push({
                id: 3,
                type: GENERAL.TEMPDB_VOLUME,
                size: sizeData?.tempdb,
                calculation: `10% of ${GENERAL.DATA_SIZE}`
            });
        }
        if (sizeData?.quorum) {
            newList.push({
                id: 4,
                type: GENERAL.QUORUM_VOLUME,
                size: sizeData?.quorum,
                calculation: `Witness disk for windows cluster`
            });
        }
        if (sizeData?.buffer) {
            newList.push({
                id: 5,
                type: GENERAL.BUFFER_SIZE,
                size: sizeData?.buffer,
                calculation: `Upto 20% headroom over total capacity`
            });
        }
        if (sizeData?.total) {
            newList.push({
                id: 6,
                type: GENERAL.TOTAL_VOLUME,
                size: sizeData?.total,
                calculation: `Total FSx for ONTAP SSD capacity`
            });
        }
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
                return `${formatFractionalNumber(cellData || 0, 2)} GiB`;
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
            {!getEstimatedCostLoading && !sizeData && (
                <Typography variant="Regular_14" className={styles.loadingTable}>
                    <NoDataIcon />
                    <div>{GENERAL.NO_DATA}</div>
                </Typography>
            )}
            {!getEstimatedCostLoading && sizeData && (
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
