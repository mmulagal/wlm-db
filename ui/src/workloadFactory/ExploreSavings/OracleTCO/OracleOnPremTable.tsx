import React, { useRef } from 'react';
import { DsButton } from '@tlveng/wlm-ds';
import { compressSync } from 'fflate';
import { useDialog } from '@netapp/design-system/dist/components/Dialog';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ColumnProps, Table } from '../../../common/Lib/Table/Table';
import { useTable } from '../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../common/Lib/Table/TableTopBar';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import styles from './OracleTCOTables.module.scss';
import AssessmentDialog from './AssessmentDialog/AssessmentDialog';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { useAppSelector } from '../../../store/storeHooks';
import { useGetUploadScriptMutation, useLazyGetSubTaskListQuery } from '../../../utils/apiService';
import { JOB_MONITORING_STATUS } from '../../../utils/consts';
import TableTooltip from './TableTooltip/TableTooltip';

const OracleOnPremTable = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const buttonRef: any = useRef(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { setDialog } = useDialog();
    const { isDemoMode } = useAppSelector(state => state.auth);
    const [getUploadScript] = useGetUploadScriptMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const mockData: any = [
        // {
        //     id: '1',
        //     hostName: 'Oracle On-Prem host 1',
        //     databaseName: 'DB name 1',
        //     deploymentModel: 'Data Guard',
        //     onPremModes: 'Node 1',
        //     dataCOllectionDate: '2024-01-01'
        // },
        // {
        //     id: '2',
        //     hostName: 'Oracle On-Prem host 2',
        //     databaseName: 'DB name 2',
        //     deploymentModel: 'Data Guard',
        //     onPremModes: 'Node 2',
        //     dataCOllectionDate: '2024-01-02'
        // },
        // {
        //     id: '3',
        //     hostName: 'Oracle On-Prem host 3',
        //     databaseName: 'DB name 3',
        //     deploymentModel: 'Single Instance',
        //     onPremModes: 'Node 3',
        //     dataCOllectionDate: '2024-01-03'
        // }
    ];

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

    const handleDownload = () => {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: 'Assessment script downloaded successfully.'
            })
        );
    };
    const OracleOnPremColDefs: ColumnProps[] = [
        {
            Header: 'Host name',
            accessor: 'hostName',
            id: '1',
            isSortable: true,
            width: '16.66%'
        },
        {
            Header: 'Database name',
            accessor: 'databaseName',
            id: '2',
            width: '16.66%',
            isSortable: true
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
            accessor: 'onPremModes',
            id: '4',
            width: '16.66%',
            filterOptions: 'auto'
        },
        {
            Header: 'Data collection time',
            accessor: 'dataCOllectionDate',
            id: '5',
            width: '16.66%',
            filterOptions: 'auto'
        },
        {
            Header: '',
            accessor: '',
            id: '6',
            width: '16.66%'
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
        rows: mockData,
        pageSize: 50
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
        const reader = new FileReader();
        reader.onload = async e => {
            try {
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
                                    dispatch(
                                        addNotification({
                                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                                            message: t(
                                                'databases.explore-savings.assessment-script-uploaded-successfully'
                                            )
                                        })
                                    );
                                    clearInterval(jobInterval);
                                } else if (status === JOB_MONITORING_STATUS.FAILED) {
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
                    }
                }
            } catch (error) {
                console.error('Error uploading WAD script:', error);
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
                pluralTitle="Oracle Server on-premises"
                singularTitle="Oracle Server on-premises"
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
                                        isDisabled: true,
                                        onClick: () => {
                                            handleDownload();
                                        }
                                    },
                                    {
                                        id: 'wlm-db-upload-script-mssql',
                                        isDisabled: true,
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
