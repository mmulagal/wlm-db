import { DoughnutChart, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import { getCssVariableValue } from '../../../../utils/utilityFunctions';
import styles from './ResourceDistribution.module.scss';
import { isNotNumberOrNA, formatSizeSplit, displayFormattedValue } from '../../../../utils/utilityFunctions';

type Utilisation = {
    percentUsed: string;
    used: string;
    total: string;
    remaining: string;
};

type ResourceDistributionProps = {
    mssqlCpu: Utilisation;
    mssqlMemory: Utilisation;
    mssqlDisk: Utilisation;
};

type ResourceData = {
    resourceName: string;
    percentage: string;
    dataToShowValue: string;
    dataToShowUnit: string;
    dataLabel: string;
};

const ResourceDistribution = ({ mssqlCpu, mssqlMemory, mssqlDisk }: ResourceDistributionProps) => {
    const cpuMsgCheck = isNotNumberOrNA(mssqlCpu?.percentUsed);
    const memoryMsgCheck = isNotNumberOrNA(mssqlMemory?.percentUsed);
    const diskMsgCheck = isNotNumberOrNA(mssqlDisk?.percentUsed);

    const totalMemory = formatSizeSplit(mssqlMemory?.total);
    const totalSize = formatSizeSplit(mssqlDisk?.total);

    const cpuUsedValue = !cpuMsgCheck && mssqlCpu?.percentUsed !== GENERAL.NOT_AVAILABLE && mssqlCpu?.percentUsed;
    const cpuUsedFormat =
        mssqlCpu?.percentUsed && !cpuMsgCheck && mssqlCpu?.percentUsed !== GENERAL.NOT_AVAILABLE ? '%' : '';
    const cpuUsedTooltip =
        (mssqlCpu?.percentUsed && `${mssqlCpu.percentUsed}% ${GENERAL.MS_SQL_CPU_USED}`) || GENERAL.NOT_AVAILABLE;
    const cpuRemTooltip =
        mssqlCpu?.percentUsed && !cpuMsgCheck
            ? `${100 - parseInt(mssqlCpu?.percentUsed)}%  ${GENERAL.CPU_REM}`
            : GENERAL.NOT_AVAILABLE;
    const memoryUsedValue =
        (!memoryMsgCheck && mssqlMemory?.percentUsed !== GENERAL.NOT_AVAILABLE && mssqlMemory?.percentUsed) || 0;
    const memoryUsedTooltip =
        mssqlMemory?.used && !memoryMsgCheck
            ? displayFormattedValue(parseInt(mssqlMemory?.used), GENERAL.MS_SQL_MEMORY_USED)
            : GENERAL.NOT_AVAILABLE;
    const memoryRemTooltip =
        mssqlMemory?.remaining && !memoryMsgCheck
            ? displayFormattedValue(parseInt(mssqlMemory?.remaining), GENERAL.MEMORY_REM)
            : GENERAL.NOT_AVAILABLE;
    const diskUsedValue =
        (!diskMsgCheck && mssqlDisk?.percentUsed !== GENERAL.NOT_AVAILABLE && mssqlDisk?.percentUsed) || 0;
    const diskUsedTooltip =
        mssqlDisk?.used && !diskMsgCheck
            ? displayFormattedValue(parseInt(mssqlDisk?.used), GENERAL.MS_SQL_DISK_USED)
            : GENERAL.NOT_AVAILABLE;
    const diskRemTooltip =
        mssqlDisk?.remaining && !diskMsgCheck
            ? displayFormattedValue(parseInt(mssqlDisk?.remaining), GENERAL.DISK_REM)
            : GENERAL.NOT_AVAILABLE;

    const cpuInfoMsg = cpuMsgCheck && mssqlCpu.percentUsed;
    const memoryInfoMsg = memoryMsgCheck && mssqlMemory.percentUsed;
    const diskInfoMsg = diskMsgCheck && mssqlDisk.percentUsed;

    const resourceDistributionData = [
        {
            resourceName: 'CPU',
            percentage: cpuUsedValue,
            dataToShowValue: cpuUsedValue,
            dataToShowUnit: '%',
            dataLabel: 'CPU',
            usedTooltip: cpuUsedTooltip,
            remTooltip: cpuRemTooltip
        },
        {
            resourceName: 'Memory',
            percentage: memoryUsedValue,
            dataToShowValue: totalMemory.value,
            dataToShowUnit: totalMemory.format,
            dataLabel: 'Memory (Allocated)',
            usedTooltip: memoryUsedTooltip,
            remTooltip: memoryRemTooltip
        },
        {
            resourceName: 'Storage',
            percentage: diskUsedValue,
            dataToShowValue: totalSize.value,
            dataToShowUnit: totalSize.format,
            dataLabel: 'Storage (Allocated)',
            usedTooltip: diskUsedTooltip,
            remTooltip: diskRemTooltip
        }
    ];

    const chartColors = ['--chart-3', '--chart-5', '--chart-9'];

    return (
        <div className={styles.resourceDistributionContainer}>
            <div className={styles.resourceDistributionTitle}>
                <Typography variant="Regular_16" className={styles.titleText}>
                    {GENERAL.RESOURCE_DISTRIBUTION}
                </Typography>
            </div>
            <div className={styles.doughnutContainer}>
                {resourceDistributionData.map((resource: any, idx: number) => {
                    const dataObj = {
                        datasets: [
                            {
                                backgroundColor: [
                                    getCssVariableValue(chartColors[idx]),
                                    getCssVariableValue('--scroller')
                                ],
                                data: [resource.percentage, 100 - parseInt(resource.percentage)]
                            }
                        ],
                        labels: []
                    };

                    const tooltipList = [resource.usedTooltip, resource.remTooltip];

                    const optionsObj = {
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: (item: any) => {
                                        return `${tooltipList[item.dataIndex]}`;
                                    }
                                }
                            }
                        }
                    };

                    return (
                        <div className={styles.resourceContainer}>
                            <DoughnutChart data={dataObj} className={styles.doughnutChart} options={optionsObj}>
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
