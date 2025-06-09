import { DsTypography, FlashingDotsLoader, Typography } from '@netapp/design-system';
import { useMemo } from 'react';
import styles from './DBOverviewProtection.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import MultiRingDoughnut from '../../../DatabaseHomePage/MultiRingDoughnut/MultiRingDoughnut';
import SquareComponent from '../../../DatabaseHomePage/SquareComponent/SquareComponent';
import { useAppSelector } from '../../../../store/storeHooks';
import { getAggrProtection } from '../../../../utils/utilityFunctions';
import useResize from '../../../../common/hooks/useResize';

const DBOverviewProtection = () => {
    const { databaseList, databaseListLoading } = useAppSelector(state => state.workloadFactoryResource);
    const windowSize = useResize();

    const protectionData = useMemo(() => getAggrProtection(databaseList), [databaseList]);

    return (
        <>
            {windowSize.width > 1800 && (
                <div className={styles.dbOverviewProtection}>
                    <div className={styles.headSection}>
                        <Typography variant="Regular_16" className={styles.title}>
                            {GENERAL.DB_HOST_PROTECTION}
                        </Typography>
                        {databaseListLoading && <FlashingDotsLoader />}
                    </div>

                    <div className={styles.mainContainer}>
                        <div className={styles.chartContainer}>
                            <MultiRingDoughnut unProtectColor="var(--chart-disabled)" hostData={protectionData} />
                        </div>

                        <div className={styles.protectionSeparator} />

                        <div className={styles.textSection}>
                            <SquareComponent
                                value={`${protectionData.protectedDb} Databases`}
                                color="var(--chart-4)"
                                text="Protected"
                                boldValue
                            />

                            <div className={styles.dbHostSeparator} />

                            <SquareComponent
                                value={`${protectionData.unprotectedDb} Databases`}
                                color="var(--chart-disabled)"
                                text="Unprotected"
                                boldValue
                            />
                        </div>
                    </div>
                </div>
            )}

            {windowSize.width <= 1800 && (
                <div className={styles.dbOverviewProtectionSmallScreen}>
                    <div className={styles.headSection}>
                        <Typography variant="Regular_16" className={styles.title}>
                            {GENERAL.DB_HOST_PROTECTION}
                        </Typography>
                        {databaseListLoading && <FlashingDotsLoader />}
                    </div>

                    <div className={styles.mainContainer}>
                        <div className={styles.chartContainer}>
                            <MultiRingDoughnut unProtectColor="var(--chart-disabled)" hostData={protectionData} />
                        </div>

                        <div className={styles.textAreaSection}>
                            <DsTypography variant="Semibold_14">Protection distribution</DsTypography>
                            <div className={styles.protectionSeparator} />

                            <div className={styles.textSection}>
                                <SquareComponent
                                    value={`${protectionData.protectedDb} Databases`}
                                    color="var(--chart-4)"
                                    text="Protected"
                                    boldValue
                                />

                                <div className={styles.dbHostSeparator} />

                                <SquareComponent
                                    value={`${protectionData.unprotectedDb} Databases`}
                                    color="var(--chart-disabled)"
                                    text="Unprotected"
                                    boldValue
                                />
                            </div>

                            <div className={styles.protectionSeparator} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DBOverviewProtection;
