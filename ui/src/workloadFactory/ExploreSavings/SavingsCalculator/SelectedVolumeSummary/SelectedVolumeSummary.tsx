import { Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import styles from './SelectedVolumeSummary.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';
import { formatSizeTwoPrecision } from '../../../../utils/utilityFunctions';

const SelectedVolumeSummary = () => {
    const selectedHostDetails = useAppSelector(state => state.exploreSavings.selectedHostDetails);
    const [tableData, setTableData] = useState<any>([]);
    const [loading, setLoading] = useState(false);

    const [columnsList, setCoulumnsList] = useState<ColumnProps[]>([]);

    const getColumnsWidth = (volTypeList: Array<String>) => {
        let typeLength = volTypeList.length;
        let colWidth = '96.5px';
        if (typeLength === 4) {
            colWidth = '96.5px';
        } else if (typeLength === 3) {
            colWidth = '128px';
        } else if (typeLength === 2) {
            colWidth = '190px';
        } else if (typeLength === 1) {
            colWidth = '386px';
        } else {
            colWidth = '96.5px';
        }
        return colWidth;
    };

    //For loading state
    const data = [
        { details: GENERAL.ES_TOTAL_VOLUMES, id: '1' },
        {
            details: GENERAL.ES_TOTAL_STORAGE_AMOUNT,

            id: '2'
        },
        { details: GENERAL.ES_TOTAL_PROVISIONED_IOPS, id: '3' },
        { details: GENERAL.ES_TOTAL_THROUGHPUT_MBPS, id: '4' }
    ];

    //For loading state
    const getLoadingStateData: ColumnProps[] = [
        {
            Header: GENERAL.ES_DETAILS,
            accessor: 'details',
            id: '1',
            width: '576px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <DsTypography variant="Regular_14" style={{ minWidth: '146px', display: 'flex', gap: '24px' }}>
                        <div style={{ width: '250px' }}>{rowData.details}</div>
                        <DsFlashingDotsLoader />
                    </DsTypography>
                );
            }
        }
    ];

    const getColumnsList = (volTypeList: Array<String>, colWidth: string, ebsAvailable: any) => {
        let colList = [];
        colList.push({
            Header: GENERAL.ES_DETAILS,
            accessor: 'details',
            id: '1',
            width: ebsAvailable.length === 0 ? '576px' : '190px',
            renderCell: (cellData: any, rowData: any) => {
                return ebsAvailable.length === 0 ? (
                    <DsTypography variant="Regular_14" style={{ minWidth: '146px', display: 'flex', gap: '24px' }}>
                        <div style={{ width: '250px' }}>{rowData.details}</div>
                        <DsTypography variant="Regular_14">{GENERAL.NOT_AVAILABLE}</DsTypography>
                    </DsTypography>
                ) : (
                    <DsTypography variant="Regular_14">{rowData.details}</DsTypography>
                );
            }
        });
        let id = 2;
        volTypeList?.map(volType => {
            colList.push({
                Header: volType,
                accessor: volType,
                id: id,
                width: colWidth,
                renderCell: (cellData: any, rowData: any) => {
                    return selectedHostDetails?.loading ? (
                        <DsFlashingDotsLoader />
                    ) : (
                        <DsTypography variant="Regular_14">{cellData}</DsTypography>
                    );
                }
            });
            id += 1;
        });
        if (colList) {
            setCoulumnsList(colList);
        }
    };

    useEffect(() => {
        setLoading(selectedHostDetails?.loading);

        if (!selectedHostDetails?.ebsResourceInfo) {
            return;
        }

        let header = {};
        let volumes: any = { details: GENERAL.ES_TOTAL_VOLUMES, id: '1' };
        let storageAmount: any = { details: GENERAL.ES_TOTAL_STORAGE_AMOUNT, id: '2' };
        let iops: any = { details: GENERAL.ES_TOTAL_PROVISIONED_IOPS, id: '3' };
        let throughput: any = { details: GENERAL.ES_TOTAL_THROUGHPUT_MBPS, id: '4' };

        let volTypeList: any = [];

        selectedHostDetails?.ebsResourceInfo?.map((row: any) => {
            if (row?.volumeType && !volTypeList.find((volType: any) => volType === row?.volumeType)) {
                volTypeList.push(row?.volumeType);
                header = { ...header, [row?.volumeType]: true };
                volumes = { ...volumes, [row?.volumeType]: 1 };
                storageAmount = { ...storageAmount, [row?.volumeType]: row?.size || 0 };
                iops = { ...iops, [row?.volumeType]: row?.iops || 0 };
                throughput = { ...throughput, [row?.volumeType]: row?.throughput || 0 };
            } else if (row?.volumeType) {
                volumes = { ...volumes, [row?.volumeType]: volumes[row?.volumeType] + 1 };
                storageAmount = {
                    ...storageAmount,
                    [row?.volumeType]: storageAmount[row?.volumeType] + (row?.size || 0)
                };
                iops = { ...iops, [row?.volumeType]: iops[row?.volumeType] + (row?.iops || 0) };
                throughput = { ...throughput, [row?.volumeType]: throughput[row?.volumeType] + (row?.throughput || 0) };
            }
        });

        const colWidth = getColumnsWidth(volTypeList);
        getColumnsList(volTypeList, colWidth, selectedHostDetails?.ebsResourceInfo);

        setTimeout(() => {
            storageAmount = Object.keys(storageAmount).reduce((newObj: any, key) => {
                if (key === 'details' || key === 'id') {
                    newObj[key] = storageAmount[key];
                    return newObj;
                } else {
                    newObj[key] = formatSizeTwoPrecision(storageAmount[key]);
                    return newObj;
                }
            }, {});
            let data = [volumes, storageAmount, iops, throughput];
            setTableData(data);
        }, 0);
    }, [selectedHostDetails]);

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        columns: loading ? getLoadingStateData : columnsList,
        rows: loading ? data : tableData,
        isHorizontalScroll: true,
        pageSize: 10
    });
    return (
        <div className={styles.selectedVolumeSummary}>
            <DsTypography variant="Regular_14">{GENERAL.SUMMARY_TEXT}</DsTypography>

            <div className={styles.instanceTable}>
                <Table
                    //@ts-ignore
                    tableProps={tableProps}
                    variant="innerTable"
                />
            </div>
        </div>
    );
};

export default SelectedVolumeSummary;
