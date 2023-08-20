import { DoughnutChart, Typography } from '@netapp/design-system';
import { getCssVariableValue } from '../../../../utils/utilityFunctions';
import styles from './ResourceDistribution.module.scss';

type ResourceData = {
    resourceName: string;
    percentage: number;
    dataToShowValue: string;
    dataToShowUnit: string;
    dataLabel: string;
    color: string;
};

const ResourceDistribution = () => {
    const resourceDistributionData = [
        {
            resourceName: 'CPU',
            percentage: 53,
            dataToShowValue: '53',
            dataToShowUnit: '%',
            dataLabel: 'CPU',
            color: 'blue'
        },
        {
            resourceName: 'Memory',
            percentage: 62,
            dataToShowValue: '801.2',
            dataToShowUnit: 'TiB',
            dataLabel: 'Memory (Allocated)',
            color: 'green'
        },
        {
            resourceName: 'Storage',
            percentage: 75,
            dataToShowValue: '801.2',
            dataToShowUnit: 'TiB',
            dataLabel: 'Storage (Allocated)',
            color: 'purple'
        }
    ];

    const chartColors = ['--chart-3', '--chart-5', '--chart-9'];

    return (
        <div className={styles.resourceDistributionContainer}>
            <div className={styles.resourceDistributionTitle}>
                <Typography variant="Regular_16" className={styles.titleText}>
                    Resources Distribution
                </Typography>
            </div>
            <div className={styles.doughnutContainer}>
                {resourceDistributionData.map((resource: ResourceData, idx: number) => {
                    const dataObj = {
                        datasets: [
                            {
                                backgroundColor: [
                                    getCssVariableValue(chartColors[idx]),
                                    getCssVariableValue('--scroller')
                                ],
                                data: [resource.percentage, 100 - resource.percentage]
                            }
                        ],
                        labels: []
                    };

                    return (
                        <div className={styles.resourceContainer}>
                            <DoughnutChart data={dataObj} className={styles.doughnutChart}>
                                <div className={styles.doughnutText}>
                                    <div className={styles.doughnutTextValue}>
                                        <Typography className={styles.percentValue} variant="Regular_32">
                                            {resource.percentage}
                                        </Typography>
                                        <Typography className={styles.percentSign} variant="Regular_20">
                                            %
                                        </Typography>
                                    </div>
                                    <div className={styles.doughnutLabel}>
                                        <Typography variant="Regular_14">{resource.resourceName}</Typography>
                                    </div>
                                </div>
                            </DoughnutChart>
                            <div className={styles.resourceData}>
                                <div className={styles.resourceDataValue}>
                                    <Typography variant="Regular_32" className={styles.dataValue}>
                                        {resource.dataToShowValue}
                                    </Typography>
                                    <Typography variant="Regular_14" className={styles.dataUnit}>
                                        {resource.dataToShowUnit}
                                    </Typography>
                                </div>
                                <Typography variant="Semibold_14" className={styles.resourceDataLabel}>
                                    {resource.dataLabel}
                                </Typography>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ResourceDistribution;
