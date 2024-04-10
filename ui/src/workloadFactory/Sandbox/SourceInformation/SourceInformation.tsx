import { ReactComponent as Source } from '../../../assets/Source.svg';
import { ReactComponent as Sandbox } from '../../../assets/Sandbox.svg';

import CommonStyles from '../../../utils/CommonStyles.module.scss';
import styles from './SourceInformation.module.scss';
import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';

const SourceInformation = () => {
    const loading = false;
    const { isNA } = useAppSelector(state => state.sandbox);
    return (
        <div className={styles.sourceInformation}>
            <div className={styles.wrapperContainer}>
                <Source />
                <div className={styles.insideContainer}>
                    {!isNA && (
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {loading && (
                                <div className={styles.loadingContainer}>
                                    <FlashingDotsLoader />
                                </div>
                            )}
                            {!loading && 12}
                        </DsTypography>
                    )}

                    {isNA && (
                        <DsTypography
                            variant="Regular_14"
                            className={`${CommonStyles.notAvailable} ${CommonStyles.notAvailableInformation}`}
                        >
                            {GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                    )}

                    <DsTypography
                        variant="Regular_14"
                        style={{ width: '119px' }}
                        className={isNA ? CommonStyles.notAvailable : ''}
                    >
                        {GENERAL.SANDBOX_SOURCE_DATABASES}
                    </DsTypography>
                </div>
            </div>

            <div className={styles.wrapperContainer}>
                <Sandbox />
                <div className={styles.insideContainer}>
                    {!isNA && (
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {loading && (
                                <div className={styles.loadingContainer}>
                                    <FlashingDotsLoader />
                                </div>
                            )}
                            {!loading && 12}
                        </DsTypography>
                    )}
                    {isNA && (
                        <DsTypography
                            variant="Regular_14"
                            className={`${CommonStyles.notAvailable} ${CommonStyles.notAvailableInformation}`}
                        >
                            {GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                    )}
                    <DsTypography variant="Regular_14" className={isNA ? CommonStyles.notAvailable : ''}>
                        {GENERAL.SANDBOXES}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default SourceInformation;
