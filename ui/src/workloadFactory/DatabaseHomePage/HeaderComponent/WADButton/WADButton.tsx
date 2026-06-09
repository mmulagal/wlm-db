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



const WADButton = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const selectedUploadFileRef = useRef<File | null>(null);

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
                header={t('databases.inventory.learn-about-one-time-assessment')}
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

    const handleUploadFileChange = (file: File | null) => {
        selectedUploadFileRef.current = file;
    };

    const openEngineTypeDialog = (
        primaryButtonLabel: string,
        context: 'download' | 'upload',
        onConfirm?: () => void
    ) => {
        if (context === 'upload') {
            selectedUploadFileRef.current = null;
        }

        setDialog(
            <DialogComponent
                header={
                    context === 'download'
                        ? t('databases.inventory.download-assessment-script')
                        : t('databases.inventory.upload-assessment-script')
                }
                content={
                    <WADEngineTypeSelector
                        context={context}
                        onFileChange={context === 'upload' ? handleUploadFileChange : undefined}
                    />
                }
                primaryButton={primaryButtonLabel}
                secondaryButton={GENERAL.CLOSE}
                callback={() => {
                    closeDialog();
                    if (context === 'upload') {
                        if (selectedUploadFileRef.current) {
                            uploadWADScript(selectedUploadFileRef.current);
                        } else {
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: t('databases.inventory.no-file-selected')
                                })
                            );
                        }
                    } else {
                        onConfirm?.();
                    }
                }}
                closeCallback={() => closeDialog()}
            />
        );
    };

    const uploadWADScript = async (selectedFile: File) => {
        if (!selectedFile) return;

        if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json') && !isDemoMode) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.inventory.invalid-file-type')
                })
            );
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
                                    'download',
                                    () => {
                                        const engineType =
                                            store.getState().inventoryV2.selectedEngineTypeForWADDashboard;
                                        downloadWADScript(engineType);
                                    }
                                );
                            }
                        },
                        {
                            id: 'wlm-db-upload-results-wad-dashboard',
                            label: t('databases.inventory.upload-results'),
                            isDisabled: false,
                            onClick: () => {
                                openEngineTypeDialog(t('databases.inventory.upload-results'), 'upload');
                            }
                        }
                    ]
                }}
            />
        </>
    );
};

export default WADButton;
