import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './LatencyCard.module.scss';
import SeparatorComponent from '../../../../../common/SeparatorComponent/SeparatorComponent';
import LineGraph from '../../LineGraph/LineGraph';

const LatencyCard = () => {
    const loading = false; // Replace with actual loading state
    const datasets = [
        [89.3, 50, 80, 68, 92, 48, 74, 54],
        [10, 20, 10, 40, 15, 16, 1.6, 4.1]
    ];

    const readDataPoints = [
        {
            statisticsDate: '2025-05-01T08:31:16.132Z',
            average: 789.3126781934094
        },
        {
            statisticsDate: '2025-05-02T08:31:16.132Z',
            average: 131.3848757782748
        },
        {
            statisticsDate: '2025-05-03T08:31:16.132Z',
            average: 837.6582723242235
        },
        {
            statisticsDate: '2025-05-04T08:31:16.132Z',
            average: 686.0780704238648
        },
        {
            statisticsDate: '2025-05-05T08:31:16.132Z',
            average: 392.48716331861993
        },
        {
            statisticsDate: '2025-05-06T08:31:16.132Z',
            average: 248.0066763654408
        },
        {
            statisticsDate: '2025-05-07T08:31:16.132Z',
            average: 74.26160337552743
        },
        {
            statisticsDate: '2025-05-08T08:31:16.132Z',
            average: 549.5012413874157
        }
    ];
    return (
        <div className={styles.latencyCard}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Latency
                </DsTypography>

                <div className={styles.rightTopValue}>
                    <DsTypography variant="Regular_20">R: {loading ? <DsFlashingDotsLoader /> : '32 ms'}</DsTypography>

                    <SeparatorComponent variant="vertical" height="20px" />

                    <DsTypography variant="Regular_20">W: {loading ? <DsFlashingDotsLoader /> : '20 ms'}</DsTypography>
                </div>
            </div>

            <div className={styles.mainSection}>
                <LineGraph
                    data={datasets}
                    categories={readDataPoints.map(datapoint => {
                        const date = new Date(datapoint.statisticsDate);
                        return `${date.getDate()}/${date.getMonth() + 1}`;
                    })}
                    legend={['Read', 'Write']}
                    color={['#012CAD', '#0BAFFC']}
                />
            </div>
        </div>
    );
};

export default LatencyCard;
