import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, useTable, Typography, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import { AVAILABILITY_ZONE_TYPE, DATABASE_DEPLOYMENT_MODE, DBType, DETECT_HOST_VAR } from '../../../utils/consts';
import {
    renderAllocatedCapacity,
    renderCellData,
    renderInstanceListText,
    renderUnmanagedAZ,
    uniqueHostRow
} from '../../InventoryV2/InventoryUtilsV2';
import { getSelectedFromSelectionState } from '../../../utils/utilityFunctions';
import { onClickESHostOracleEbs } from '../ExploreSavingsUtils';
import { resetOptimizedStorage } from '../../../store/workloadFactory/exploreSavingsSlice';
import { setSelectedRowsForExploreSavingsOracleEbsBulk } from '../../../store/workloadFactory/exploreSavingsBulkSlice';
import BulkActionContainer from '../../../common/BulkAction/BulkActionContainer';
import useResize from '../../../common/hooks/useResize';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import styles from './OracleEbsTable.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const OracleEbsTable = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const windowSize = useResize();
    const { isWorkloadFactory } = useAppSelector(state => state.auth);
    const { unmanagedExploreSavingsHost } = useAppSelector(state => state.exploreSavings);
    const { selectedRowsForExploreSavingsOracleEbsBulk } = useAppSelector(state => state.exploreSavingsBulk);
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventoryV2.isManagedHostListLoading);
    const { multiDataLoading } = useAppSelector(state => state.headers);

    const isInitialMountRef = useRef(true);

    const oracleEbsHosts = useMemo(
        () =>
            unmanagedExploreSavingsHost.filter(
                (item: any) => item?.hostType === DBType.ORACLE && item?.storageType === DETECT_HOST_VAR.EBS
            ),
        [unmanagedExploreSavingsHost]
    );

    const tableData = useMemo(
        () =>
            oracleEbsHosts.map((item: any) => {
                const ec2Details = item?.ec2Details || [];
                const instanceList: string[] = [];
                const instanceNameList: string[] = [];

                ec2Details.forEach((ec2: any) => {
                    if (ec2?.name) {
                        instanceNameList.push(ec2.name);
                    }
                    if (ec2?.name && ec2?.id) {
                        instanceList.push(`${ec2.name} | ID: ${ec2.id}`);
                    } else if (ec2?.id) {
                        instanceList.push(`${t('databases.general.not-available')} | ID: ${ec2.id}`);
                    }
                });

                const totalInstance = item?.totalInstance || item?.databaseInstanceDetails?.length || 0;

                return {
                    ...item,
                    id: uniqueHostRow(item?.id || item?.resourceId, item?.credentialId, item?.regionId),
                    nameForSorting: (item?.name || '').toLowerCase(),
                    instanceListText: instanceList.join(','),
                    instanceNameListText: instanceNameList.join(', '),
                    totalInstance,
                    deploymentModel: item?.serverInstallationMode || t('databases.general.standalone')
                };
            }),
        [oracleEbsHosts]
    );

    const updatedTableData = useMemo(
        () =>
            tableData.map((item: any) => {
                const isSelected = selectedRowsForExploreSavingsOracleEbsBulk.some(
                    (selectedRow: any) => selectedRow.id === item.id
                );

                const hasSelection = selectedRowsForExploreSavingsOracleEbsBulk.length > 0;
                const sharesGroupWithSelection = hasSelection
                    ? selectedRowsForExploreSavingsOracleEbsBulk.some(
                          (selectedRow: any) =>
                              selectedRow.credentialId === item.credentialId && selectedRow.regionId === item.regionId
                      )
                    : true;

                const limitReached = selectedRowsForExploreSavingsOracleEbsBulk.length >= 5;
                const shouldDisableDueToLimit = limitReached && !isSelected;

                const isDisabled = !sharesGroupWithSelection || shouldDisableDueToLimit;

                let tooltipTitle = '';
                if (!sharesGroupWithSelection) {
                    tooltipTitle = t('databases.explore-savings.disabled-tooltip');
                } else if (shouldDisableDueToLimit) {
                    tooltipTitle = t('databases.explore-savings.disabled-tooltip-limit-exceed');
                }

                const currentIsDisabled = item.cellProps?.isDisabled;
                const currentTooltip = item.cellProps?.selectionProps?.title;

                if (currentIsDisabled === isDisabled && currentTooltip === tooltipTitle) {
                    return item;
                }

                return {
                    ...item,
                    cellProps: {
                        ...item.cellProps,
                        isDisabled,
                        selectionProps: {
                            title: tooltipTitle,
                            titleProps: {
                                placement: 'bottom'
                            }
                        }
                    }
                };
            }),
        [tableData, selectedRowsForExploreSavingsOracleEbsBulk]
    );

    const handleSingleAction = (rowData: any) => {
        dispatch(resetOptimizedStorage());
        onClickESHostOracleEbs(dispatch, rowData, isWorkloadFactory, navigate, false);
    };

    const handleBulkAction = () => {
        if (selectedRowsForExploreSavingsOracleEbsBulk.length === 0) return;
        const isBulk = selectedRowsForExploreSavingsOracleEbsBulk.length > 1;
        const bulkServerName = isBulk
            ? `${selectedRowsForExploreSavingsOracleEbsBulk.length} hosts selected`
            : undefined;
        dispatch(resetOptimizedStorage());
        onClickESHostOracleEbs(
            dispatch,
            selectedRowsForExploreSavingsOracleEbsBulk[0],
            isWorkloadFactory,
            navigate,
            true,
            bulkServerName
        );
    };

    const lastColDetails = () => ({
        id: '10',
        Header: '',
        accessor: '',
        isSticky: true,
        width: windowSize.width >= 1920 ? '15.37%' : '247px',
        renderCell: (_cellData: any, rowData: any) => {
            const isBulkSelectionActive = selectedRowsForExploreSavingsOracleEbsBulk.length > 0;
            const tooltipMessage = isBulkSelectionActive
                ? t('databases.explore-savings.disabled-tooltip-bulk-selection')
                : '';

            const exploreSavingsButton = (
                <div
                    className={isBulkSelectionActive ? CommonStyles.detectManageDisable : CommonStyles.detectManage}
                    onClick={isBulkSelectionActive ? undefined : () => handleSingleAction(rowData)}
                >
                    <Typography variant="Regular_14" className={CommonStyles.textStyle}>
                        {t('databases.explore-savings.explore-savings-title')}
                    </Typography>
                </div>
            );

            return isBulkSelectionActive ? (
                <TooltipComponent title={tooltipMessage} placement="bottom" width="240px" height="50px">
                    {exploreSavingsButton}
                </TooltipComponent>
            ) : (
                exploreSavingsButton
            );
        }
    });

    const columns: ColumnProps[] = [
        {
            id: '1',
            Header: t('databases.explore-savings.host-name'),
            accessor: 'nameForSorting',
            isSortable: true,
            isSticky: true,
            width: windowSize.width >= 1920 ? '14.18%' : '228px',
            renderCell: (_cellData: any, rowData: any) => (
                <Typography variant="Semibold_14">{rowData?.name || t('databases.general.not-available')}</Typography>
            )
        },
        {
            id: '2',
            Header: t('databases.explore-savings.deployment-model'),
            accessor: 'deploymentModel',
            width: windowSize.width >= 1920 ? '14.18%' : '228px',
            renderCell: (cellData: string) => cellData || DATABASE_DEPLOYMENT_MODE.STANDALONE
        },
        {
            id: '3',
            Header: t('databases.explore-savings.oracle-databases'),
            accessor: 'totalInstance',
            width: windowSize.width >= 1920 ? '13.44%' : '216px',
            renderCell: (cellData: number) => (
                <Typography variant="Regular_14">
                    {cellData && Number(cellData) !== 0
                        ? `${cellData} ${Number(cellData) > 1 ? 'databases' : 'database'}`
                        : t('databases.general.not-available')}
                </Typography>
            )
        },
        {
            id: '4',
            Header: t('databases.explore-savings.ec2-instances'),
            accessor: 'instanceListText',
            width: windowSize.width >= 1920 ? '15.12%' : '243px',
            renderCell: (cellData: any, rowData: any) => renderInstanceListText(cellData, rowData, CommonStyles)
        },
        {
            id: '5',
            Header: t('databases.explore-savings.allocated-capacity'),
            accessor: 'allocatedCapacityText',
            width: windowSize.width >= 1920 ? '12.57%' : '202px',
            renderCell: (cellData: string | number, rowData: any) => renderAllocatedCapacity(cellData, rowData)
        },
        {
            id: '6',
            Header: t('databases.explore-savings.availability'),
            accessor: 'azType',
            width: windowSize.width >= 1920 ? '15.12%' : '243px',
            filterOptions: [
                { label: t('databases.explore-savings.single-az'), value: AVAILABILITY_ZONE_TYPE.SINGLE_AZ },
                { label: t('databases.explore-savings.multi-az'), value: AVAILABILITY_ZONE_TYPE.MULTI_AZ }
            ],
            renderCell: (cellData: any, rowData: any) => renderUnmanagedAZ(cellData, rowData, CommonStyles)
        },
        {
            id: '7',
            Header: t('databases.explore-savings.aws-credentials'),
            accessor: 'credentialName',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, CommonStyles)
        },
        {
            id: '8',
            Header: t('databases.explore-savings.aws-account'),
            accessor: 'accountId',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, CommonStyles)
        },
        {
            id: '9',
            Header: t('databases.explore-savings.region'),
            accessor: 'regionName',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, CommonStyles)
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns,
        selectionType: 'multiple',
        rows: updatedTableData,
        pageSize: 50,
        defaultSelectedRows: [],
        isLazyLoading: isDiscoverInProgress || isManagedHostListLoading || multiDataLoading
    });

    // Sync table selection state to Redux
    useEffect(() => {
        if (updatedTableData.length === 0) return;

        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);
        dispatch(setSelectedRowsForExploreSavingsOracleEbsBulk(rowsData));
    }, [tableProps.selectionState]);

    // Sync Redux selection state back to table when rows are removed externally
    useEffect(() => {
        if (isInitialMountRef.current) {
            isInitialMountRef.current = false;
            return;
        }
        if (updatedTableData.length === 0) return;

        const currentTableSelectedIds = new Set(
            Object.keys(tableProps.selectionState?.rows || {}).filter(id => tableProps.selectionState?.rows[id])
        );
        const reduxSelectedIds = new Set(selectedRowsForExploreSavingsOracleEbsBulk.map((row: any) => row.id));

        // Only toggle if there is an actual mismatch to avoid unnecessary re-renders
        const hasDiff =
            [...currentTableSelectedIds].some(id => !reduxSelectedIds.has(id)) ||
            [...reduxSelectedIds].some(id => !currentTableSelectedIds.has(id as string));

        if (!hasDiff) return;

        currentTableSelectedIds.forEach(id => {
            if (!reduxSelectedIds.has(id)) {
                tableProps.toggleRowSelection(id)(false);
            }
        });

        reduxSelectedIds.forEach(id => {
            if (!currentTableSelectedIds.has(id as string)) {
                tableProps.toggleRowSelection(id as string)(true);
            }
        });
    }, [selectedRowsForExploreSavingsOracleEbsBulk, updatedTableData]);

    return (
        <div className={styles.oracleEbsTable}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                subTitle={t('databases.explore-savings.select-upto-five')}
                pluralTitle={t('databases.explore-savings.oracle-ebs')}
                singularTitle={t('databases.explore-savings.oracle-ebs')}
            />
            {selectedRowsForExploreSavingsOracleEbsBulk.length > 0 && (
                <BulkActionContainer
                    action={t('databases.explore-savings.explore-savings-title')}
                    onClick={handleBulkAction}
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

export default OracleEbsTable;
