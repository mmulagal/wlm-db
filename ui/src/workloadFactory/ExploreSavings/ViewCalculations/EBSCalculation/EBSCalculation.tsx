import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import styles from './EBSCalculation.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { Text } from '../../../../ui-components/Typography';
import { viewCalculationForEBS } from '../../SavingsCalculator/savingsUtil';
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

const EBSCalculation = () => {
    const viewCalculationData = {
        Ec2InstanceCalculation: {
            instanceType: 'm5.2xlarge',
            instanceHourlyPrice: '0.752',
            ec2MachineCost: '548.96',
            sqlEdition: 'SQL Server Standard edition',
            sqlLicense: 'Yes'
        },
        cloneCalculation: {
            numberOfClonedCopies: 1,
            cloneCost: '5,134'
        },
        EBSCalculation: {
            storageCapacity: '2,048',

            priceCalculation: {
                totalInstanceHour: '1460',
                eachInstanceHour: '730',
                instanceMonth: '2',
                ebsStorageCost: '562.95',
                ebsCapacityPrice: '0.14',
                billableIOPS: '40,000',
                totalBillableIOPS: '40,000',
                ebsIOPSCost: '4,888',
                billableMbps: '0',
                billableThroughputMbps: '0',
                billableThroughputGbps: '0',
                ebsThroughCost: '0',
                totalSnapshots: '30',
                initialSnapshotCost: '112.59',
                monthlyCostOFEachSnapshot: '0.7',
                discountForPartialStorage: '0.35',
                incrementSnapshotCost: '10.47',
                totalSnapshotCost: '123.06',
                totalEBSSnapshotCost: '246.12',
                ebsSnapshotCost: '246.12',
                amazonElasticBlock: '5,697.07'
            }
        }
    };
    const setHeader = () => {
        return <DsTypography variant="Regular_14">$5,697.07</DsTypography>;
    };
    return (
        <div className={styles.ebsCalculation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="2"
                title={<div>{GENERAL.MS_EBS_CALCULATION}</div>}
            >
                <AccordionCardContent>
                    <DsTypography className={styles.accordionContentSet}>
                        {viewCalculationForEBS(viewCalculationData).Ec2InstanceCalculation.map(
                            (data: { label: string; text?: string; value?: string }, index: number) => (
                                <TableLayout key={index} data={data} />
                            )
                        )}
                        <div style={{ marginTop: '16px' }}>
                            {viewCalculationForEBS(viewCalculationData).EBSCalculation.map(
                                (data: { label: string; text?: string; value?: string }, index: number) => (
                                    <TableLayout key={index} data={data} />
                                )
                            )}
                        </div>

                        <div style={{ marginTop: '16px' }}>
                            {viewCalculationForEBS(viewCalculationData).cloneCalculation.map(
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

export default EBSCalculation;
