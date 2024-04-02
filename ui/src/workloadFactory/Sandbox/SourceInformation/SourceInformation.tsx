import { ReactComponent as Source } from '../../../assets/Source.svg';
import { ReactComponent as Sandbox } from '../../../assets/Sandbox.svg';

import styles from './SourceInformation.module.scss';
import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';

const SourceInformation = () => {
    const loading = false;
    return (
        <div className={styles.sourceInformation}>
            <div className={styles.wrapperContainer}>
                <Source />
                <div className={styles.insideContainer}>
                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                        {loading && (
                            <div className={styles.loadingContainer}>
                                <FlashingDotsLoader />
                            </div>
                        )}
                        {!loading && 12}
                    </DsTypography>
                    <DsTypography variant="Regular_14" style={{ width: '119px' }}>
                        {GENERAL.SANDBOX_SOURCE_DATABASES}
                    </DsTypography>
                </div>
            </div>

            <div className={styles.wrapperContainer}>
                <Sandbox />
                <div className={styles.insideContainer}>
                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                        {loading && (
                            <div className={styles.loadingContainer}>
                                <FlashingDotsLoader />
                            </div>
                        )}
                        {!loading && 12}
                    </DsTypography>
                    <DsTypography variant="Regular_14">{GENERAL.SANDBOXES}</DsTypography>
                </div>
            </div>
        </div>
    );
};

export default SourceInformation;
