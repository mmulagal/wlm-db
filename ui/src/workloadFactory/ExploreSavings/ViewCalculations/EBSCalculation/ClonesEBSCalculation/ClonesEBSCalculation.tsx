import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { viewCalculationForEBS } from '../../../SavingsCalculator/savingsUtil';
import { GENERAL } from '../../../../../utils/appConstants';
import { useAppSelector } from '../../../../../store/storeHooks';
import { TableLayout } from '../../ViewCalculationsUtils';

const ClonesEBSCalculation = () => {
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
        return (
            <DsTypography variant="Regular_14">
                ${viewCalculationsResponse?.ebsCloneCalculation?.totalCloneMonthlyCost}
            </DsTypography>
        );
    };

    return (
        <div className={CommonStyles.exploreSavingsCalculation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="10"
                title={<div>{GENERAL.ES_CLONES}</div>}
                isLoading={viewLoading}
                isDisabled={!viewCalculationsResponse}
            >
                {viewCalculationsResponse && (
                    <AccordionCardContent>
                        <DsTypography variant="Regular_14">{GENERAL.ES_CLONES_DESC}</DsTypography>
                        <DsTypography className={CommonStyles.accordionContentSet}>
                            <div style={{ marginTop: '16px' }}>
                                {viewCalculationForEBS(
                                    viewCalculationsResponse,
                                    selectedDeploymentModel
                                )?.cloneCalculation?.map(
                                    (data: { label: string; text?: string; value?: string }, index: number) => (
                                        <TableLayout key={index} data={data} />
                                    )
                                )}
                            </div>
                        </DsTypography>
                    </AccordionCardContent>
                )}
            </AccordionCard>
        </div>
    );
};

export default ClonesEBSCalculation;
