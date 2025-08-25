import { useTranslation } from 'react-i18next';
import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { ReactComponent as Storage } from '../../../../../assets/Storage.svg';
import { ReactComponent as Applications } from '../../../../../assets/Application.svg';
import { ReactComponent as Resiliency } from '../../../../../assets/Resiliency.svg';
import { ReactComponent as Cloning } from '../../../../../assets/Cloning.svg';
import { ReactComponent as Compute } from '../../../../../assets/Compute.svg';
import { ReactComponent as ComingSoon } from '../../../../../assets/comingSoon2.svg';
import styles from './OracleConfigureCategory.module.scss';

import { useAppSelector } from '../../../../../store/storeHooks';
import { GENERAL } from '../../../../../utils/appConstants';
import OptimizeComponent from '../../../../GetWell/OptimizeComponent/OptimizeComponent';

const OracleConfigureCategory = () => {
    const { t } = useTranslation();
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const optimizationBreakDown = useAppSelector(state => state.getWellOptimize.optimizationBreakDown);

    return (
        <div className={styles['oracle-configure-category']}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Configuration categories
                </DsTypography>
                {loading && <DsFlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <div className={styles.leftSide}>
                    <OptimizeComponent
                        value={optimizationBreakDown?.storage?.percent || 0}
                        data={optimizationBreakDown?.storage}
                        text="Storage"
                        image={<Storage />}
                        isComingSoon={false}
                    />
                    <OptimizeComponent value={<ComingSoon />} text="Compute" image={<Compute />} isComingSoon />
                    <OptimizeComponent
                        value={<ComingSoon />}
                        text={t('databases.well-architect.application-oracle-server')}
                        image={<Applications />}
                        isComingSoon
                    />
                </div>

                <div className={styles.rightSide}>
                    <OptimizeComponent value={<ComingSoon />} text="Resiliency" image={<Resiliency />} isComingSoon />
                    <OptimizeComponent value={<ComingSoon />} text="Cloning" image={<Cloning />} isComingSoon />
                </div>
            </div>
        </div>
    );
};

export default OracleConfigureCategory;
