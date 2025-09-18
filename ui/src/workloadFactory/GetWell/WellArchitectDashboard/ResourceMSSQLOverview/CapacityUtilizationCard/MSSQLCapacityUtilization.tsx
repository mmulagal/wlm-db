import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import _ from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './CapacityUtilization.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { GENERAL } from '../../../../../utils/appConstants';
import { bytesToTB } from '../../../../../utils/utilityFunctions';
import MultiRingDoughnut from '../../../../Oracle/OracleResourcePages/OracleOverview/OracleCapacityUtilization/MultiRingDoughnut/MultiRingDoughnut';

const MSSQLCapacityUtilization = React.memo(() => {
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const color1 = '#5E8DCD';
    const color2 = isDarkTheme ? '#71B9E0' : '#0BAFFC';
    const color3 = isDarkTheme ? '#DE9EFF' : '#A815F3';
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    const data = resourceDetails?.storage?.fsxn;
    const { t } = useTranslation();

    return (
        <div className={styles.capacityUtilization}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {GENERAL.CAPACITY_UTILIZATION}
                </DsTypography>
            </div>

            <div className={styles.mainSection}>
                <div className={styles.chartSection}>
                    {!resourceLoading && (
                        <MultiRingDoughnut
                            resourceDetails={resourceDetails}
                            resourceLoading={resourceLoading}
                            resourceType="mssql"
                        />
                    )}

                    {resourceLoading && (
                        <div style={{ position: 'relative' }}>
                            <div className={styles['center-text']}>
                                <DsFlashingDotsLoader />
                            </div>
                            <div className={styles.emptyCircle} />
                        </div>
                    )}
                </div>

                <div className={styles.rightSide}>
                    <DsTypography variant="Semibold_14" style={{ marginBottom: '16px' }}>
                        {t('databases.resource-overview.capacity')}
                    </DsTypography>
                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div className={styles.square} style={{ backgroundColor: color1 }} />
                            <DsTypography variant="Regular_14" className={styles.days}>
                                {t('databases.oracle-inner-page.written-data-size')}
                            </DsTypography>
                        </div>

                        <div className={styles.count}>
                            {!resourceLoading && (
                                <DsTypography variant="Semibold_14">
                                    {bytesToTB(resourceDetails?.storage?.fsxn?.used ?? 0)}{' '}
                                    {t('databases.resource-overview.tib')}
                                </DsTypography>
                            )}

                            {resourceLoading && <DsFlashingDotsLoader />}
                        </div>
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div className={styles.square} style={{ backgroundColor: color2 }} />
                            <DsTypography variant="Regular_14" className={styles.days}>
                                {t('databases.oracle-inner-page.used-ssd')}
                            </DsTypography>
                        </div>

                        <div className={styles.count}>
                            {!resourceLoading && (
                                <DsTypography variant="Semibold_14">
                                    {bytesToTB(resourceDetails?.storage?.fsxn?.ssdUsed ?? 0)}{' '}
                                    {t('databases.resource-overview.tib')}
                                </DsTypography>
                            )}

                            {resourceLoading && <DsFlashingDotsLoader />}
                        </div>
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div className={styles.square} style={{ backgroundColor: color3 }} />
                            <DsTypography variant="Regular_14" className={styles.days}>
                                {t('databases.oracle-inner-page.used-capacity-pool')}
                            </DsTypography>
                        </div>

                        <div className={styles.count}>
                            {!resourceLoading && (
                                <DsTypography variant="Semibold_14">
                                    {bytesToTB(data?.capacityPoolUsed ?? 0)} {t('databases.resource-overview.tib')}
                                </DsTypography>
                            )}

                            {resourceLoading && <DsFlashingDotsLoader />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default MSSQLCapacityUtilization;
