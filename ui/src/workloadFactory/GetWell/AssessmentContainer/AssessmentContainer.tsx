import { Button, DsTypography, Popover } from '@netapp/design-system';
import { ReactComponent as ScanImage } from '../../../assets/ic_scan.svg';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import styles from './AssessmentContainer.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const AssessmentContainer = ({ onClick, isLoading }: any) => {
    const { gwTimestamp, gwAdhocError } = useAppSelector(state => state.getWellOptimize);
    return (
        <div className={styles.assessment}>
            <div className={styles.leftSide}>
                <div className={styles.leftContainer}>
                    <div className={styles.scanImage}>
                        <ScanImage />
                    </div>
                    <div className={styles.textSection}>
                        <DsTypography variant="Regular_14">{GENERAL.ASSESSMENT_PERFORMED}</DsTypography>&nbsp;
                        <DsTypography variant="Semibold_14">{gwTimestamp}</DsTypography>
                    </div>
                    {gwAdhocError && (
                        <Popover
                            popoverClass={CommonStyles['popover']}
                            children={
                                <DsTypography variant="Regular_14" style={{ wordBreak: 'break-word' }}>
                                    {gwAdhocError}
                                </DsTypography>
                            }
                            trigger="hover"
                            container={<Warning />}
                        />
                    )}
                </div>
            </div>
            <div className={styles.rightSide}>
                <Button variant="secondary" isThin onClick={onClick} isLoading={isLoading}>
                    {GENERAL.ASSESS_NOW}
                </Button>
            </div>
        </div>
    );
};

export default AssessmentContainer;
