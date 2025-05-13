import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './IOPSCard.module.scss';
import SeparatorComponent from '../../../../../common/SeparatorComponent/SeparatorComponent';
import LineGraph from '../../LineGraph/LineGraph';

const IOPSCard = () => {
    const loading = false; // Replace with actual loading state

    const datasets = [
        [789.3, 131.4, 837.7, 686.1, 392.5, 248, 74.3, 549.5],
        [8170.5, 947.3, 952.9, 1472.5, 12547, 737.3, 8691.6, 704.1]
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
        <div className={styles.iops}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    IOPS
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

export default IOPSCard;
