import { Table, useTable, TableTopBar, DsTypography, DsButton, Popover } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkCloneContainer from '../../../../common/BulkAction/BulkCloneContainer';
import { ASSESSMENT_CONFIG_NAMES, DBType, WLF_TABS } from '../../../../utils/consts';
import { disableOptimizeResourceCheckBoxForOptimizeCase } from '../../GetWellUtils';

const CloneOutsideWF = ({ data, handleBulkActionForClone, fromPage, engineType = DBType.MSSQL }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { inProgressResourceOptimizeData } = useAppSelector(state => state.getWellOptimize);

    const isOracle = engineType === DBType.ORACLE;

    const updatedTableData = useMemo(() => {
        if (inProgressResourceOptimizeData?.[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]?.length) {
            return disableOptimizeResourceCheckBoxForOptimizeCase(
                data,
                ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                selectedRowsForOptimizeInnerPage
            );
        }
        return data;
    }, [selectedRowsForOptimizeInnerPage, data, inProgressResourceOptimizeData]);

    const instanceLabel = isOracle
        ? t('databases.well-architect.dashboard-table-headers.oracle-instance-name')
        : t('databases.well-architect.dashboard-table-headers.sql-instance-name-clone');
    const hostLabel = isOracle
        ? t('databases.well-architect.dashboard-table-headers.oracle-host-name')
        : t('databases.well-architect.dashboard-table-headers.sql-host-name-clone');

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Clone database name',
            accessor: 'cloneDatabaseName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '210px' : '210px',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: instanceLabel,
            accessor: 'serverInstanceName',
            id: '2',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '194px' : '210px'
        },
        {
            Header: hostLabel,
            accessor: 'hostName',
            id: '3',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '168px' : '210px'
        },

        {
            Header: 'Source volume',
            accessor: 'sourceVolumeNamesList',
            id: '4',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? 'auto' : 'auto',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: 'Clone age',
            accessor: 'cloneAgeFilterData',
            id: '5',
            isSortable: true,
            filterOptions: [
                { label: '60 - 99 days', value: '60 - 99 days' },
                { label: '100 - 200 days', value: '100 - 200 days' },
                { label: '200+ days', value: '200+ days' }
            ],
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '154px' : '210px',
            renderCell: (_: any, rowData: any) => `${rowData?.cloneAge || 0} days`
        },
        {
            Header: '',
            accessor: '',
            id: '7',
            width: fromPage === WLF_TABS.DASHBOARD ? '200px' : '270px',
            renderCell: (cellData: any, rowData: any) => {
                const isInProgress = inProgressResourceOptimizeData?.[
                    ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT
                ]?.includes(rowData?.id);

                const isBulkModeActive =
                    selectedRowsForOptimizeInnerPage && selectedRowsForOptimizeInnerPage.length > 0;

                if (isBulkModeActive) {
                    return (
                        <div className={styles.buttonContainer}>
                            <div />
                            <Popover
                                isAppendedToBody
                                trigger="hover"
                                container={
                                    <DsButton variant="secondary" isDisabled isThin>
                                        {t('databases.well-architect.delete')}
                                    </DsButton>
                                }
                            >
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.bulk-action-enabled-on-selected')}
                                </DsTypography>
                            </Popover>
                        </div>
                    );
                }

                if (isInProgress) {
                    return (
                        <div className={styles.buttonContainer}>
                            <div />
                            <Popover
                                isAppendedToBody
                                trigger="hover"
                                container={
                                    <DsButton variant="secondary" isDisabled isThin>
                                        {t('databases.well-architect.delete')}
                                    </DsButton>
                                }
                            >
                                <DsTypography variant="Regular_14">{t('databases.well-architect.fixing')}</DsTypography>
                            </Popover>
                        </div>
                    );
                }

                return (
                    <div className={styles.buttonContainer}>
                        <div />
                        <DsButton
                            isThin
                            variant="secondary"
                            isDisabled={false}
                            onClick={() => {
                                handleBulkActionForClone('Delete', 'single', [rowData]);
                            }}
                        >
                            {t('databases.well-architect.delete')}
                        </DsButton>
                    </div>
                );
            }
        }
    ];

    const colDefsForInstance = TableColDefs.filter((item: any) => item.id !== '2' && item.id !== '3');

    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: fromPage === WLF_TABS.DASHBOARD ? TableColDefs : colDefsForInstance,
        rows: updatedTableData || [],
        pageSize: 50,
        selectionType: 'multiple'
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, data);

        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));
    }, [tableProps.selectionState, data]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Impacted databases"
                singularTitle="Impacted database"
                subTitle={
                    isOracle ? undefined : 'Clone refreshing is supported only for clones created in Workload Factory.'
                }
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkCloneContainer
                    action1="Delete"
                    onClick={(val: any) => handleBulkActionForClone(val, 'bulk', selectedRowsForOptimizeInnerPage)}
                />
            )}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default CloneOutsideWF;
