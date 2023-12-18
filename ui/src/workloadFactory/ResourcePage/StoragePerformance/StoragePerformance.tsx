import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { ReactComponent as Latency } from '../../../assets/Latency2.svg';
import { ReactComponent as IOPS } from '../../../assets/IOPS.svg';
import { ReactComponent as Throughput } from '../../../assets/Throughput.svg';

import styles from './StoragePerformance.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';

const StoragePerformance = () => {
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    const dataValue = [
        {
            image: <Latency />,
            text: GENERAL.LATENCY,
            read: `${resourceDetails?.performance?.rwMetrics?.latency?.read} ms`,
            write: `${resourceDetails?.performance?.rwMetrics?.latency?.write} ms`,
            separator: true,
            width: '340px'
        },
        {
            image: <IOPS />,
            text: GENERAL.IOPS,
            read: `${resourceDetails?.performance?.rwMetrics?.iops?.read}`,
            write: `${resourceDetails?.performance?.rwMetrics?.iops?.write}`,
            separator: true,
            width: '340px'
        },
        {
            image: <Throughput />,
            text: GENERAL.THROUGHPUT,
            read: `${resourceDetails?.performance?.rwMetrics?.throughput?.read} MBPS`,
            write: `${resourceDetails?.performance?.rwMetrics?.throughput?.write} MBPS`,
            separator: false,
            width: '390px'
        }
    ];
    return (
        <div className={styles.storagePerformance}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.STORAGE_PERFORMANCE}
                </Typography>
            </div>

            <div className={styles.mainSection}>
                {dataValue.length &&
                    dataValue.map((item, index) => (
                        <>
                            <div key={index} className={styles.tileSection} style={{ width: item.width }}>
                                {item.image}
                                <div className={styles.textContent}>
                                    <div className={styles.commonContainer}>
                                        {resourceLoading ? (
                                            <FlashingDotsLoader className={styles.loaderHeight} />
                                        ) : (
                                            <div className={styles.valueText}>
                                                <Typography variant="Semibold_14">
                                                    {GENERAL.READ} {item.read}{' '}
                                                </Typography>
                                                <div className={styles.smallSeparator} />
                                                <Typography variant="Semibold_14">
                                                    {GENERAL.WRITE} {item.write}
                                                </Typography>
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
