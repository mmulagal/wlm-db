import { Table, useTable, Typography, TableTopBar, Popover, useDialog } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from 'i18next';
import styles from './ExploreSavingsTableV2.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { onClickESHost } from '../ExploreSavingsUtils';
import { AUTHENTICATION_TYPE, DETECT_HOST_VAR, FROM_DIALOG, WLF_TABS } from '../../../utils/consts';
import {
    renderAllocatedCapacity,
    renderCellData,
    renderInstanceListText,
    renderUnmanagedAZ,
    uniqueHostRow
} from '../../InventoryV2/InventoryUtilsV2';
import { setInventoryTableData } from '../../../store/workloadFactory/inventoryV2Slice';
import { getFilterOptions } from '../../../utils/utilityFunctions';
import useResize from '../../../common/hooks/useResize';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import AuthDialog from './AuthDialog/AuthDialog';
import store from '../../../store/store';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { useRegisterResourceCredentialsBulkMutation } from '../../../utils/apiService';
import { resetServerDetailsCredentials } from '../../../store/workloadFactory/exploreSavingsSlice';
import {
    resetDialogComponent,
    setAllActionsDisabled,
    setDialogError,
    setPrimaryButtonLoading,
    setTooltipInfo,
    setTooltipText
} from '../../../store/workloadFactory/dialogComponentSlice';
import { DiscoverHostInterface } from '../../../utils/types/inventoryV2Types';

const ExploreSavingsTableV2 = () => {
    const dispatch = useDispatch();
    const windowSize = useResize();
    const { setDialog, closeDialog } = useDialog();
    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();
    const navigate = useNavigate();
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventoryV2.isManagedHostListLoading);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const [ebsTableData, setEBSTableData] = useState<any>([]);
    const [fsxWTableData, setFSXWTableData] = useState<any>([]);
    // const selectedHeaderTab = useAppSelector(state => state.inventoryV2.selectedHeaderTab);
    const selectedExploreSavingsTab = useAppSelector(state => state.exploreSavings.selectedExploreSavingsTab);
    const { isWorkloadFactory } = useAppSelector(state => state.auth);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, multiDataLoading } = useAppSelector(
        state => state.headers
    );
    const selectedExploreSavingsTabFileSystemType =
        selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? GENERAL.EBS : GENERAL.FSX_FOR_WINDOWS;

    // const getInitialFilter = () => {
    //     if (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_EBS || selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_FsxW) {
    //         return {
    //             textFilter: '',
    //             count: 1,
    //             columns: {
    //                 '3': {
    //                     activeCount: 1,
    //                     values: {
    //                         [selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_EBS
    //                             ? GENERAL.EBS
    //                             : GENERAL.FSX_FOR_WINDOWS]: true
    //                     },
    //                     valuesArray: [true]
    //                 }
    //             }
    //         };
    //     } else {
    //         return undefined;
    //     }
    // };

    useEffect(() => {
        if (unManagedHostFormatedList) {
            const result: any = [];
            unManagedHostFormatedList?.map((perRow: any) => {
                if (
                    !headerSelectedMultiCredIdsList.includes(perRow?.credentialId) ||
                    !headerSelectedMultiRegionIdsList.includes(perRow?.regionId)
                ) {
                    return;
                }
                const instanceList: any = [];
                const instanceNameList: any = [];
                perRow?.ec2Details?.map((row: any) => {
                    if (row?.name) {
                        instanceNameList.push(row?.name);
                    }
                    if (row?.name && row?.id) {
                        instanceList.push(`${row?.name} | ID: ${row?.id}`);
                    } else if (row?.id) {
                        instanceList.push(`${GENERAL.NOT_AVAILABLE} | ID: ${row?.id}`);
                    }
                });
                const rowData = {
                    ...perRow,
                    id: uniqueHostRow(perRow?.id, perRow?.credentialId, perRow?.regionId),
                    instanceListText: instanceList.join(','),
                    instanceNameListText: instanceNameList.join(', '),
                    nameForSorting: perRow?.name?.toLowerCase()
                };
                result.push(rowData);
            });
            // Initialize two empty arrays
            const ebsArray: any = [];
            const fsxArray: any = [];
            result.forEach((item: any) => {
                if (item.storageType === 'EBS') {
                    ebsArray.push(item);
                } else if (item.storageType === 'FSx for Windows') {
                    fsxArray.push(item);
                }
            });
            setEBSTableData(ebsArray);
            setFSXWTableData(fsxArray);
        } else {
            setEBSTableData([]);
            setFSXWTableData([]);
        }
    }, [unManagedHostFormatedList, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList]);

    const handleAuthenticate = async (rowData: any) => {
        try {
            dispatch(setPrimaryButtonLoading(true));
            dispatch(setAllActionsDisabled(true));
            const state = store.getState();
            const { selectedAuthenticationType } = state.workloadFactoryResource;
            const { inventoryTableData } = state.inventoryV2;

            // Get all the SQL Server instances that match the selected file system type
            const matchedInstances = rowData?.sqlServerInstances?.filter(
                (instance: any) => instance?.fileSystemType === selectedExploreSavingsTabFileSystemType
            );
            const { userName, password } = state.exploreSavings.serverDetails;

            const credentialList: {
                resourceId: string;
                resourceType: string;
                username: string;
                password: string;
            }[] = [];

            matchedInstances?.forEach((instance: any) => {
                credentialList.push({
                    resourceId: instance?.databaseInstanceName,
                    resourceType:
                        selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                            ? DETECT_HOST_VAR.MSSQL
                            : DETECT_HOST_VAR.WINDOWS,
                    username: userName,
                    password
                });
            });
            const credList = {
                credentials: credentialList
            };

            const payload = {
                items: [
                    {
                        ...credList,
                        ec2InstanceId: rowData?.ec2InstanceId,
                        region: rowData?.regionId,
                        credentialsId: rowData?.credentialId
                    }
                ]
            };

            const result = await registerResourceCredBulk({ payload });
            if (result && !result?.error && result?.data) {
                if (
                    result?.data?.items?.length > 0 &&
                    !result?.data?.items?.[0]?.registerDetails?.[0]?.databaseServerError &&
                    !result?.data?.items?.[0]?.registerDetails?.[0]?.fsxnError
                ) {
                    // Clone the inventoryTableData
                    const updatedInventoryTableData: Record<string, DiscoverHostInterface> = {
                        ...inventoryTableData
                    } as Record<string, DiscoverHostInterface>;

                    // Clone the sqlServerInstances array and update the correct instance
                    updatedInventoryTableData[rowData.id] = {
                        ...(updatedInventoryTableData[rowData.id] as DiscoverHostInterface),
                        isDetected: true,
                        sqlServerInstances:
                            updatedInventoryTableData[rowData.id]?.sqlServerInstances?.map(instance =>
                                //@ts-ignore
                                instance?.fileSystemType === selectedExploreSavingsTabFileSystemType
                                    ? {
                                          ...instance,
                                          sqlServerAuthentication:
                                              selectedAuthenticationType ===
                                              AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                                                  ? true
                                                  : instance.sqlServerAuthentication,
                                          windowsDomainUserAuthentication:
                                              selectedAuthenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
                                                  ? true
                                                  : instance.windowsDomainUserAuthentication
                                      }
                                    : instance
                            ) ?? []
                    };

                    // Dispatch the update to the store
                    dispatch(setInventoryTableData(updatedInventoryTableData));
                    // Navigate to the Explore Savings page
                    onClickESHost(dispatch, rowData, isWorkloadFactory, navigate);
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: `Authenticated database host ${rowData?.name} was successful.\nYou can now explore potential savings.`
                        })
                    );
                } else {
                    dispatch(
                        setTooltipText(
                            result?.data?.items?.[0]?.registerDetails?.[0]?.fsxnError ||
                                result?.data?.items?.[0]?.registerDetails?.[0]?.databaseServerError ||
                                t('databases.explore-savings.authentication-failed')
                        )
                    );
                    dispatch(setTooltipInfo(true));
                    dispatch(setDialogError(true));
                }
            } else {
                dispatch(
                    // @ts-ignore
                    setTooltipText(result?.error?.data?.message || t('databases.explore-savings.authentication-failed'))
                );
                dispatch(setTooltipInfo(true));
                dispatch(setDialogError(true));
            }
        } catch (error) {
            // @ts-ignore
            dispatch(setTooltipText(error?.data?.message || t('databases.explore-savings.authentication-failed')));
            dispatch(setTooltipInfo(true));
            dispatch(setDialogError(true));
        } finally {
            dispatch(resetDialogComponent());
            dispatch(resetServerDetailsCredentials());
            closeDialog();
        }
    };

    const handleDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={t('databases.explore-savings.authentication-required')}
                content={<AuthDialog databaseHostName={rowData?.name} />}
                primaryButton={t('databases.explore-savings.authenticate')}
                secondaryButton={t('databases.explore-savings.close')}
                closeCallback={() => {
                    dispatch(resetDialogComponent());
                    dispatch(resetServerDetailsCredentials());
                    closeDialog();
                }}
                dialogFrom={FROM_DIALOG.EXPLORE_SAVINGS}
                errorMessage={t('databases.explore-savings.authentication-failed')}
                callback={() => {
                    handleAuthenticate(rowData);
                }}
                customClass={styles.protectionDialog}
            />
        );
    };

    const lastColDetails = () => ({
        id: '11',
        Header: '',
        accessor: '',
        isSticky: true,
        width: windowSize.width >= 1920 ? '15.37%' : '247px',
        renderCell: (cellData: any, rowData: any) =>
            !rowData?.isDetected ? (
                <div
                    className={styles.detectManage}
                    onClick={() => {
                        handleDialog(rowData);
                    }}
                    id="explore-savings-table-button"
                >
                    <Typography variant="Regular_14" className={styles.textStyle}>
                        {GENERAL.ES_SAVINGS}
                    </Typography>
                </div>
            ) : (
                <div
                    className={styles.detectManage}
                    onClick={() => {
                        onClickESHost(dispatch, rowData, isWorkloadFactory, navigate);
                    }}
                    id="explore-savings-table-button"
                >
                    <Typography variant="Regular_14" className={styles.textStyle}>
                        {GENERAL.ES_SAVINGS}
                    </Typography>
                </div>
            )
    });

    const ExploreSavingsColDefs: ColumnProps[] = [
        {
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'nameForSorting',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: windowSize.width >= 1920 ? '14.18%' : '228px',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div>
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                    </div>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            id: '2',
            width: windowSize.width >= 1920 ? '14.18%' : '228px',
            filterOptions: getFilterOptions(
                selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? ebsTableData : fsxWTableData,
                'serverInstallationMode'
            ),
            renderCell: (cellData: string) => cellData || GENERAL.NOT_AVAILABLE
        },
        // {
        //     Header: GENERAL.DB_HOST_FILE_SYSTEM_TYPE,
        //     accessor: 'storageType',
        //     id: '3',
        //     width: '170px',
        //     filterOptions: [
        //         { label: GENERAL.EBS, value: GENERAL.EBS },
        //         { label: GENERAL.FSX_FOR_WINDOWS, value: GENERAL.FSX_FOR_WINDOWS }
        //     ],
        //     renderCell: (cellData: string) => {
        //         return cellData === 'EBS' ? 'Elastic Block Store (EBS)' : cellData || GENERAL.NOT_AVAILABLE;
        //     }
        // },
        {
            Header: 'SQL server instances',
            accessor: 'totalInstance',
            id: '4',
            width: windowSize.width >= 1920 ? '13.44%' : '216px',
            filterOptions: getFilterOptions(
                selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? ebsTableData : fsxWTableData,
                'totalInstance'
            ),
            renderCell: (cellData: string) => (
                <div>
                    {cellData && Number(cellData) !== 0 ? (
                        <Typography variant="Regular_14">
                            {cellData} {Number(cellData) > 1 ? 'instances' : 'instance'}
                        </Typography>
                    ) : (
                        ''
                    )}
                    {!cellData ? GENERAL.NOT_AVAILABLE : ''}
                </div>
            )
        },
        {
            Header: GENERAL.DB_HOST_INSTANCE,
            accessor: 'instanceListText',
            id: '5',
            width: windowSize.width >= 1920 ? '15.12%' : '243px',
            isSortable: true,
            accessorForTextFilter: 'instanceListText',
            renderCell: (cellData: any, rowData: any) => renderInstanceListText(cellData, rowData, styles)
        },
        {
            Header: GENERAL.DB_HOST_ALLOCATED_CAPACITY,
            accessor: 'allocatedCapacityText',
            id: '6',
            width: windowSize.width >= 1920 ? '12.57%' : '202px',
            isSortable: true,
            accessorForTextFilter: 'allocatedCapacityText',
            renderCell: (cellData: string | number, rowData: any) => renderAllocatedCapacity(cellData, rowData)
        },
        {
            Header: GENERAL.DB_HOST_AVAILABILITY,
            accessor: 'azType',
            id: '7',
            width: windowSize.width >= 1920 ? '15.12%' : '243px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: GENERAL.SINGLE_AZ },
                { label: GENERAL.MULTI_AZ, value: GENERAL.MULTI_AZ }
            ],
            renderCell: (cellData: any, rowData: any) => renderUnmanagedAZ(cellData, rowData, styles)
        },
        {
            id: '8',
            Header: 'AWS credentials',
            accessor: 'credentialName',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '9',
            Header: 'AWS account',
            accessor: 'accountId',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '10',
            Header: 'Region',
            accessor: 'regionName',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
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
        columns: ExploreSavingsColDefs,
        rows: selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? ebsTableData : fsxWTableData || [],
        pageSize: 50,
        isLazyLoading: isDiscoverInProgress || isManagedHostListLoading || multiDataLoading
    });

    return (
        <div className={styles.exploreSavingTable}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={
                    selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE
                        ? `${GENERAL.ES_TABLE_TITLE}`
                        : `${GENERAL.ES_TABLE_FSXW_TITLE}`
                }
                singularTitle={
                    selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE
                        ? `${GENERAL.ES_TABLE_TITLE_SINGLE}`
                        : `${GENERAL.ES_TABLE_FSXW_TITLE_SINGLE}`
                }
            />
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default ExploreSavingsTableV2;
