import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './CPUUtilizationCard.module.scss';
import LineGraph from '../../LineGraph/LineGraph';
import { twoFractionDigits } from '../../../../../utils/utilityFunctions';

const CPUUtilizationCard = () => {
    const loading = false; // Replace with actual loading state
    const dataPoints = [
        {
            statisticsDate: '2025-04-30T13:39:00.000Z',
            minimum: 17.47384675073975,
            maximum: 38.50929727065043,
            average: 18.484392435538233
        },
        {
            statisticsDate: '2025-05-01T13:39:00.000Z',
            minimum: 17.496171949954505,
            maximum: 40.884437639912704,
            average: 18.441871959922587
        },
        {
            statisticsDate: '2025-05-02T13:39:00.000Z',
            minimum: 17.670293021861497,
            maximum: 41.53953247280423,
            average: 18.558100198458625
        },
        {
            statisticsDate: '2025-05-03T13:39:00.000Z',
            minimum: 4.414497027244251,
            maximum: 44.192036771648304,
            average: 15.758272366751054
        },
        {
            statisticsDate: '2025-05-04T13:39:00.000Z',
            minimum: 4.711367451288831,
            maximum: 52.85999195158978,
            average: 27.14768105864808
        },
        {
            statisticsDate: '2025-05-05T13:39:00.000Z',
            minimum: 17.411063617171138,
            maximum: 36.50868759202796,
            average: 18.34663756804051
        },
        {
            statisticsDate: '2025-05-06T13:39:00.000Z',
            minimum: 17.40436679375935,
            maximum: 39.43113760205983,
            average: 18.30180501021396
        },
        {
            statisticsDate: '2025-05-07T13:39:00.000Z',
            minimum: 17.282229602613747,
            maximum: 43.88296585657041,
            average: 18.304635457459938
        }
    ];

    return (
        <div className={styles.cpuUtilization}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    CPU utilization
                </DsTypography>

                <div className={styles.rightTopValue}>
                    <DsTypography variant="Semibold_20" style={{ lineHeight: 'unset' }}>
                        45%
                    </DsTypography>
                    {loading && <DsFlashingDotsLoader />}
                </div>
            </div>

            <div className={styles.mainSection}>
                <LineGraph
                    data={dataPoints.map(datapoint => Number((datapoint.average || 0).toFixed(1)))}
                    categories={dataPoints.map(datapoint => {
                        const date = new Date(datapoint.statisticsDate);
                        return `${date.getDate()}/${date.getMonth() + 1}`;
                    })}
                    yTickFormatter={twoFractionDigits}
                />
            </div>
        </div>
    );
};

export default CPUUtilizationCard;
