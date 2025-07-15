import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import _ from 'lodash';
import DoughnutChartComponent from '../../Doughnut/DoughnutChartComponent';
import styles from './CapacityUtilization.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { GENERAL } from '../../../../../utils/appConstants';
import React from 'react';

const CapacityUtilization = React.memo(() => {
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const color1 = isDarkTheme ? '#DE9EFF' : '#A815F3';
    const color2 = isDarkTheme ? '#A855B8' : '#DE9EFF';
    const color3 = isDarkTheme ? '#CBD4DA' : '#550057';
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);

    function bytesToTB(bytes: number) {
        const TB = bytes / 1024 ** 4;
        return TB;
    }
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
                        <DoughnutChartComponent
                            label="Used capacity"
                            valueFormatter={() => ({
                                value: _.toNumber(
                                    (
                                        (bytesToTB(resourceDetails?.storage?.fsxn?.used ?? 0) /
                                            bytesToTB(resourceDetails?.storage?.fsxn?.size ?? 0)) *
                                        100
                                    ).toFixed(2)
                                ).toString(),
                                unit: '%'
                            })}
                            data={[
                                bytesToTB(resourceDetails?.storage?.fsxn?.used ?? 0),
                                bytesToTB(resourceDetails?.storage?.fsxn?.size ?? 0) -
                                    bytesToTB(resourceDetails?.storage?.fsxn?.used ?? 0)
                            ]}
                            colors={[color1, color2]}
                            includeTotalRing
                            totalRingColor="chart-10"
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
                        SSD capacity
                    </DsTypography>
                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div className={styles.square} style={{ backgroundColor: color1 }} />
                            <DsTypography variant="Regular_14" className={styles.days}>
                                Used
                            </DsTypography>
                        </div>

                        <div className={styles.count}>
                            {!resourceLoading && (
                                <DsTypography variant="Semibold_14">
                                    {bytesToTB(resourceDetails?.storage?.fsxn?.used ?? 0).toFixed(2)} TiB
                                </DsTypography>
                            )}

                            {resourceLoading && <DsFlashingDotsLoader />}
                        </div>
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div className={styles.square} style={{ backgroundColor: color2 }} />
                            <DsTypography variant="Regular_14" className={styles.days}>
                                Available
                            </DsTypography>
                        </div>

                        <div className={styles.count}>
                            {!resourceLoading && (
                                <DsTypography variant="Semibold_14">
                                    {bytesToTB(
                                        (resourceDetails?.storage?.fsxn?.size ?? 0) -
                                            (resourceDetails?.storage?.fsxn?.used ?? 0)
                                    ).toFixed(2)}{' '}
                                    TiB
                                </DsTypography>
                            )}

                            {resourceLoading && <DsFlashingDotsLoader />}
                        </div>
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div className={styles.square} style={{ backgroundColor: color3 }} />
                            <DsTypography variant="Regular_14" className={styles.days}>
                                Size (allocated)
                            </DsTypography>
                        </div>

                        <div className={styles.count}>
                            {!resourceLoading && (
                                <DsTypography variant="Semibold_14">
                                    {bytesToTB(resourceDetails?.storage?.fsxn?.size ?? 0).toFixed(2)} TiB
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

export default CapacityUtilization;
