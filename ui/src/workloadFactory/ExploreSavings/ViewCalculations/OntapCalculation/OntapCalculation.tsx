import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import styles from './OntapCalculation.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { viewCalculation } from '../../SavingsCalculator/savingsUtil';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { Text } from '../../../../ui-components/Typography';

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
                height: 88,
                marginBottom: 3
            };
        } else {
            return { backgroundColor: 'var(--main-background)', minHeight: 64, height: 64, marginBottom: 2 };
        }
    };
    return (
        <Grid className={styles['table-column']} style={styleHandler(data)}>
            <GridItem lg="4">
                <Text bold={!data.value && true} style={data.mainHeading ? { fontSize: 16 } : { fontSize: 14 }}>
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
            instanceType: 'c5.2xlarge',
            instanceHourlyPrice: '1.68',
            ec2MachineCost: '1,226.40'
        },
        FSxNCalculation: {
            storageCapacity: '23',
            ebsCapacity: '1000',
            volumes: '120',
            ssdStorage: '60',
            deduplication: '20',
            priceCalculation: {
                deduplication: '35',
                storageCapacity: '25',
                ssdStorage: '30',
                minSSDStorage: '10',
                ssdMonthlyCost: '50',
                totalMonthlyCostStorageCapacity: '100',
                deduplicationFactor: '50',
                storageFactor: '35',
                capacityMonthlyCost: '100',
                capacityPoolStorageCapacity: '100',
                totalStorageCharge: '30',
                minFileSystem: '120',
                throughputCapacity: '50',
                sddIOPS: '65',
                fractional: '25',
                fileSystems: '100',
                capacityRequired: '30',
                provisionedThroughputCapacity: '10',
                totalMonthlyCostThroughputCapacity: '40',
                includedSSDIOPS: '35',
                additionalSSDIOPS: '35',
                billedSSD: '700',
                additionalBilledCost: '500',
                totalThroughputIOPS: '780',
                totalMonthlyCost: '5270'
            }
        }
    };
    const setHeader = () => {
        return <DsTypography variant="Regular_14">$5,270</DsTypography>;
    };
    return (
        <div className={styles.ontapCalculation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="1"
                title={<div>Microsoft SQL server on FSx for ONTAP calculation</div>}
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
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default OntapCalculation;
