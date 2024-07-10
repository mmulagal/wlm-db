import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { viewCalculationForEBS } from '../../../SavingsCalculator/savingsUtil';
import { GENERAL } from '../../../../../utils/appConstants';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { TableLayout } from '../../ViewCalculationsUtils';

const ElasticBlockStorageCalculation = () => {
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
        // To DO
        return <DsTypography variant="Regular_14">$XXX</DsTypography>;
    };

    return (
        <div className={CommonStyles.exploreSavingsCalculation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="8"
                title={<div>{'Elastic Block Storage'}</div>}
                isLoading={viewLoading}
                isDisabled={!viewCalculationsResponse}
            >
                {viewCalculationsResponse && (
                    <AccordionCardContent>
                        <DsTypography className={CommonStyles.accordionContentSet}>
                            <DsTypography variant="Semibold_14">GP3 volume type</DsTypography>
                            <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                {viewCalculationForEBS(
                                    viewCalculationsResponse,
                                    selectedDeploymentModel
                                ).gp3VolumeType.map(
                                    (data: { label: string; text?: string; value?: string }, index: number) => (
                                        <TableLayout key={index} data={data} />
                                    )
                                )}
                            </div>

                            <DsTypography variant="Semibold_14">io2 volume type</DsTypography>
                            <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                {viewCalculationForEBS(
                                    viewCalculationsResponse,
                                    selectedDeploymentModel
                                ).io2VolumeType.map(
                                    (data: { label: string; text?: string; value?: string }, index: number) => (
                                        <TableLayout key={index} data={data} />
                                    )
                                )}
                            </div>

                            <DsTypography variant="Semibold_14">io1 volume type</DsTypography>
                            <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                {viewCalculationForEBS(
                                    viewCalculationsResponse,
                                    selectedDeploymentModel
                                ).io1VolumeType.map(
                                    (data: { label: string; text?: string; value?: string }, index: number) => (
                                        <TableLayout key={index} data={data} />
                                    )
                                )}
                            </div>

                            <DsTypography variant="Semibold_14">GP2 volume type</DsTypography>
                            <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                {viewCalculationForEBS(
                                    viewCalculationsResponse,
                                    selectedDeploymentModel
                                ).gp2VolumeType.map(
                                    (data: { label: string; text?: string; value?: string }, index: number) => (
                                        <TableLayout key={index} data={data} />
                                    )
                                )}
                            </div>

                            <DsTypography variant="Semibold_14">St1 volume type</DsTypography>
                            <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                {viewCalculationForEBS(
                                    viewCalculationsResponse,
                                    selectedDeploymentModel
                                ).st1VolumeType.map(
                                    (data: { label: string; text?: string; value?: string }, index: number) => (
                                        <TableLayout key={index} data={data} />
                                    )
                                )}
                            </div>

                            <DsTypography variant="Semibold_14">EBS total cost</DsTypography>
                            <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                {viewCalculationForEBS(
                                    viewCalculationsResponse,
                                    selectedDeploymentModel
                                ).ebsTotalCost.map(
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

export default ElasticBlockStorageCalculation;
