import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import styles from './EBSCalculation.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { Text } from '../../../../ui-components/Typography';
import { viewCalculationForEBS } from '../../SavingsCalculator/savingsUtil';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useState } from 'react';

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
    const viewCalculationsResponse = useAppSelector(state => state.exploreSavings.viewCalculationsResponse);
    const [viewCalculationData, setViewCalculationData] = useState(viewCalculationsResponse?.ebs || {});
    useEffect(() => {
        setViewCalculationData(viewCalculationsResponse?.ebs);
    }, [viewCalculationsResponse]);

    const setHeader = () => {
        return (
            <DsTypography variant="Regular_14">
                ${viewCalculationData?.EBSCalculation?.priceCalculation?.amazonElasticBlock}
            </DsTypography>
        );
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
