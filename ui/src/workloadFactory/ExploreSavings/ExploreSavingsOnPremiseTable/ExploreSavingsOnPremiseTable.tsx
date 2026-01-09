import {
    Table,
    useTable,
    Typography,
    TableTopBar,
    DsTypography,
    Popover,
    DsSpinner,
    TooltipInfo
} from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useDispatch } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { compressSync } from 'fflate';
import { useTranslation } from 'react-i18next';
import styles from './ExploreSavingsOnPremiseTable.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { onClickESHostOnPrem, onClickESHostOnPremBulk } from '../ExploreSavingsUtils';
import { formatDateWithTime, getFilterOptions, getTruncatedItems } from '../../../utils/utilityFunctions';
import { ReactComponent as Download } from '../../../assets/download.svg';
import tcoScript from '../../../script/SQLServerDataCollector.ps1?raw';

import FileUpload from './FileUpload';
import {
    useDeleteOnPremTcoMutation,
    useGetUploadScriptMutation,
    useLazyGetSubTaskListQuery
} from '../../../utils/apiService';

import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';

import { JOB_MONITORING_STATUS } from '../../../utils/consts';

import { useOnPremData } from './useOnPremData';
import useResize from '../../../common/hooks/useResize';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import BulkActionContainer from '../../../common/BulkAction/BulkActionContainer';
import {
    setSelectedRowsForExploreSavingsOnPremBulk,
    setOnPremTCOAction
} from '../../../store/workloadFactory/exploreSavingsBulkSlice';
import { useNavigate } from 'react-router-dom';

const ExploreSavingsOnPremiseTable = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { fetchOnPremData, error } = useOnPremData();
    const windowSize = useResize();
    const [tableData, setTableData] = useState<any>([]);
    const [isUploadLoading, setIsUploadLoading] = useState(false);
    const { onPremiseData, onPremiseDataLoading } = useAppSelector(state => state.exploreSavings);
    const { selectedRowsForExploreSavingsOnPremBulk } = useAppSelector(state => state.exploreSavingsBulk);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const [getUploadScript] = useGetUploadScriptMutation();
    const [deleteOnPremTco] = useDeleteOnPremTcoMutation();

    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);

    const { isWorkloadFactory } = useAppSelector(state => state.auth);

    const menuItems = (row: any) => [
        {
            id: 'delete',
            displayName: 'Delete'
        }
    ];

    useEffect(() => {
        if (onPremiseData) {
            setTableData(onPremiseData);
        } else {
            setTableData([]);
        }
    }, [onPremiseData]);

    useEffect(() => {
        fetchOnPremData();
    }, []);

    const handleFileChange = (event: any) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;
        // Validate the file type (ensure it's JSON)
        if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json') && !isDemoMode) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: 'Invalid file type. Please upload a JSON file.'
                })
            );
            event.target.value = ''; // Clear the file input
            return;
        }
        // Validate the file size (should be <= 2 MB)
        const maxSizeInMB = 2;
        const maxSizeInBytes = maxSizeInMB * 1024 * 1024; // 2 MB in bytes
        if (selectedFile.size > maxSizeInBytes && !isDemoMode) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: `File size exceeds ${maxSizeInMB} MB. Please upload a smaller file.`
                })
            );
            event.target.value = ''; // Clear the file input
            return;
        }

        // Validate the file name (should start with "SQLServerDataResponse-")
        if (!selectedFile.name.startsWith('SQLServerDataResponse-') && !isDemoMode) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: 'Invalid file name. File name must start with "SQLServerDataResponse-".'
                })
            );
            event.target.value = ''; // Clear the file input
            return;
        }

        setTableData([]); // This code needs to be removed
        setIsUploadLoading(true);

        if (selectedFile) {
            const reader = new FileReader();

            reader.onload = async e => {
                try {
                    if (isDemoMode) {
                        setTimeout(() => {
                            setIsUploadLoading(false);
                            if (onPremiseData) {
                                setTableData(onPremiseData);
                            }
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                                    message: 'File is already uploaded.'
                                })
                            );
                            event.target.value = ''; // Clear the file input
                        }, 3000);
                    } else {
                        // Parse the JSON data
                        const jsonString = e.target?.result as string;

                        // Encode JSON to Base64
                        const base64Encoded = btoa(jsonString);

                        // Convert Base64 string to Uint8Array
                        const base64Bytes = new TextEncoder().encode(base64Encoded);

                        // Compress the Base64 data using fflate
                        const compressedData = compressSync(base64Bytes);

                        // Convert the compressed data to Base64
                        const compressedBase64 = btoa(String.fromCharCode(...compressedData));

                        // Access the data inside the JSON
                        if (compressedBase64) {
                            const result = await getUploadScript({
                                payload: {
                                    fileContent: compressedBase64,
                                    fileName: selectedFile.name
                                }
                            });
                            if (result && !result?.error) {
                                const jobInterval = setInterval(() => {
                                    getJobDetailApi({ id: result.data.jobId }).then((jobRes: any) => {
                                        const status = jobRes?.data?.status;

                                        if (status === JOB_MONITORING_STATUS.COMPLETED) {
                                            fetchOnPremData(true);
                                            setIsUploadLoading(false);
                                            dispatch(
                                                addNotification({
                                                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                                                    message: 'File is uploaded successfully.'
                                                })
                                            );
                                            event.target.value = ''; // Clear the file input
                                            clearInterval(jobInterval);
                                        } else if (status === JOB_MONITORING_STATUS.FAILED) {
                                            if (onPremiseData) {
                                                setTableData(onPremiseData);
                                            }

                                            setIsUploadLoading(false);
                                            dispatch(
                                                addNotification({
                                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                                    message: jobRes?.data?.error || 'Error uploading file.'
                                                })
                                            );
                                            event.target.value = ''; // Clear the file input
                                            clearInterval(jobInterval);
                                        }
                                    });
                                }, 5000);
                            } else {
                                if (onPremiseData) {
                                    setTableData(onPremiseData);
                                }

                                setIsUploadLoading(false);
                                event.target.value = ''; // Clear the file input
                            }
                        } else {
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: 'No data found in the file.'
                                })
                            );
                            event.target.value = ''; // Clear the file input
                        }
                    }
                } catch (error) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: `Error parsing JSON: ${error}`
                        })
                    );
                    event.target.value = ''; // Clear the file input
                }
            };

            reader.onerror = () => {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: 'File could not be read.'
                    })
                );
            };

            reader.readAsText(selectedFile); // Read file as text
        }
    };

    // Delete function
    const handleDelete = (rowData: any) => {
        deleteOnPremTco({ resourceId: rowData.resourceId })
            .then((res: any) => {
                if (res && res?.data?.count === 1) {
                    const updatedTableData = tableData.filter((item: any) => item.uniqueId !== rowData.uniqueId);
                    setTableData(updatedTableData);
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: 'Deleted successfully.'
                        })
                    );
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: res?.error?.message || res?.data?.message
                        })
                    );
                }
            })
            .catch((err: any) => {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: err || 'Error deleting the resource.'
                    })
                );
            });
    };

    const lastColDetails = () => ({
        id: '9',
        Header: '',
        accessor: '',
        isSticky: true,
        width: windowSize.width >= 1920 ? '14.001%' : '225px',
        renderCell: (cellData: any, rowData: any) => (
            <div className={styles.lasColContainer}>
                <div
                    className={styles.detectManage}
                    onClick={() => {
                        onClickESHostOnPrem(dispatch, rowData, isWorkloadFactory, navigate);
                    }}
                    id="wlm-db-onprem-explore-savings-table-button"
                >
                    <Typography variant="Regular_14" className={styles.textStyle}>
                        {GENERAL.ES_SAVINGS}
                    </Typography>
                </div>

                <div className={styles.deleteMenu}>
                    {!isDemoMode && (
                        <MenuPopover
                            isMenuOpen={menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id}
                            menuItems={menuItems(rowData)}
                            toggleMenu={(toggleType: string, menuId: string) => {
                                if (toggleType === 'close') {
                                    menuOpenedRowDetail.current = null;
                                    setOpenedRow(null);
                                } else if (toggleType === 'open') {
                                    menuOpenedRowDetail.current = null;
                                    setOpenedRow(rowData.id);
                                    menuOpenedRowDetail.current = rowData.id;
                                } else if (toggleType === 'selectedOption') {
                                    menuOpenedRowDetail.current = null;
                                    setOpenedRow(null);

                                    switch (menuId) {
                                        case 'delete':
                                            handleDelete(rowData);
                                            break;
                                    }
                                }
                            }}
                            isDisabled={rowData?.menuDisable}
                            CustomMenu={undefined}
                            disabledText={undefined}
                        />
                    )}

                    {isDemoMode && (
                        <div className={styles.menuPointerDisabled}>
                            <span className={styles.menuPointer}>...</span>
                        </div>
                    )}
                </div>
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
            width: windowSize.width >= 1920 ? '15.24%' : '245px',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.resourceName;
                return (
                    <div>
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                    </div>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'deploymentModel',
            id: '2',
            width: windowSize.width >= 1920 ? '15.24%' : '245px',
            filterOptions: getFilterOptions(tableData, 'deploymentModel'),
            renderCell: (cellData: string) => cellData || GENERAL.NOT_AVAILABLE
        },

        {
            Header: 'SQL server instances',
            accessor: 'instanceNameList',
            id: '4',
            width: windowSize.width >= 1920 ? '21.46%' : '345px',
            isSortable: true,
            renderCell: (cellData: string, rowData: any) => {
                const truncatedItems = getTruncatedItems(cellData);

                return (
                    <div>
                        {cellData && Number(cellData) !== 0 ? (
                            <div className={styles.container}>
                                <Typography
                                    title={truncatedItems?.maxItemsToShow.join(', ')}
                                    variant="Regular_14"
                                    className={styles.sqlServerInstance}
                                >
                                    {truncatedItems?.maxItemsToShow.join(', ')}
                                </Typography>
                                {truncatedItems?.remaining.length > 0 && (
                                    <Popover
                                        popoverClass={styles.popover}
                                        children={truncatedItems?.remaining.map((item: any) => (
                                            <Typography variant="Regular_14">{item}</Typography>
                                        ))}
                                        trigger="hover"
                                        interactive
                                        delayHide={200}
                                        container={
                                            <Typography variant="Regular_14" className={styles.colorText}>
                                                {`+ ${truncatedItems?.remaining.length}`}
                                            </Typography>
                                        }
                                    />
                                )}
                            </div>
                        ) : (
                            ''
                        )}
                        {!cellData ? GENERAL.NOT_AVAILABLE : ''}
                    </div>
                );
            }
        },
        {
            Header: 'On-premises nodes',
            accessor: 'onPremisesNodes',
            id: '5',
            width: windowSize.width >= 1920 ? '21.59%' : '347px',
            isSortable: true,
            accessorForTextFilter: 'onPremNode',
            renderCell: (cellData: any, rowData: any) => {
                const truncatedItems = getTruncatedItems(cellData);

                return (
                    <div>
                        {cellData && Number(cellData) !== 0 ? (
                            <div className={styles.container}>
                                <Typography
                                    title={truncatedItems?.maxItemsToShow.join(', ')}
                                    variant="Regular_14"
                                    className={styles.sqlServerInstance}
                                >
                                    {truncatedItems?.maxItemsToShow.join(', ')}
                                </Typography>
                                {truncatedItems?.remaining.length > 0 && (
                                    <Popover
                                        popoverClass={styles.popover}
                                        children={truncatedItems?.remaining.map((item: any) => (
                                            <Typography variant="Regular_14">{item}</Typography>
                                        ))}
                                        trigger="hover"
                                        interactive
                                        delayHide={200}
                                        container={
                                            <Typography variant="Regular_14" className={styles.colorText}>
                                                {`+ ${truncatedItems?.remaining.length}`}
                                            </Typography>
                                        }
                                    />
                                )}
                            </div>
                        ) : (
                            ''
                        )}
                        {!cellData ? GENERAL.NOT_AVAILABLE : ''}
                    </div>
                );
            }
        },
        {
            Header: 'Data collection time',
            accessor: 'creationTime',
            id: '6',
            width: windowSize.width >= 1920 ? '12.44%' : '200px',
            renderCell: (cellData: string) => (
                <div>{cellData ? formatDateWithTime(cellData) : GENERAL.NOT_AVAILABLE}</div>
            )
        },

        lastColDetails()
    ];

    const lazyLoadComponent = () => (
        <>
            {isUploadLoading && (
                <div className={styles.lazyLoadContainer}>
                    <DsSpinner />
                    <div className={styles.textArea}>
                        <DsTypography variant="Semibold_16">Uploading script</DsTypography>
                        <DsTypography variant="Regular_14">This process can take several minutes</DsTypography>
                    </div>
                </div>
            )}
            {!isUploadLoading && (
                <div className={styles.lazyLoadContainer}>
                    <DsSpinner />
                    <div className={styles.textArea}>
                        <DsTypography variant="Regular_14">Loading</DsTypography>
                    </div>
                </div>
            )}
        </>
    );

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: ExploreSavingsColDefs,
        selectionType: 'multiple',
        rows: tableData || [],
        pageSize: 50,
        defaultSelectedRows: [],
        isLazyLoading: onPremiseDataLoading || isUploadLoading
    });

    // Sync table selection state to Redux
    useEffect(() => {
        const selectedRowIds = Object.keys(tableProps.selectionState?.rows || {}).filter(
            key => tableProps.selectionState?.rows[key]
        );
        if (selectedRowIds.length > 0) {
            const selectedRows = tableData.filter((row: any) => selectedRowIds.includes(String(row.id)));
            dispatch(setSelectedRowsForExploreSavingsOnPremBulk(selectedRows));
        } else {
            dispatch(setSelectedRowsForExploreSavingsOnPremBulk([]));
        }
    }, [tableProps.selectionState, tableData]);

    // Sync Redux selection state back to table when rows are removed externally
    useEffect(() => {
        if (
            selectedRowsForExploreSavingsOnPremBulk &&
            selectedRowsForExploreSavingsOnPremBulk.length > 0 &&
            tableData &&
            tableData.length > 0
        ) {
            const selectedIds = selectedRowsForExploreSavingsOnPremBulk.map((row: any) => row.id);
            const currentlySelected = Object.keys(tableProps.selectionState?.rows || {}).filter(
                key => tableProps.selectionState?.rows[key]
            );
            const needsUpdate = selectedIds.some((id: any) => !currentlySelected.includes(String(id)));

            if (needsUpdate) {
                selectedIds.forEach((id: any) => {
                    tableProps.toggleRowSelection?.(String(id));
                });
            }
        }
    }, [selectedRowsForExploreSavingsOnPremBulk, tableData]);

    const handleOnPremBulkAction = () => {
        if (selectedRowsForExploreSavingsOnPremBulk.length > 0) {
            // Set bulk action in Redux
            dispatch(setOnPremTCOAction('bulk'));

            // Use the new bulk function that handles all selected hosts
            onClickESHostOnPremBulk(dispatch, selectedRowsForExploreSavingsOnPremBulk, isWorkloadFactory);
        }
    };

    const tableComponentProps = {
        lazyLoadingText: lazyLoadComponent()
    };

    const handleDownload = async () => {
        // getDownloadFn([{ input: tcoScript, name: 'list-vms.ps1' }]);

        const fileProps = [{ input: tcoScript, name: 'SQLServerDataCollector.ps1' }];

        const files = fileProps.map(
            ({ name, input }) =>
                new File([input], name, {
                    type: 'text/plain'
                })
        );
        const { name } = files[0];
        const obj = files[0];

        const link = document.createElement('a');
        const url = URL.createObjectURL(obj);

        link.href = url;
        link.download = name;
        link.click();
        link.remove();

        window.URL.revokeObjectURL(url);
    };

    return (
        <div className={styles['on-premise-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Microsoft SQL Server hosts on-premises"
                singularTitle="Microsoft SQL Server host on-premises"
                subTitle={`Includes results from uploaded scripts.\n${t('databases.explore-savings.select-upto-five')}`}
                actionsRight={
                    <div className={styles.actions}>
                        <FileUpload handleFileChange={handleFileChange} />
                        <div className={styles.commonAction}>
                            <Download />
                            <DsTypography onClick={handleDownload} variant="Semibold_14" className={styles.text}>
                                Download assessment script
                            </DsTypography>
                            <TooltipInfo placement="bottom" isAppendedToBody>
                                {GENERAL.ONPREM_TOOLTIP}
                            </TooltipInfo>
                        </div>
                    </div>
                }
            />
            {selectedRowsForExploreSavingsOnPremBulk.length > 0 && (
                <BulkActionContainer action="Explore savings" onClick={handleOnPremBulkAction} />
            )}
            <Table
                {...tableComponentProps}
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default ExploreSavingsOnPremiseTable;
