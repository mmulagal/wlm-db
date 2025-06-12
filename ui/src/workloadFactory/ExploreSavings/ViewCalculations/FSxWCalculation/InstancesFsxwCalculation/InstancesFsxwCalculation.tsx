import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { viewCalculationForFsxw } from '../../../SavingsCalculator/savingsUtil';
import { GENERAL } from '../../../../../utils/appConstants';
import { useAppSelector } from '../../../../../store/storeHooks';
import { TableLayout } from '../../ViewCalculationsUtils';

const InstancesFsxwCalculation = () => {
    const { viewCalculationsResponse, selectedDeploymentModel, viewCalculationsLoading, selectedHostDetails } =
        useAppSelector(state => state.exploreSavings);
    const [viewLoading, setViewLoading] = useState(false);

    useEffect(() => {
        setViewLoading(selectedHostDetails?.loading || viewCalculationsLoading);
    }, [selectedHostDetails, viewCalculationsLoading]);

    const setHeader = () => {
        if (!viewCalculationsResponse) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        }
        return <DsTypography variant="Regular_14">${viewCalculationsResponse?.totalFsxwEc2MachineCost}</DsTypography>;
    };
    return (
        <div className={CommonStyles.exploreSavingsCalculation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="12"
                title={<div>{GENERAL.ES_MSSQL_EC2_INSTANCES}</div>}
                isLoading={viewLoading}
                isDisabled={!viewCalculationsResponse}
            >
                {viewCalculationsResponse && (
                    <AccordionCardContent>
                        <DsTypography className={CommonStyles.accordionContentSet}>
                            {viewCalculationForFsxw(
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

export default InstancesFsxwCalculation;
