import { AccordionCard, AccordionCardContent, DsTypography, useAccordionContext } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { viewCalculation } from '../../../SavingsCalculator/savingsUtil';
import { GENERAL } from '../../../../../utils/appConstants';
import { useAppSelector } from '../../../../../store/storeHooks';
import { TableLayout } from '../../ViewCalculationsUtils';

const InstancesOntapCalculation = () => {
    const { viewCalculationsResponse, selectedDeploymentModel, viewCalculationsLoading, selectedHostDetails } =
        useAppSelector(state => state.exploreSavings);
    const [viewLoading, setViewLoading] = useState(false);

    useEffect(() => {
        setViewLoading(selectedHostDetails?.loading || viewCalculationsLoading);
    }, [selectedHostDetails, viewCalculationsLoading]);

    const accordionContext = useAccordionContext()?.setOpenChildren!;
    useEffect(() => {
        if (viewLoading) {
            accordionContext({
                1: false,
                2: false,
                3: false,
                4: false,
                5: false,
                6: false,
                7: false,
                8: false,
                9: false,
                10: false,
                11: false
            });
        } else if (viewCalculationsResponse) {
            accordionContext({
                1: true
            });
        }
    }, [viewLoading]);

    const setHeader = () => {
        if (!viewCalculationsResponse) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        }
        return <DsTypography variant="Regular_14">${viewCalculationsResponse?.totalFsxEc2MachineCost}</DsTypography>;
    };
    return (
        <div className={CommonStyles.exploreSavingsCalculation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="1"
                title={<div>{GENERAL.ES_MSSQL_EC2_INSTANCES}</div>}
                isLoading={viewLoading}
                isDisabled={!viewCalculationsResponse}
            >
                {viewCalculationsResponse && (
                    <AccordionCardContent>
                        <DsTypography className={CommonStyles.accordionContentSet}>
                            {viewCalculation(
                                viewCalculationsResponse,
                                selectedDeploymentModel
                            ).Ec2InstanceCalculation.map(
                                (data: { label: string; text?: string; value?: string }, index: number) => (
                                    <TableLayout key={index} data={data} />
                                )
                            )}
                        </DsTypography>
                    </AccordionCardContent>
                )}
            </AccordionCard>
        </div>
    );
};

export default InstancesOntapCalculation;
