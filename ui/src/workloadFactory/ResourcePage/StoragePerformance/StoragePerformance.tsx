import { Typography } from '@netapp/design-system';
import { ReactComponent as Latency } from '../../../assets/Latency.svg';
import { ReactComponent as IOPS } from '../../../assets/IOPS.svg';
import { ReactComponent as Throughput } from '../../../assets/Throughput.svg';

import styles from './StoragePerformance.module.scss';

const StoragePerformance = () => {
    const dataValue = [
        {
            image: <Latency />,
            text: 'Latency',
            read: '0.05 ms',
            write: '0.7 ms',
            separator: true
        },
        {
            image: <IOPS />,
            text: 'IOPS',
            read: '10k ms',
            write: '12k ms',
            separator: true
        },
        {
            image: <Throughput />,
            text: 'Throughput',
            read: '80 MBPS',
            write: '80 MBPS',
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
                                    <div className={styles.valueText}>
                                        <Typography variant="Semibold_14">Read {item.read} </Typography>
                                        <div className={styles.smallSeparator} />
                                        <Typography variant="Semibold_14">Write {item.write}</Typography>
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
