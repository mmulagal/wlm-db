import { DsButton, useDialog } from '@netapp/design-system';
import { useRef } from 'react';
import { compressSync } from 'fflate';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import store from '../../../../store/store';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    useGetOneTimeWADDownloadScriptMutation,
    useGetOneTimeWADUploadScriptMutation,
    useLazyGetAllOfflineMssqlHostsAssessmentDataQuery,
    useLazyGetAllOfflineOracleHostsAssessmentDataQuery,
    useLazyGetOfflineMssqlAssessmentDatabasesQuery,
    useLazyGetSubTaskListQuery
} from '../../../../utils/apiService';
import { DBType, JOB_MONITORING_STATUS } from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../../store/notificationSlice';
import { GENERAL } from '../../../../utils/appConstants';
import OneTimeWADDialogContent from '../../../InventoryV2/InventoryTablesComponent/InstancesTable/OneTimeWADDialogContent/OneTimeWADDialogContent';
import {
    autoSelectRegionInHeaderFilter,
    refreshOfflineAssessmentData,
    refreshOfflineMssqlDatabasesData,
    refreshOfflineOracleAssessmentData
} from '../../../InventoryV2/InventoryTablesComponent/InstancesTable/InstanceTableHelper';
import WADEngineTypeSelector from './WADEngineTypeSelector';

const WADDialogHeader = () => {
    const { t } = useTranslation();
    const { selectedEngineTypeForWADDashboard } = useAppSelector(state => state.inventoryV2);

    return selectedEngineTypeForWADDashboard === DBType.MSSQL
        ? t('databases.inventory.one-time-wad-dialog-heading-final')
        : t('databases.inventory.one-time-wad-dialog-heading-oracle');
};

const WADButton = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { selectedEngineTypeForWADDashboard } = useAppSelector(state => state.inventoryV2);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const { regionMapping, headerSelectedMultiRegionIdsList, getRegions, headerSelectedMultiRegion } = useAppSelector(
        state => state.headers
    );

    const [getOneTimeWADDownloadScript] = useGetOneTimeWADDownloadScriptMutation();
    const [getOneTimeWADUploadScript] = useGetOneTimeWADUploadScriptMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [getAllOfflineAssessmentAPI] = useLazyGetAllOfflineMssqlHostsAssessmentDataQuery();
    const [getAllOfflineOracleAssessmentAPI] = useLazyGetAllOfflineOracleHostsAssessmentDataQuery();
    const [getOfflineMssqlDatabasesAPI] = useLazyGetOfflineMssqlAssessmentDatabasesQuery();

    const getEngineApiType = (engineType: string) => (engineType === DBType.MSSQL ? 'mssql' : 'oracle');

    const openWADDialog = () => {
        setDialog(
            <DialogComponent
                header={<WADDialogHeader />}
                content={<OneTimeWADDialogContent showEngineTypeSelector />}
                secondaryButton={GENERAL.CLOSE}
                closeCallback={() => {}}
                hidePrimaryButton
                customClass="oneTimeWADDialog"
            />
        );
    };

    const downloadWADScript = async (engineType: string) => {
        try {
            const response: any = await getOneTimeWADDownloadScript({
                type: getEngineApiType(engineType)
            });

            if (response?.data?.blob) {
                const { blob, fileName } = response.data;
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.INFO,
                        message: t('databases.inventory.one-time-wad-download-success')
                    })
                );
            }
        } catch (error) {
            console.error('Error downloading WAD script:', error);
        }
    };

    const openEngineTypeDialog = (
        primaryButtonLabel: string,
        onConfirm: () => void,
        context: 'download' | 'upload'
    ) => {
        setDialog(
            <DialogComponent
                header={t('databases.inventory.select-engine-type')}
                content={<WADEngineTypeSelector context={context} />}
                primaryButton={primaryButtonLabel}
                secondaryButton={GENERAL.CLOSE}
                callback={() => {
                    closeDialog();
                    onConfirm();
                }}
                closeCallback={() => closeDialog()}
            />
        );
    };

    const handleFileInputClick = () => {
        fileInputRef.current?.click();
    };

    const uploadWADScript = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json') && !isDemoMode) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.inventory.invalid-file-type')
                })
            );
            event.target.value = '';
            return;
        }

        const maxSizeInMB = 2;
        const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
        if (selectedFile.size > maxSizeInBytes && !isDemoMode) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message:
                        t('databases.inventory.file-size-exceeds', { max: maxSizeInMB }) +
                        t('databases.inventory.please-upload-smaller-file')
                })
            );
            event.target.value = '';
            return;
        }

        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: t('databases.inventory.one-time-wad-upload-inprogress')
            })
        );

        const reader = new FileReader();
        reader.onload = async e => {
            try {
                const jsonString = e.target?.result as string;
                const base64Encoded = btoa(jsonString);
                const base64Bytes = new TextEncoder().encode(base64Encoded);
                const compressedData = compressSync(base64Bytes);

                let binaryString = '';
                const chunkSize = 8192;
                for (let i = 0; i < compressedData.length; i += chunkSize) {
                    binaryString += String.fromCharCode(...compressedData.subarray(i, i + chunkSize));
                }
                const compressedBase64 = btoa(binaryString);

                if (compressedBase64) {
                    const result = await getOneTimeWADUploadScript({
                        type: getEngineApiType(selectedEngineTypeForWADDashboard),
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
                                    dispatch(clearNotifications());

                                    const resourceName = jobRes?.data?.resourceName || '';
                                    const regionCode = jobRes?.data?.region?.code || '';
                                    const regionNameFromResponse = jobRes?.data?.region?.name || '';
                                    const regionName =
                                        regionNameFromResponse ||
                                        (regionCode && regionMapping?.[regionCode]?.regionName) ||
                                        '';
                                    let message = t('databases.inventory.one-time-wad-upload-success');

                                    if (resourceName) {
                                        if (regionName) {
                                            const template = t(
                                                'databases.inventory.one-time-wad-upload-success-with-resource-region'
                                            );
                                            message = template
                                                .replace('{{resourceName}}', resourceName)
                                                .replace('{{regionName}}', regionName);
                                        } else {
                                            const template = t(
                                                'databases.inventory.one-time-wad-upload-success-with-resource'
                                            );
                                            message = template.replace('{{resourceName}}', resourceName);
                                        }
                                    }

                                    dispatch(
                                        addNotification({
                                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                                            message
                                        })
                                    );

                                    autoSelectRegionInHeaderFilter(
                                        regionCode,
                                        headerSelectedMultiRegionIdsList,
                                        getRegions,
                                        headerSelectedMultiRegion,
                                        dispatch
                                    );

                                    clearInterval(jobInterval);

                                    if (selectedEngineTypeForWADDashboard === DBType.ORACLE) {
                                        refreshOfflineOracleAssessmentData(
                                            getAllOfflineOracleAssessmentAPI,
                                            dispatch,
                                            [],
                                            null
                                        );
                                    } else {
                                        refreshOfflineAssessmentData(getAllOfflineAssessmentAPI, dispatch, [], null);
                                        refreshOfflineMssqlDatabasesData(
                                            getOfflineMssqlDatabasesAPI,
                                            dispatch,
                                            [],
                                            null
                                        );
                                    }
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

        reader.readAsText(selectedFile);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <DsButton
                children={t('databases.inventory.one-time-assessment')}
                variant="Default"
                dropDown={{
                    trigger: 'click',
                    autoPosition: true,
                    items: [
                        {
                            id: 'wlm-db-learn-assessment-wad-dashboard',
                            label: t('databases.inventory.learn-about-assessment'),
                            onClick: () => {
                                openWADDialog();
                            }
                        },
                        {
                            id: 'wlm-db-download-script-wad-dashboard',
                            label: t('databases.inventory.download-script'),
                            isDisabled: false,
                            onClick: () => {
                                openEngineTypeDialog(
                                    t('databases.inventory.download-script'),
                                    () => {
                                        const engineType =
                                            store.getState().inventoryV2.selectedEngineTypeForWADDashboard;
                                        downloadWADScript(engineType);
                                    },
                                    'download'
                                );
                            }
                        },
                        {
                            id: 'wlm-db-upload-results-wad-dashboard',
                            label: t('databases.inventory.upload-results'),
                            isDisabled: false,
                            onClick: () => {
                                openEngineTypeDialog(
                                    t('databases.inventory.upload-results'),
                                    handleFileInputClick,
                                    'upload'
                                );
                            }
                        }
                    ]
                }}
            />
            <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                style={{ display: 'none' }}
                onChange={uploadWADScript}
            />
        </>
    );
};

export default WADButton;
