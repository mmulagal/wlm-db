import { Button, DsFlashingDotsLoader, DsTypography, Popover } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ScanImage } from '../../assets/ic_scan.svg';
import { ReactComponent as Warning } from '../../assets/warning.svg';
import styles from './AssessmentContainer.module.scss';
import { useAppSelector } from '../../store/storeHooks';
import CommonStyles from '../../utils/CommonStyles.module.scss';
import SeparatorComponent from '../SeparatorComponent/SeparatorComponent';

interface AssessmentContainerProps {
    onClick: () => void;
    isLoading: boolean;
    gwTimestamp: string;
    gwAdhocError: string;
    optimizePageLoading: boolean;
}

const AssessmentContainer = ({
    onClick,
    isLoading,
    gwTimestamp,
    gwAdhocError,
    optimizePageLoading
}: AssessmentContainerProps) => {
    const { t } = useTranslation();
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    return (
        <div className={styles.assessment}>
            <div className={styles.leftSide}>
                <div className={styles.leftContainer}>
                    <div className={!isDarkTheme ? `${styles.scanImage}` : `${styles.scanImage} ${styles.darkTheme}`}>
                        <ScanImage />
                    </div>
                    <div className={styles.textSection}>
                        <DsTypography variant="Regular_14">{t('databases.general.assessment-performed')}</DsTypography>
                        <SeparatorComponent variant="vertical" height="16px" />
                        <div className={styles.dateSection}>
                            {optimizePageLoading && <DsFlashingDotsLoader />}
                            {!optimizePageLoading && gwTimestamp && gwTimestamp !== '0' && (
                                <>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.general.last-update')}
                                    </DsTypography>
                                    <DsTypography variant="Semibold_14">{gwTimestamp}</DsTypography>
                                </>
                            )}
                            {!optimizePageLoading && (!gwTimestamp || gwTimestamp === '0') && (
                                <DsTypography variant="Regular_14">
                                    {t('databases.general.no-analysis-performed')}
                                </DsTypography>
                            )}
                        </div>
                    </div>
                    {gwAdhocError && (
                        <Popover popoverClass={CommonStyles.popover} trigger="hover" container={<Warning />}>
                            <DsTypography variant="Regular_14" style={{ wordBreak: 'break-word' }}>
                                {gwAdhocError}
                            </DsTypography>
                        </Popover>
                    )}
                </div>
            </div>
            <div className={styles.rightSide}>
                <Button
                    variant="secondary"
                    data-testid="wlm-db-analyze-now"
                    isThin
                    onClick={onClick}
                    isLoading={isLoading}
                >
                    {t('databases.general.assess-now')}
                </Button>
            </div>
        </div>
    );
};

export default AssessmentContainer;
