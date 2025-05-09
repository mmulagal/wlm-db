import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import DoughnutChartComponent from '../../Doughnut/DoughnutChartComponent';
import styles from './CapacityUtilization.module.scss';
import _ from 'lodash';
import { useAppSelector } from '../../../../../store/storeHooks';

const CapacityUtilization = () => {
    const loading = false; // Replace with actual loading state
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);

    function bytesToTB(bytes: number) {
        const TB = bytes / Math.pow(1024, 4);
        return TB;
    }
    return (
        <div className={styles.capacityUtilization}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Capacity utilization
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
                            colors={['#A815F3', '#DE9EFF']}
                            includeTotalRing
                            totalRingColor={'chart-10'}
                        />
                    )}

                    {resourceLoading && (
                        <div style={{ position: 'relative' }}>
                            <div className={styles['center-text']}>
                                <DsFlashingDotsLoader />
                            </div>
                            <div className={styles.emptyCircle}></div>
                        </div>
                    )}
                </div>

                <div className={styles.rightSide}>
                    <DsTypography variant="Semibold_14" style={{ marginBottom: '16px' }}>
                        SSD capacity
                    </DsTypography>
                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div className={styles.square} style={{ backgroundColor: '#A815F3' }} />
                            <DsTypography variant="Regular_14" className={styles.days}>
                                {'Used'}
                            </DsTypography>
                        </div>

                        <div className={styles.count}>
                            {!resourceLoading && (
                                <>
                                    <DsTypography variant="Semibold_14">
                                        {bytesToTB(resourceDetails?.storage?.fsxn?.used ?? 0)} TiB
                                    </DsTypography>
                                </>
                            )}

                            {resourceLoading && <DsFlashingDotsLoader />}
                        </div>
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div className={styles.square} style={{ backgroundColor: '#DE9EFF' }} />
                            <DsTypography variant="Regular_14" className={styles.days}>
                                {'Available'}
                            </DsTypography>
                        </div>

                        <div className={styles.count}>
                            {!resourceLoading && (
                                <>
                                    <DsTypography variant="Semibold_14">
                                        {bytesToTB(
                                            (resourceDetails?.storage?.fsxn?.size ?? 0) -
                                                (resourceDetails?.storage?.fsxn?.used ?? 0)
                                        )}{' '}
                                        TiB
                                    </DsTypography>
                                </>
                            )}

                            {resourceLoading && <DsFlashingDotsLoader />}
                        </div>
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div className={styles.square} style={{ backgroundColor: '#550057' }} />
                            <DsTypography variant="Regular_14" className={styles.days}>
                                {'Size (allocated)'}
                            </DsTypography>
                        </div>

                        <div className={styles.count}>
                            {!resourceLoading && (
                                <>
                                    <DsTypography variant="Semibold_14">
                                        {bytesToTB(resourceDetails?.storage?.fsxn?.size ?? 0)} TiB
                                    </DsTypography>
                                </>
                            )}

                            {resourceLoading && <DsFlashingDotsLoader />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CapacityUtilization;
