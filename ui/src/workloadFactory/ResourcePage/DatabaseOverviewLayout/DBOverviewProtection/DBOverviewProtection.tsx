import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import styles from './DBOverviewProtection.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import MultiRingDoughnut from '../../../DatabaseHomePage/MultiRingDoughnut/MultiRingDoughnut';
import SquareComponent from '../../../DatabaseHomePage/SquareComponent/SquareComponent';

const DBOverviewProtection = () => {
    return (
        <div className={styles.dbOverviewProtection}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.DB_HOST_PROTECTION}
                </Typography>
                {/* <FlashingDotsLoader /> */}
            </div>

            <div className={styles.mainContainer}>
                <div className={styles.chartContainer}>
                    <MultiRingDoughnut unProtectColor={'var(--chart-disabled)'} />
                </div>

                <div className={styles.protectionSeparator} />

                <div className={styles.textSection}>
                    <SquareComponent value="9 Databases" color="var(--chart-4)" text={'Storage'} />

                    <div className={styles.dbHostSeparator} />

                    <SquareComponent value="1 Databases" color="var(--chart-disabled)" text={'Storage'} />
                </div>
            </div>
        </div>
    );
};

export default DBOverviewProtection;
