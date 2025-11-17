import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { viewCalculationForEBS } from '../../../SavingsCalculator/savingsUtil';
import { GENERAL } from '../../../../../utils/appConstants';
import { useAppSelector } from '../../../../../store/storeHooks';
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
        return <DsTypography variant="Regular_14">${viewCalculationsResponse?.ebsOnlyCost}</DsTypography>;
    };

    return (
        <div className={CommonStyles.exploreSavingsCalculation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="8"
                title={<div>{GENERAL.ES_EBS}</div>}
                isLoading={viewLoading}
                isDisabled={!viewCalculationsResponse}
            >
                {viewCalculationsResponse && (
                    <AccordionCardContent>
                        <DsTypography variant="Regular_14" style={{ marginBottom: '40px' }}>
                            {GENERAL.ES_EBS_DESC}
                        </DsTypography>
                        <DsTypography className={CommonStyles.accordionContentSet}>
                            {viewCalculationsResponse?.ebsCalculation?.gp3 && (
                                <>
                                    <DsTypography variant="Semibold_14">{GENERAL.ES_GP3_VOLUME_TYPE}</DsTypography>
                                    <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                        {viewCalculationForEBS(
                                            viewCalculationsResponse,
                                            selectedDeploymentModel
                                        )?.gp3VolumeType?.map(
                                            (data: { label: string; text?: string; value?: string }, index: number) => (
                                                <TableLayout key={index} data={data} />
                                            )
                                        )}
                                    </div>
                                </>
                            )}
                            {viewCalculationsResponse?.ebsCalculation?.io2 && (
                                <>
                                    <DsTypography variant="Semibold_14">{GENERAL.ES_IO2_VOLUME_TYPE}</DsTypography>
                                    <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                        {viewCalculationForEBS(
                                            viewCalculationsResponse,
                                            selectedDeploymentModel
                                        )?.io2VolumeType?.map(
                                            (data: { label: string; text?: string; value?: string }, index: number) => (
                                                <TableLayout key={index} data={data} />
                                            )
                                        )}
                                    </div>
                                </>
                            )}
                            {viewCalculationsResponse?.ebsCalculation?.io1 && (
                                <>
                                    <DsTypography variant="Semibold_14">{GENERAL.ES_IO1_VOLUME_TYPE}</DsTypography>
                                    <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                        {viewCalculationForEBS(
                                            viewCalculationsResponse,
                                            selectedDeploymentModel
                                        )?.io1VolumeType?.map(
                                            (data: { label: string; text?: string; value?: string }, index: number) => (
                                                <TableLayout key={index} data={data} />
                                            )
                                        )}
                                    </div>
                                </>
                            )}
                            {viewCalculationsResponse?.ebsCalculation?.gp2 && (
                                <>
                                    <DsTypography variant="Semibold_14">{GENERAL.ES_GP2_VOLUME_TYPE}</DsTypography>
                                    <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                        {viewCalculationForEBS(
                                            viewCalculationsResponse,
                                            selectedDeploymentModel
                                        )?.gp2VolumeType?.map(
                                            (data: { label: string; text?: string; value?: string }, index: number) => (
                                                <TableLayout key={index} data={data} />
                                            )
                                        )}
                                    </div>
                                </>
                            )}
                            {viewCalculationsResponse?.ebsCalculation?.st1 && (
                                <>
                                    <DsTypography variant="Semibold_14">{GENERAL.ES_ST1_VOLUME_TYPE}</DsTypography>
                                    <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                        {viewCalculationForEBS(
                                            viewCalculationsResponse,
                                            selectedDeploymentModel
                                        )?.st1VolumeType?.map(
                                            (data: { label: string; text?: string; value?: string }, index: number) => (
                                                <TableLayout key={index} data={data} />
                                            )
                                        )}
                                    </div>
                                </>
                            )}

                            <DsTypography variant="Semibold_14">{GENERAL.ES_EBS_TOTAL_COST}</DsTypography>
                            <div style={{ marginTop: '16px', marginBottom: '32px' }}>
                                {viewCalculationForEBS(
                                    viewCalculationsResponse,
                                    selectedDeploymentModel
                                )?.ebsTotalCost?.map(
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
