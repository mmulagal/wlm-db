import { Table, useTable, TableTopBar, DsTypography, ButtonWithDropdown, Popover } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';

import { GENERAL } from '../../../../utils/appConstants';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { ReactComponent as MenuIcon } from '../../../../assets/menu-icon2.svg';
import BulkCloneContainer from '../../../../common/BulkAction/BulkCloneContainer';
import { ASSESSMENT_CONFIG_NAMES, WLF_TABS } from '../../../../utils/consts';
import { disableOptimizeResourceCheckBoxForOptimizeCase } from '../../GetWellUtils';

const CloneInsideWF = ({ data, handleBulkActionForClone, fromPage }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { inProgressResourceOptimizeData } = useAppSelector(state => state.getWellOptimize);

    // Update tableData when selection changes
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

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Clone database name',
            accessor: 'cloneDatabaseName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '216px' : '211px',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: 'SQL instance name',
            accessor: 'serverInstanceName',
            id: '2',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '194px' : '211px'
        },
        {
            Header: 'SQL host name',
            accessor: 'hostName',
            id: '3',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '168px' : '211px'
        },

        {
            Header: 'Source database',
            accessor: 'sourceDatabaseName',
            id: '4',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '178px' : '211px'
        },
        {
            Header: 'Source volume',
            accessor: 'sourceVolumeNamesList',
            id: '5',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? 'auto' : 'auto',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: 'Clone age',
            accessor: 'cloneAgeFilterData',
            id: '6',
            isSortable: true,
            filterOptions: [
                { label: '60 - 99 days', value: '60 - 99 days' },
                { label: '100 - 200 days', value: '100 - 200 days' },
                { label: '200+ days', value: '200+ days' }
            ],
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '154px' : '211px',
            renderCell: (cellData: any, rowData: any) => `${rowData?.cloneAge || 0} days`
        },
        {
            Header: '',
            accessor: '',
            id: '8',
            width: fromPage === WLF_TABS.DASHBOARD ? '170px' : '211px',
            renderCell: (cellData: any, rowData: any) => {
                const isInProgress = inProgressResourceOptimizeData?.[
                    ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT
                ]?.includes(rowData?.id);

                const isBulkModeActive = selectedRowsForOptimizeInnerPage.length > 0;

                // Check if ANY clone is being optimized
                const isAnyCloneOptimizing =
                    inProgressResourceOptimizeData?.[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]?.length > 0;

                if (isBulkModeActive || isInProgress || isAnyCloneOptimizing) {
                    const tooltipMessage = isBulkModeActive
                        ? t('databases.well-architect.bulk-action-enabled-on-selected')
                        : t('databases.well-architect.fixing');

                    return (
                        <div className={`${styles.actionContainer} ${styles.actionDisabled}`}>
                            <DsTypography variant="Regular_14" className={styles.actionText}>
                                {t('databases.well-architect.fix')}
                            </DsTypography>
                            <Popover
                                isAppendedToBody
                                trigger="hover"
                                container={
                                    <ButtonWithDropdown
                                        variant="icon"
                                        isDisabled
                                        items={[
                                            {
                                                id: 'refresh',
                                                children: t('databases.well-architect.refresh'),
                                                isDisabled: true
                                            },
                                            {
                                                id: 'delete',
                                                children: t('databases.well-architect.delete'),
                                                isDisabled: true
                                            }
                                        ]}
                                    >
                                        <MenuIcon />
                                    </ButtonWithDropdown>
                                }
                            >
                                <DsTypography variant="Regular_14">{tooltipMessage}</DsTypography>
                            </Popover>
                        </div>
                    );
                }

                return (
                    <div className={styles.actionContainer}>
                        <DsTypography variant="Regular_14" className={styles.actionText}>
                            {t('databases.well-architect.fix')}
                        </DsTypography>
                        <ButtonWithDropdown
                            variant="icon"
                            isDisabled={false}
                            items={[
                                {
                                    id: 'refresh',
                                    children: t('databases.well-architect.refresh'),
                                    isDisabled: false,
                                    onClick: () => {
                                        handleBulkActionForClone('Refresh', 'single', [rowData]);
                                    }
                                },
                                {
                                    id: 'delete',
                                    children: t('databases.well-architect.delete'),
                                    isDisabled: false,
                                    onClick: () => {
                                        handleBulkActionForClone('Delete', 'single', [rowData]);
                                    }
                                }
                            ]}
                        >
                            <MenuIcon />
                        </ButtonWithDropdown>
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
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkCloneContainer
                    action1="Delete"
                    action2="Refresh"
                    onClick={(val: any) => {
                        handleBulkActionForClone(val, 'bulk', selectedRowsForOptimizeInnerPage);
                    }}
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

export default CloneInsideWF;
