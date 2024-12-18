import { DsFlashingDotsLoader, DsTypography, Table, useTable, TableTopBar } from '@netapp/design-system';
import styles from './CategoryDialogComponent.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { setSelectedAssessmentRow } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useDispatch } from 'react-redux';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import { GENERAL } from '../../../../utils/appConstants';
import { getAssessmentHostListGroupedByCategory } from '../../../DatabaseHomePage/DatabaseHomeUtils';

interface TableTopBarProps {
    tableProps: any;
    pluralTitle: string;
    singularTitle: string;
    selectionType: 'singular' | 'multiple'; // Add this prop
}

const CategoryDialogComponent = ({ type }: { type: string }) => {
    const dispatch = useDispatch();
    const selectedRow = useAppSelector(state => state.databaseHome.selectedAssessmentRow);
    const { allmssqlHostAssessmentData, allmssqlHostAssessmentLoading } = useAppSelector(state => state.inventoryV2);
    const [tableData, setTableData] = useState<any[]>([]);
    useEffect(() => {
        setTableData(getAssessmentHostListGroupedByCategory(allmssqlHostAssessmentData, type));
    }, [allmssqlHostAssessmentData]);

    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'SQL Server instance name',
            accessor: 'databaseInstanceName',
            width: '31%',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.databaseInstanceName;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</DsTypography>
                        {rowData?.loadingStatus && <DsFlashingDotsLoader />}
                        {!rowData?.loadingStatus && (
                            <div className={styles.firstColText}>
                                {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                    rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                                    <div
                                        className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}
                                    ></div>
                                )}
                                {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                    rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
                                    <div
                                        className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}
                                    ></div>
                                )}
                                {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                    <div
                                        className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}
                                    ></div>
                                )}
                                <DsTypography variant="Regular_13">
                                    {rowData?.status === INVENTORY_STATUS.RUNNING ||
                                    rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                                        ? INVENTORY_STATUS.ONLINE
                                        : rowData?.status === INVENTORY_STATUS.STOPPED ||
                                          rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                                        ? INVENTORY_STATUS.OFFLINE
                                        : rowData?.status}
                                    {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                                    {!rowData?.status && !rowData?.loading && 'Unknown'}
                                </DsTypography>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            id: '2',
            Header: 'Host name',
            accessor: 'hostName',
            width: '30%',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '3',
            Header: `${type} optimization`,
            accessor: 'score',
            width: '30%',
            isSortable: true,
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        defaultSelectedRows: selectedRow ? [selectedRow.id] : [ColDefs[0].id],
        isSorting: false,
        selectionType: 'singular',
        columns: ColDefs,
        rows: tableData,
        isHorizontalScroll: false,
        isVerticalScroll: true,
        isLazyLoading: false
    });

    useEffect(() => {
        const rowNumber: any = Object.keys(tableProps?.selectionState?.rows || {})?.[0];
        if (rowNumber && rowNumber !== '0') {
            const row = tableData?.[rowNumber - 1];
            if (row) {
                dispatch(setSelectedAssessmentRow(row));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableProps.selectionState]);

    return (
        <div className={styles.categoryDialogContent}>
            <DsTypography variant="Regular_14">
                Choose the instance you want to optimize its {type} configuration. After clicking 'Continue,' you will
                be redirected to the instance optimization page.
            </DsTypography>
            <div className={styles.table}>
                <TableTopBar
                    //@ts-ignore
                    tableProps={tableProps}
                    pluralTitle="Non-optimized instances"
                    singularTitle="Non-optimized instance"
                />
                <Table
                    //@ts-ignore
                    tableProps={tableProps}
                    isDoubleRow={true}
                />
            </div>
        </div>
    );
};

export default CategoryDialogComponent;
