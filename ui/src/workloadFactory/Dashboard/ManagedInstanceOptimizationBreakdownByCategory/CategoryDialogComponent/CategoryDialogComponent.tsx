import { DsFlashingDotsLoader, DsTypography, Table, useTable, TableTopBar } from '@netapp/design-system';
import styles from './CategoryDialogComponent.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect } from 'react';
import { setSelectedAssessmentRow } from '../../../../store/workloadFactory/databaseHomeSlice';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import { GENERAL } from '../../../../utils/appConstants';

const CategoryDialogComponent = ({ type }: { type: string }) => {
    const dispatch = useDispatch();
    const selectedRow = useAppSelector(state => state.databaseHome.selectedAssessmentRow);

    const tableData: any = [
        {
            id: 1,
            hostName: 'SQLServer-Dev-04',
            score: '25%',
            resourceId: 'b89f6bc4-e1af-4c79-a864-18c775c1fd3d',
            databaseInstanceId: 'c551fb03-c961-484e-9e02-2f78a42e5587',
            databaseInstanceName: 'MSSQLSERVER',
            sqlServerDeploymentType: 'FCI',
            status: 'Up'
        },
        {
            id: 2,
            hostName: 'SQLServer-Dev-01',
            score: '30%',
            resourceId: 'bb53f7de-0835-4df1-8b73-6d978c253264',
            databaseInstanceId: '564b51ca-8ce7-4d41-a91a-c27871f86ad0',
            databaseInstanceName: 'MSSQLSERVER',
            sqlServerDeploymentType: 'FCI',
            status: 'Up'
        },
        {
            id: 3,
            hostName: 'SQLServer-Dev-01',
            score: '25%',
            resourceId: 'bb53f7de-0835-4df1-8b73-6d978c253264',
            databaseInstanceId: '45a17956-40ae-4498-a6f5-9d554dbf17af',
            databaseInstanceName: 'DEV-FinancialAccounts',
            sqlServerDeploymentType: 'FCI',
            status: 'Up'
        },
        {
            id: 4,
            hostName: 'SQLServer-Dev-02',
            score: '25%',
            resourceId: 'bb53f7de-0835-4df1-8b73-6d978c253264',
            databaseInstanceId: '45a17956-40ae-4498-a6f5-9d554dbf17af',
            databaseInstanceName: 'DEV-FinancialAccounts',
            sqlServerDeploymentType: 'FCI',
            status: 'Up'
        }
    ];

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
                        <div className={styles.firstColText}>
                            {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                            )}
                            {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}></div>
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
                    </div>
                );
            }
        },
        {
            id: '2',
            Header: 'Host name',
            accessor: 'hostName',
            width: '30%',
            filterOptions: 'auto'
        },
        {
            id: '3',
            Header: 'Storage optimization',
            accessor: 'score',
            width: '30%',
            isSortable: true
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        defaultSelectedRows: selectedRow ? [selectedRow[0] && selectedRow[0].id] : [ColDefs[0].id],
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
