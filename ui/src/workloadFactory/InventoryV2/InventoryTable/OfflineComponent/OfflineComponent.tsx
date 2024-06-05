import styles from './OfflineComponent.module.scss';
import { ReactComponent as File } from '../../../../assets/ic_file.svg';
import { Button, DsTypography } from '@netapp/design-system';
import { SSM_TROUBLESHOOTING_LINK } from '../../../../utils/consts';
import { GENERAL } from '../../../../utils/appConstants';

const OfflineComponent = () => {
    return (
        <div className={styles.offlineComponent}>
            <div className={styles.firstRow}>
                <div>
                    <File />
                </div>
                <DsTypography variant="Semibold_14" className={styles.message}>
                    {GENERAL.OFFLINE_COMPONENT_TEXT_1}
                </DsTypography>
            </div>

            <div className={styles.secondRow}>
                <DsTypography variant="Regular_14">{GENERAL.OFFLINE_COMPONENT_TEXT_2}</DsTypography>&nbsp;
                <Button variant="link" onClick={() => window.open(SSM_TROUBLESHOOTING_LINK, '_blank', 'noopener')}>
                    {GENERAL.SEE_SSM_LINK}
                </Button>
            </div>
        </div>
    );
};

export default OfflineComponent;
