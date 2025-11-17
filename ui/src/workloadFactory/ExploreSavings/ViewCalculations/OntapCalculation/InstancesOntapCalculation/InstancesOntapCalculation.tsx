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

    const setHeader = (hostCalculation?: any) => {
        if (!viewCalculationsResponse) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        }

        // For bulk calculations, extract the host-specific cost from the calculation data
        if (isBulkCalculation && hostCalculation) {
            // Find the "EC2 machines total cost" entry in this host's calculation data
            const totalCostEntry = hostCalculation.fsxInstanceCalculation?.find(
                (entry: any) => entry.label === 'EC2 machines total cost'
            );
            const hostCost = totalCostEntry?.value || '$0';
            return <DsTypography variant="Regular_14">{hostCost}</DsTypography>;
        }

        // For single host calculations, use the total cost
        return <DsTypography variant="Regular_14">${viewCalculationsResponse?.totalFsxEc2MachineCost}</DsTypography>;
    };

    // Check if bulk data exists - should be array of host objects with hostName property
    const isBulkCalculation =
        Array.isArray(viewCalculationsResponse?.fsxInstanceCalculation) &&
        viewCalculationsResponse?.fsxInstanceCalculation?.length > 0 &&
        viewCalculationsResponse?.fsxInstanceCalculation?.some((item: any) => item?.hostName);

    return (
        <div className={CommonStyles.exploreSavingsCalculation}>
            {isBulkCalculation ? (
                // Render multiple host accordions for bulk calculations using existing data structure
                <>
                    {(viewCalculationsResponse?.fsxInstanceCalculation as any[])?.map(
                        (hostCalculation: any, hostIndex: number) => (
                            <AccordionCard
                                key={`${hostCalculation.hostName}-${hostIndex}`}
                                ValueContent={() => (
                                    <div className={CommonStyles['heading-content']}>{setHeader(hostCalculation)}</div>
                                )}
                                id={`1-${hostCalculation.hostName}-${hostIndex}`}
                                title={
                                    <div>{`${GENERAL.ES_MSSQL_EC2_INSTANCES} ${
                                        hostCalculation.hostName || `Host ${hostIndex + 1}`
                                    }`}</div>
                                }
                                isLoading={viewLoading}
                                isDisabled={!viewCalculationsResponse}
                            >
                                {viewCalculationsResponse && (
                                    <AccordionCardContent>
                                        <DsTypography className={CommonStyles.accordionContentSet}>
                                            {hostCalculation.fsxInstanceCalculation?.map(
                                                (
                                                    data: { label: string; text?: string; value?: string },
                                                    index: number
                                                ) => <TableLayout key={`host-${hostIndex}-item-${index}`} data={data} />
                                            ) || []}
                                        </DsTypography>
                                    </AccordionCardContent>
                                )}
                            </AccordionCard>
                        )
                    )}
                </>
            ) : (
                // Render single host accordion for non-bulk calculations
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
                                )?.Ec2InstanceCalculation?.map(
                                    (data: { label: string; text?: string; value?: string }, index: number) => (
                                        <TableLayout key={index} data={data} />
                                    )
                                ) || []}
                            </DsTypography>
                        </AccordionCardContent>
                    )}
                </AccordionCard>
            )}
        </div>
    );
};

export default InstancesOntapCalculation;
