import { useDispatch } from 'react-redux';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
import { DsPopover } from '@tlveng/wlm-ds';
import { ReactComponent as Download } from '../../../../../assets/download.svg';
import styles from './OracleExportPDF.module.scss';
import { NOTIFICATION_TYPES, addNotification } from '../../../../../store/notificationSlice';
import { GENERAL } from '../../../../../utils/appConstants';
import { DBType, WIZARD_TYPE, PATCH_SCAN_FIELD, ASSESSMENT_CONFIG_IDS } from '../../../../../utils/consts';
import generateReport, { enrichAssessmentDataWithPatches } from '../../../../../utils/generateWellArchitectedExcel';
import { getWellApi } from '../../../../../utils/apiService';
import { useAppSelector } from '../../../../../store/storeHooks';

interface OracleExportPDFProps {
    optimizePrintState: boolean;
    loading: boolean | null;
    isAssessmentAvailable: boolean;
}

const OracleExportPDF = ({ optimizePrintState, loading, isAssessmentAvailable }: OracleExportPDFProps) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const [isExporting, setIsExporting] = useState(false);
    const {
        driftAssessmentData,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        selectedResourceId,
        selectedDatabaseInstance
    } = useAppSelector(state => state.getWellOptimize);

    const printDocument = async () => {
        setIsExporting(true);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: t('databases.well-architect.export-report-in-progress')
            })
        );
        try {
            const patchConfigs = [
                { id: ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH, field: PATCH_SCAN_FIELD.HOST_OS_PATCH },
                {
                    id: ASSESSMENT_CONFIG_IDS.ORACLE_SECURITY_PATCH,
                    field: PATCH_SCAN_FIELD.ORACLE_SECURITY_PATCH
                }
            ];

            const enrichedData = await enrichAssessmentDataWithPatches(
                driftAssessmentData,
                patchConfigs,
                WIZARD_TYPE.ORACLE,
                selectedGwInstanceCredId,
                selectedGwInstanceRegionId,
                selectedResourceId,
                selectedDatabaseInstance,
                dispatch,
                getWellApi
            );

            await generateReport(
                JSON.stringify(enrichedData),
                DBType.ORACLE,
                (driftAssessmentData as any)?.isWad || false
            );
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: GENERAL.REPORT_DOWNLOAD_SUCCESS
                })
            );
        } catch (error) {
            console.error('Error generating Excel report:', error);
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: `${GENERAL.REPORT_DOWNLOAD_FAIL}: ${String(error)}`
                })
            );
        } finally {
            setIsExporting(false);
        }
    };

    const isDisabled = loading || !isAssessmentAvailable || isExporting;

    const exportButton = (
        <div
            id="oracle-assessment-export-pdf"
            className={styles.buttonStyle}
            onClick={isDisabled ? () => {} : printDocument}
        >
            <div>
                <Download />
            </div>
            <DsTypography
                style={{
                    color: isDisabled ? 'var(--text-disabled)' : 'var(--text-button-primary)'
                }}
                variant="Semibold_14"
            >
                {t('databases.well-architect.export-report')}
            </DsTypography>
        </div>
    );

    return (
        !optimizePrintState && (
            <div className={styles.oracleExportPDF}>
                <div className={isDisabled ? styles.downloadSectionDisable : styles.downloadSection}>
                    <div />
                    {isExporting ? (
                        <DsPopover
                            trigger="hover"
                            title={t('databases.well-architect.export-report-in-progress')}
                            monitorPosition="all"
                            placement="bottom"
                        >
                            {exportButton}
                        </DsPopover>
                    ) : (
                        exportButton
                    )}
                </div>
            </div>
        )
    );
};

export default OracleExportPDF;
