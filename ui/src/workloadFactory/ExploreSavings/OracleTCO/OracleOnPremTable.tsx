import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DsButton, DsTypography } from '@tlveng/wlm-ds';
import { compressSync, zipSync, strToU8 } from 'fflate';
import { useDialog } from '@netapp/design-system/dist/components/Dialog';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Popover } from '@netapp/design-system/dist/components/Popover';
import { useNavigate } from 'react-router-dom';
import readmeContent from './DownloadContent/README 4.MD?raw';
import statspackContent from './DownloadContent/OracleDataCollectorStatspack 3.sql?raw';
import permissionsContent from './DownloadContent/OracleDataCollectorPermissions 1.json?raw';
import controllerContent from './DownloadContent/OracleDataCollectorController 3.sql?raw';
import noActionContent from './DownloadContent/_no_action 3.sql?raw';
import collectorContent from './DownloadContent/OracleDataCollector 4.py?raw';
import awrContent from './DownloadContent/OracleDataCollectorAWR 3.sql?raw';

import { ColumnProps, Table } from '../../../common/Lib/Table/Table';
import { useTable } from '../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../common/Lib/Table/TableTopBar';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import BulkActionContainer from '../../../common/BulkAction/BulkActionContainer';
import { GENERAL } from '../../../utils/appConstants';
import styles from './OracleTCOTables.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import AssessmentDialog from './AssessmentDialog/AssessmentDialog';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { useAppSelector } from '../../../store/storeHooks';
import {
    useDeleteOnPremTcoMutation,
    useGetOracleOnPremTCODownloadScriptMutation,
    useGetUploadScriptMutation,
    useLazyGetSubTaskListQuery
} from '../../../utils/apiService';
import { JOB_MONITORING_STATUS } from '../../../utils/consts';
import TableTooltip from './TableTooltip/TableTooltip';
import { useOnPremData } from '../ExploreSavingsOnPremiseTable/useOnPremData';
import { formatDateWithTime, getTruncatedItems } from '../../../utils/utilityFunctions';
import {
    handleDeleteOnPremTco,
    onClickESHostOracleOnPrem,
    onClickESHostOracleOnPremBulk
} from '../ExploreSavingsUtils';
import { setSelectedRowsForExploreSavingsOracleOnPremBulk } from '../../../store/workloadFactory/exploreSavingsBulkSlice';
import { setOnPremiseOracleData } from '../../../store/workloadFactory/exploreSavingsSlice';
import DeleteMenuCell from '../DeleteMenuCell/DeleteMenuCell';

const OracleOnPremTable = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [isUploadLoading, setIsUploadLoading] = useState(false);
    const { fetchOracleOnPremData } = useOnPremData();
    const { onPremiseOracleData, onPremiseOracleDataLoading } = useAppSelector(state => state.exploreSavings);
    const buttonRef: any = useRef(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { setDialog } = useDialog();
    const { isDemoMode, isWorkloadFactory } = useAppSelector(state => state.auth);
    const { selectedRowsForExploreSavingsOracleOnPremBulk } = useAppSelector(state => state.exploreSavingsBulk);
    const [getUploadScript] = useGetUploadScriptMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [getOracleOnPremTCODownloadScript] = useGetOracleOnPremTCODownloadScriptMutation();
    const [deleteOnPremTco] = useDeleteOnPremTcoMutation();
    const [menuOpenedRow, setOpenedRow] = useState<string | null>(null);
    const menuOpenedRowDetail: any = useRef(null);


    const handleDelete = (rowData: any) => {
        handleDeleteOnPremTco({
            deleteOnPremTco,
            rowData,
            currentData: onPremiseOracleData,
            setDataAction: setOnPremiseOracleData,
            dispatch,
            type: 'oracle',
            successMessage: t('databases.explore-savings.on-prem-delete-success'),
            errorMessage: t('databases.explore-savings.on-prem-delete-error')
        });
    };

    useEffect(() => {
        fetchOracleOnPremData();
    }, []);

    const updatedTableData = useMemo(() => {
        if (!onPremiseOracleData || onPremiseOracleData.length === 0) {
            return [];
        }

        return onPremiseOracleData.map((item: any) => {
            const isSelected = selectedRowsForExploreSavingsOracleOnPremBulk.some(
                (selectedRow: any) => selectedRow.id === item.id
            );

            const limitReached = selectedRowsForExploreSavingsOracleOnPremBulk.length >= 5;
            const shouldDisableDueToLimit = limitReached && !isSelected;
            const isDisabled = shouldDisableDueToLimit;

            let tooltipTitle = '';
            if (shouldDisableDueToLimit) {
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
                    isDisabled,
                    selectionProps: {
                        title: tooltipTitle
                    }
                }
            };
        });
    }, [onPremiseOracleData, selectedRowsForExploreSavingsOracleOnPremBulk]);

    const openAssessmentDialog = () => {
        setDialog(
            <DialogComponent
                header="Assessment script information"
                content={<AssessmentDialog />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
                customClass="oneTimeWADDialog"
            />
        );
    };

    const handleDownload = async () => {
        if (isDemoMode) {
            const zipped = zipSync({
                'README.MD': strToU8(readmeContent),
                'OracleDataCollectorStatspack.sql': strToU8(statspackContent),
                'OracleDataCollectorPermissions.json': strToU8(permissionsContent),
                'OracleDataCollectorController.sql': strToU8(controllerContent),
                '_no_action.sql': strToU8(noActionContent),
                'OracleDataCollector.py': strToU8(collectorContent),
                'OracleDataCollectorAWR.sql': strToU8(awrContent)
            });
            const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'Oracle-Data-Collector.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: t('databases.explore-savings.downloaded-assessment-script-and-readme')
                })
            );
        } else {
            try {
                const result: any = await getOracleOnPremTCODownloadScript({});
                if (result?.data?.url) {
                    const link = document.createElement('a');
                    link.href = result.data.url;
                    link.setAttribute('download', '');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.INFO,
                            message: t('databases.explore-savings.downloaded-assessment-script-and-readme')
                        })
                    );
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: result?.error?.data?.message
                        })
                    );
                }
            } catch (error) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: 'Error downloading assessment script.'
                    })
                );
            }
        }
    };
    const OracleOnPremColDefs: ColumnProps[] = [
        {
            Header: 'Host name',
            accessor: 'hostName',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: '16.66%',
            renderCell: (_: any, rowData: any) => {
                const name = rowData?.resourceName;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">{name}</DsTypography>
                    </div>
                );
            }
        },
        {
            Header: 'Database name',
            accessor: 'databaseNameList',
            id: '2',
            width: '16.66%',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                const truncatedItems = getTruncatedItems(cellData);
                return (
                    <div>
                        {cellData && Number(cellData) !== 0 ? (
                            <div className={styles.container}>
                                <DsTypography
                                    title={truncatedItems?.maxItemsToShow.join(', ')}
                                    variant="Regular_14"
                                    className={styles.sqlServerInstance}
                                >
                                    {truncatedItems?.maxItemsToShow.join(', ')}
                                </DsTypography>
                                {truncatedItems?.remaining.length > 0 && (
                                    <Popover
                                        popoverClass={styles.popover}
                                        children={truncatedItems?.remaining.map((item: any) => (
                                            <DsTypography variant="Regular_14">{item}</DsTypography>
                                        ))}
                                        trigger="hover"
                                        interactive
                                        delayHide={200}
                                        container={
                                            <DsTypography variant="Regular_14" className={styles.colorText}>
                                                {`+ ${truncatedItems?.remaining.length}`}
                                            </DsTypography>
                                        }
                                    />
                                )}
                            </div>
                        ) : (
                            ''
                        )}
                        {!cellData ? t('databases.general.not-available') : ''}
                    </div>
                );
            }
        },
        {
            Header: 'Deployment model',
            accessor: 'deploymentModel',
            id: '3',
            width: '16.66%',
            filterOptions: 'auto'
        },
        {
            Header: 'On-premises nodes',
            accessor: 'onPremisesNodes',
            id: '4',
            width: '16.66%',
            isSortable: true,
            accessorForTextFilter: 'onPremNode',
            renderCell: (cellData: any, rowData: any) => {
                const truncatedItems = getTruncatedItems(cellData);

                return (
                    <div>
                        {cellData && Number(cellData) !== 0 ? (
                            <div className={styles.container}>
                                <DsTypography
                                    title={truncatedItems?.maxItemsToShow.join(', ')}
                                    variant="Regular_14"
                                    className={styles.sqlServerInstance}
                                >
                                    {truncatedItems?.maxItemsToShow.join(', ')}
                                </DsTypography>
                                {truncatedItems?.remaining.length > 0 && (
                                    <Popover
                                        popoverClass={styles.popover}
                                        children={truncatedItems?.remaining.map((item: any) => (
                                            <DsTypography variant="Regular_14">{item}</DsTypography>
                                        ))}
                                        trigger="hover"
                                        interactive
                                        delayHide={200}
                                        container={
                                            <DsTypography variant="Regular_14" className={styles.colorText}>
                                                {`+ ${truncatedItems?.remaining.length}`}
                                            </DsTypography>
                                        }
                                    />
                                )}
                            </div>
                        ) : (
                            ''
                        )}
                        {!cellData ? t('databases.general.not-available') : ''}
                    </div>
                );
            }
        },
        {
            Header: 'Data collection time',
            accessor: 'creationTime',
            id: '5',
            width: '16.66%',
            renderCell: (cellData: string) => (
                <div>{cellData ? formatDateWithTime(cellData) : t('databases.general.not-available')}</div>
            )
        },
        {
            Header: '',
            accessor: '',
            id: '6',
            width: '16.66%',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.lasColContainer}>
                    <div
                        className={
                            selectedRowsForExploreSavingsOracleOnPremBulk.length > 0
                                ? CommonStyles.detectManageDisable
                                : CommonStyles.detectManage
                        }
                        onClick={
                            selectedRowsForExploreSavingsOracleOnPremBulk.length > 0
                                ? undefined
                                : () => onClickESHostOracleOnPrem(dispatch, rowData, isWorkloadFactory, navigate)
                        }
                        id="wlm-db-onprem-oracle-explore-savings-table-button"
                    >
                        <DsTypography variant="Regular_14" className={CommonStyles.textStyle}>
                            {t('databases.explore-savings.table-tooltip-content-three')}
                        </DsTypography>
                    </div>

                    <DeleteMenuCell
                        isDemoMode={isDemoMode}
                        isBulkSelected={selectedRowsForExploreSavingsOracleOnPremBulk.length > 0}
                        rowData={rowData}
                        menuOpenedRow={menuOpenedRow}
                        menuOpenedRowDetail={menuOpenedRowDetail}
                        setOpenedRow={setOpenedRow}
                        onDelete={handleDelete}
                    />
                </div>
            )
        }
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        selectionType: 'multiple',
        columns: OracleOnPremColDefs,
        rows: updatedTableData || [],
        pageSize: 50,
        defaultSelectedRows: [],
        isLoading: onPremiseOracleDataLoading || isUploadLoading
    });

    // Sync table selection state to Redux
    useEffect(() => {
        if (onPremiseOracleData && onPremiseOracleData.length > 0) {
            const selectedRowIds = Object.keys(tableProps.selectionState?.rows || {}).filter(
                key => tableProps.selectionState?.rows[key]
            );
            if (selectedRowIds.length > 0) {
                const selectedRows = onPremiseOracleData.filter((row: any) => selectedRowIds.includes(String(row.id)));
                dispatch(setSelectedRowsForExploreSavingsOracleOnPremBulk(selectedRows));
            } else {
                dispatch(setSelectedRowsForExploreSavingsOracleOnPremBulk([]));
            }
        }
    }, [tableProps.selectionState, onPremiseOracleData]);

    // Sync Redux selection state back to table when rows are removed externally
    useEffect(() => {
        if (!onPremiseOracleData || onPremiseOracleData.length === 0) return;

        const currentTableSelectedIds = new Set(
            Object.keys(tableProps.selectionState?.rows || {}).filter(id => tableProps.selectionState?.rows[id])
        );
        const reduxSelectedIds = new Set(
            selectedRowsForExploreSavingsOracleOnPremBulk.map((row: any) => String(row.id))
        );

        // Deselect rows that are selected in the table but not in Redux
        currentTableSelectedIds.forEach(id => {
            if (!reduxSelectedIds.has(id)) {
                tableProps.toggleRowSelection(id)(false);
            }
        });

        // Select rows that are in Redux but not selected in the table
        reduxSelectedIds.forEach(id => {
            if (!currentTableSelectedIds.has(id)) {
                tableProps.toggleRowSelection(id)(true);
            }
        });
    }, [selectedRowsForExploreSavingsOracleOnPremBulk, onPremiseOracleData]);

    const handleFileInputClick = () => {
        fileInputRef.current?.click();
    };

    const uploadOracleOnPremScript = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
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
                    message:
                        t('databases.inventory.file-size-exceeds', { max: maxSizeInMB }) +
                        t('databases.inventory.please-upload-smaller-file')
                })
            );
            event.target.value = ''; // Clear the file input
            return;
        }
        setIsUploadLoading(true);
        const reader = new FileReader();
        reader.onload = async e => {
            try {
                if (isDemoMode) {
                    setTimeout(() => {
                        setIsUploadLoading(false);
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.INFO,
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

                    if (compressedBase64) {
                        const result = await getUploadScript({
                            type: 'oracle',
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
                                        fetchOracleOnPremData(true);
                                        setIsUploadLoading(false);
                                        dispatch(
                                            addNotification({
                                                notificationType: NOTIFICATION_TYPES.INFO,
                                                message: t('databases.explore-savings.uploaded-assessment-script')
                                            })
                                        );
                                        clearInterval(jobInterval);
                                    } else if (status === JOB_MONITORING_STATUS.FAILED) {
                                        setIsUploadLoading(false);
                                        dispatch(
                                            addNotification({
                                                notificationType: NOTIFICATION_TYPES.ERROR,
                                                message: jobRes?.data?.error || 'Error uploading file.'
                                            })
                                        );
                                        clearInterval(jobInterval);
                                    }
                                });
                            }, 5000);
                        } else {
                            setIsUploadLoading(false);
                            event.target.value = ''; //
                        }
                    }
                }
            } catch (error) {
                event.target.value = ''; // Clear the file input
            }
        };

        // Start reading the file - this triggers the onload callback
        reader.readAsText(selectedFile);

        // Reset the input immediately so the same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleOracleOnPremBulkAction = () => {
        if (selectedRowsForExploreSavingsOracleOnPremBulk.length > 0) {
            onClickESHostOracleOnPremBulk(
                dispatch,
                selectedRowsForExploreSavingsOracleOnPremBulk,
                isWorkloadFactory,
                navigate
            );
        }
    };

    return (
        <>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.explore-savings.oracle-database-on-premises')}
                singularTitle={t('databases.explore-savings.oracle-database-on-premises')}
                className={`${styles.topBarInstanceStyle} ${CommonStyles.commonTopBarInstanceStyle}`}
                info={<TableTooltip />}
                actionsRight={
                    <div>
                        <DsButton
                            ref={buttonRef}
                            children={t('databases.explore-savings.assessment-script')}
                            variant="Default"
                            isThin
                            dropDown={{
                                trigger: 'click',
                                autoPosition: true,
                                placement: 'alignRight',
                                items: [
                                    {
                                        id: 'wlm-db-learn-assessment-mssql',
                                        label: t('databases.explore-savings.assessment-script-information'),
                                        onClick: () => {
                                            openAssessmentDialog();
                                        }
                                    },
                                    {
                                        id: 'wlm-db-download-script-mssql',
                                        label: t('databases.explore-savings.download-assessment-script'),
                                        onClick: () => {
                                            handleDownload();
                                        }
                                    },
                                    {
                                        id: 'wlm-db-upload-script-mssql',
                                        label: t('databases.explore-savings.upload-script-results'),
                                        onClick: handleFileInputClick
                                    }
                                ]
                            }}
                        />
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".json"
                            style={{ display: 'none' }}
                            onChange={uploadOracleOnPremScript}
                        />
                    </div>
                }
            />
            {selectedRowsForExploreSavingsOracleOnPremBulk.length > 0 && (
                <BulkActionContainer
                    action={t('databases.explore-savings.explore-savings-title')}
                    onClick={handleOracleOnPremBulkAction}
                />
            )}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </>
    );
};

export default OracleOnPremTable;
