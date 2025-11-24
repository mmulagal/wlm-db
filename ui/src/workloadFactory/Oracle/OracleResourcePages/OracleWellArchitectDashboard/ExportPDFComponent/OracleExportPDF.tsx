import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Download } from '../../../../../assets/download.svg';
import styles from './OracleExportPDF.module.scss';
import { NOTIFICATION_TYPES, addNotification } from '../../../../../store/notificationSlice';
import { GENERAL } from '../../../../../utils/appConstants';
import { DBType } from '../../../../../utils/consts';
import generateReport from '../../../../../utils/generateWellArchitectedExcel';
import { generateDate } from '../../../../GetWell/GetWellUtils';
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
    const { driftAssessmentData } = useAppSelector(state => state.getWellOptimize);
    const printDocument = async () => {
        setOptimizePrintState(true);
        setTimeout(async () => {
            try {
                await generateReport(JSON.stringify(driftAssessmentData), DBType.ORACLE);
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
