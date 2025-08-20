import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Download } from '../../../../../assets/download.svg';
import styles from './OracleExportPDF.module.scss';
import { NOTIFICATION_TYPES, addNotification } from '../../../../../store/notificationSlice';
import { GENERAL } from '../../../../../utils/appConstants';
import downloadPdf from '../../../../../common/pdfGenerator';
import { generateDate } from '../../../../GetWell/GetWellUtils';

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

    const printDocument = () => {
        setOptimizePrintState(true);
        setTimeout(() => {
            const elem = document.getElementById('export-oracle-optimize-pdf') as HTMLElement;
            const options = {
                filename: `Oracle_Optimization_Report_${generateDate()}.pdf`,
                compression: 'MEDIUM'
            };

            downloadPdf(elem, options, () => {
                setOptimizePrintState(false);
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: GENERAL.REPORT_DOWNLOAD_SUCCESS
                    })
                );
            });
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
                            {t('databases.well-architect.export-pdf')}
                        </DsTypography>
                    </div>
                </div>
            </div>
        )
    );
};

export default OracleExportPDF;
