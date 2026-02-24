import React, { useEffect, useRef, useState } from 'react';
import { DsButton, DsTypography } from '@tlveng/wlm-ds';
import { compressSync } from 'fflate';
import { useDialog } from '@netapp/design-system/dist/components/Dialog';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Popover } from '@netapp/design-system/dist/components/Popover';
import { useNavigate } from 'react-router-dom';

import { ColumnProps, Table } from '../../../common/Lib/Table/Table';
import { useTable } from '../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../common/Lib/Table/TableTopBar';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import styles from './OracleTCOTables.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import AssessmentDialog from './AssessmentDialog/AssessmentDialog';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { useAppSelector } from '../../../store/storeHooks';
import {
    useGetOracleOnPremTCODownloadScriptMutation,
    useGetUploadScriptMutation,
    useLazyGetSubTaskListQuery
} from '../../../utils/apiService';
import { JOB_MONITORING_STATUS } from '../../../utils/consts';
import TableTooltip from './TableTooltip/TableTooltip';
import { useOnPremData } from '../ExploreSavingsOnPremiseTable/useOnPremData';
import { formatDateWithTime, getTruncatedItems } from '../../../utils/utilityFunctions';
import { onClickESHostOracleOnPrem } from '../ExploreSavingsUtils';

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
    const [getUploadScript] = useGetUploadScriptMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [getOracleOnPremTCODownloadScript] = useGetOracleOnPremTCODownloadScriptMutation();
    useEffect(() => {
        fetchOracleOnPremData();
    }, []);

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
            console.error('Error downloading assessment script:', error);
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: 'Error downloading assessment script.'
                })
            );
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
                        className={CommonStyles.detectManage}
                        onClick={() => onClickESHostOracleOnPrem(dispatch, rowData, isWorkloadFactory, navigate)}
                        id="wlm-db-onprem-oracle-explore-savings-table-button"
                    >
                        <DsTypography variant="Regular_14" className={CommonStyles.textStyle}>
                            {t('databases.explore-savings.table-tooltip-content-three')}
                        </DsTypography>
                    </div>
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
        selectionType: 'none',
        columns: OracleOnPremColDefs,
        rows: onPremiseOracleData || [],
        pageSize: 50,
        isLoading: onPremiseOracleDataLoading || isUploadLoading
    });

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

    return (
        <>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.explore-savings.oracle-database-on-premises')}
                singularTitle={t('databases.explore-savings.oracle-database-on-premises')}
                className={styles.topBarInstanceStyle}
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
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </>
    );
};

export default OracleOnPremTable;
