import { DsTypography } from '@netapp/design-system';
import styles from './StoragePerformance.module.scss';
import StoragePerfInput from './StoragePerfInput/StoragePerfInput';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';
// import ComputeInputComponent from './StoragePerformance.moodule.scss';

const StoragePerformance = () => {
    const { selectedOnPremHostDetails }: any = useAppSelector(state => state.exploreSavings);

    const [primaryData, setPrimaryData] = useState<any>(null);
    const [secondaryData, setSecondaryData] = useState<any>(null);

    useEffect(() => {
        let primaryData = {
            totalStorage: selectedOnPremHostDetails?.totalPrimaryHostStorage,
            totalIops: 0,
            totalThroughput: 0
        };
        let secondaryData = {
            totalStorage: selectedOnPremHostDetails?.totalSecondaryHostStorage,
            totalIops: 0,
            totalThroughput: 0
        };
        let totalData = {
            totalIops: 0,
            totalThroughput: 0
        };
        selectedOnPremHostDetails?.sqlServerInstances?.map((instance: any) => {
            totalData.totalIops += Number(instance?.totalIops || 0);
            totalData.totalThroughput += Number(instance?.totalThroughput || 0);
        });

        if (selectedOnPremHostDetails?.deploymentModel === GENERAL.AOAG) {
            secondaryData.totalIops += Number(totalData?.totalIops || 0) / 2;
            secondaryData.totalThroughput += Number(totalData?.totalThroughput || 0) / 2;
            primaryData.totalIops += Number(totalData?.totalIops || 0) / 2;
            primaryData.totalThroughput += Number(totalData?.totalThroughput || 0) / 2;
        } else {
            primaryData.totalIops += Number(totalData?.totalIops || 0);
            primaryData.totalThroughput += Number(totalData?.totalThroughput || 0);
        }

        setPrimaryData(primaryData);
        if (selectedOnPremHostDetails?.deploymentModel === GENERAL.AOAG) {
            setSecondaryData(secondaryData);
        }
    }, [selectedOnPremHostDetails]);

    return (
        <div className={styles.storagePerf}>
            <DsTypography style={{ marginBottom: '8px' }} variant="Regular_14">
                Storage & performance:
            </DsTypography>

            <div className={styles.computeTable}>
                <div className={styles.row1}>
                    <div className={styles.col1}></div>
                    <div className={styles.col2}>
                        <DsTypography variant="Semibold_14">Total Storage amount (GiB)</DsTypography>
                    </div>
                    <div className={styles.col3}>
                        <DsTypography variant="Semibold_14">IOPS</DsTypography>
                    </div>
                    <div className={styles.col4}>
                        <DsTypography variant="Semibold_14">Throughput</DsTypography>
                    </div>
                </div>

                <div className={styles.row1} style={{ marginTop: '-8px' }}>
                    <div className={styles.col1}>
                        <DsTypography variant="Regular_14">Primary</DsTypography>
                    </div>
                    <StoragePerfInput type="primaryData" data={primaryData} />
                </div>

                {/* <div className={styles.row1}>
                    <div className={styles.col1}>
                        <DsTypography variant="Regular_14">Primary - log</DsTypography>
                    </div>
                    <StoragePerfInput type="primaryLog" />
                </div> */}

                {selectedOnPremHostDetails?.deploymentModel === GENERAL.AOAG && (
                    <>
                        <div className={styles.row1}>
                            <div className={styles.col1}>
                                <DsTypography variant="Regular_14">Secondary</DsTypography>
                            </div>
                            <StoragePerfInput type="secondaryData" data={secondaryData} />
                        </div>

                        {/* <div className={styles.row1}>
                            <div className={styles.col1}>
                                <DsTypography variant="Regular_14">Secondary - log</DsTypography>
                            </div>
                            <StoragePerfInput type="secondaryLog" />
                        </div> */}
                    </>
                )}
            </div>
        </div>
    );
};

export default StoragePerformance;
