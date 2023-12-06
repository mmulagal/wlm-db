import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { ReactComponent as Latency } from '../../../assets/Latency.svg';
import { ReactComponent as IOPS } from '../../../assets/IOPS.svg';
import { ReactComponent as Throughput } from '../../../assets/Throughput.svg';

import styles from './StoragePerformance.module.scss';
import { useAppSelector } from '../../../store/storeHooks';

const StoragePerformance = () => {
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    const dataValue = [
        {
            image: <Latency />,
            text: 'Latency',
            read: `${resourceDetails?.performance?.latency?.read} ms`,
            write: `${resourceDetails?.performance?.latency?.write} ms`,
            separator: true
        },
        {
            image: <IOPS />,
            text: 'IOPS',
            read: `${resourceDetails?.performance?.iops?.read} ms`,
            write: `${resourceDetails?.performance?.iops?.write} ms`,
            separator: true
        },
        {
            image: <Throughput />,
            text: 'Throughput',
            read: `${resourceDetails?.performance?.throughput?.read} MBPS`,
            write: `${resourceDetails?.performance?.throughput?.write} MBPS`,
            separator: false
        }
    ];
    return (
        <div className={styles.storagePerformance}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    Storage performance
                </Typography>
            </div>

            <div className={styles.mainSection}>
                {dataValue.length &&
                    dataValue.map((item, index) => (
                        <>
                            <div key={index} className={styles.tileSection}>
                                {item.image}
                                <div className={styles.textContent}>
                                    <div className={styles.commonContainer}>
                                        {resourceLoading ? (
                                            <FlashingDotsLoader className={styles.loaderHeight} />
                                        ) : (
                                            <div className={styles.valueText}>
                                                <Typography variant="Semibold_14">Read {item.read} </Typography>
                                                <div className={styles.smallSeparator} />
                                                <Typography variant="Semibold_14">Write {item.write}</Typography>
                                            </div>
                                        )}
                                    </div>

                                    <Typography variant="Regular_14">{item.text}</Typography>
                                </div>
                            </div>

                            {item.separator && <div className={styles.dbHostSeparator} />}
                        </>
                    ))}
            </div>
        </div>
    );
};

export default StoragePerformance;
