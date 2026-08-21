import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
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
    setOptimizePrintState: (state: boolean) => void;
    loading: boolean | null;
    isAssessmentAvailable: boolean;
}

const OracleExportPDF = ({
    optimizePrintState,
    setOptimizePrintState,
    loading,
    isAssessmentAvailable
}: OracleExportPDFProps) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const {
        driftAssessmentData,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        selectedResourceId,
        selectedDatabaseInstance
    } = useAppSelector(state => state.getWellOptimize);

    const printDocument = async () => {
        setOptimizePrintState(true);
        setTimeout(async () => {
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
                setOptimizePrintState(false);
            } catch (error) {
                console.error('Error generating Excel report:', error);
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: `${GENERAL.REPORT_DOWNLOAD_FAIL}: ${String(error)}`
                    })
                );
            }
        }, 100);
    };

    return (
        !optimizePrintState && (
            <div className={styles.oracleExportPDF}>
                <div
                    className={
                        loading || !isAssessmentAvailable ? styles.downloadSectionDisable : styles.downloadSection
                    }
                >
                    <div />
                    <div
                        id="oracle-assessment-export-pdf"
                        className={styles.buttonStyle}
                        onClick={loading || !isAssessmentAvailable ? () => {} : printDocument}
                    >
                        <div>
                            <Download />
                        </div>
                        <DsTypography
                            style={{
                                color:
                                    loading || !isAssessmentAvailable
                                        ? 'var(--text-disabled)'
                                        : 'var(--text-button-primary)'
                            }}
                            variant="Semibold_14"
                        >
                            {t('databases.well-architect.export-report')}
                        </DsTypography>
                    </div>
                </div>
            </div>
        )
    );
};

export default OracleExportPDF;
