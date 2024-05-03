import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import styles from './OntapCalculation.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { viewCalculation } from '../../SavingsCalculator/savingsUtil';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { Text } from '../../../../ui-components/Typography';
import { GENERAL } from '../../../../utils/appConstants';

const TableLayout = ({ data }: any) => {
    const styleHandler = (data: any) => {
        if (
            data.label === 'Total monthly cost' ||
            data.label === 'Total snapshot monthly cost' ||
            data.label === 'Amazon Elastic Block Storage (EBS) total cost (monthly)'
        ) {
            return {
                backgroundColor: 'var(--table-header-background)',
                height: 64,
                fontWeight: 490,
                marginBottom: 3,
                marginTop: 14
            };
        } else if (data.label === 'Total storage charge (monthly)') {
            return {
                backgroundColor: 'var(--main-background)',
                height: 64,
                marginBottom: 3
            };
        } else {
            return { backgroundColor: 'var(--main-background)', minHeight: 64, height: 64, marginBottom: 2 };
        }
    };
    return (
        <Grid className={styles['table-column']} style={styleHandler(data)}>
            <GridItem lg="4">
                <Text
                    bold={(!data.value || data.secondaryHeading) && true}
                    style={data.mainHeading ? { fontSize: 16 } : { fontSize: 14 }}
                >
                    {data.label}
                </Text>
            </GridItem>
            <GridItem lg="3">
                <Text>{data.value}</Text>
            </GridItem>
            <GridItem lg="5">
                <Text>{data.text}</Text>
            </GridItem>
        </Grid>
    );
};

const OntapCalculation = () => {
    const viewCalculationData = {
        Ec2InstanceCalculation: {
            instanceType: 'm5.2xlarge',
            instanceHourlyPrice: '0.75',
            ec2MachineCost: '548.96',
            sqlEdition: 'SQL Server Standard edition',
            sqlLicense: 'Yes'
        },
        cloneCalculation: {
            unitConversion: {
                cloneFrequency: 'daily',
                cloneRateChange: '0.1',
                desiredStorageCapacity: '780',
                ssdStorage: '100',
                savingsDeduplication: 0
            },
            priceCalculation: {
                storageSavingsDeduplication: '0',
                effectiveStorageCapacity: '780',
                ssdStorage: '780',
                ssdMonthlyCost: '195',
                totalMonthlyCloneCost: '195'
            }
        },
        FSxNCalculation: {
            storageCapacity: '4,096',
            ebsCapacity: '2',
            volumes: '2',
            ssdStorage: '100',
            deduplication: '0',
            priceCalculation: {
                deduplication: '0',
                storageCapacity: '4,096',
                ssdStorage: '4,096',
                minSSDStorage: '4,096',
                ssdMonthlyCost: '562.95',
                ssdStoragePrice: '0.14',
                totalMonthlyCostStorageCapacity: '562.95',
                deduplicationFactor: '100',
                storageFactor: '0',
                capacityMonthlyCost: '0',
                fsxnCapacityPrice: '0.02',
                capacityPoolStorageCapacity: '16.51',
                totalStorageCharge: '562.95',
                minFileSystem: '0.02',
                throughputCapacity: '0.03',
                maxSSDTierSize: '183,105.47',
                sddIOPS: '0.5',
                fractional: '0.5',
                fileSystems: '1',
                capacityRequired: '128',
                provisionedThroughputCapacity: '128',
                totalMonthlyCostThroughputCapacity: '92.16',
                includedSSDIOPS: '13,511',
                additionalSSDIOPS: '66,489',
                billedSSD: '66,489',
                additionalBilledCost: '1,130.31',
                totalThroughputIOPS: '1,222.47',
                totalMonthlyCost: '1,785.42'
            }
        }
    };
    const setHeader = () => {
        return <DsTypography variant="Regular_14">$1,785.42</DsTypography>;
    };
    return (
        <div className={styles.ontapCalculation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="1"
                title={<div>{GENERAL.MS_ONTAP_CALCULATION}</div>}
            >
                <AccordionCardContent>
                    <DsTypography className={styles.accordionContentSet}>
                        {viewCalculation(viewCalculationData).Ec2InstanceCalculation.map(
                            (data: { label: string; text?: string; value?: string }, index: number) => (
                                <TableLayout key={index} data={data} />
                            )
                        )}
                        <div style={{ marginTop: '16px' }}>
                            {viewCalculation(viewCalculationData).FSxNCalculation.map(
                                (data: { label: string; text?: string; value?: string }, index: number) => (
                                    <TableLayout key={index} data={data} />
                                )
                            )}
                        </div>
                        <div style={{ marginTop: '16px' }}>
                            {viewCalculation(viewCalculationData).cloneCalculation.map(
                                (data: { label: string; text?: string; value?: string }, index: number) => (
                                    <TableLayout key={index} data={data} />
                                )
                            )}
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default OntapCalculation;
