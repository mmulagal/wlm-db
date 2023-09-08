import { useEffect, useState } from 'react';

import { AccordionCard, AccordionCardContent, Typography, useAccordionContext } from '@netapp/design-system';
import { ReactComponent as ActionRequiredIcon } from '../../../assets/action-required.svg';
import styles from './EstimatedCost.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import LoadingComponent from '../../../common/LoadingConponent/LoadingComponent';

const EstimatedCost = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [fetchResult, setFetchResult] = useState(false);
    const accordionContext = useAccordionContext()?.setOpenChildren!;

    //To get the Cost value based on the below parameters
    const az1Value = useAppSelector(state => state.mssqlForm.availabilityZones.selectedAzNode1);
    const az2value = useAppSelector(state => state.mssqlForm.availabilityZones.selectedAzNode2);
    const vpcValue = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);
    const domainName = useAppSelector(state => state.mssqlForm.activeDirectory.domainAddress);
    const instanceTypeName = useAppSelector(state => state.mssqlForm.instanceType?.value);

    useEffect(() => {
        if (az1Value && az2value && vpcValue && domainName) {
            setIsLoading(true);
            setTimeout(() => {
                setIsLoading(false);
                setFetchResult(true);
            }, 2000);
        }
    }, [az1Value, az2value, vpcValue, domainName, instanceTypeName]);

    //To open accordion if default account is present
    // useEffect(() => {
    //     if (fetchResult) {
    //         accordionContext({
    //             23: true
    //         });
    //         setTimeout(() => {
    //             document.querySelector('#estimated-cost')?.scrollIntoView({
    //                 behavior: 'smooth',
    //                 block: 'end',
    //                 inline: 'nearest'
    //             });
    //         }, 500);
    //     }
    //     setFetchResult(false);
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [fetchResult]);

    const setHeader = () => {
        // if (!az1Value || !az2value || !vpcValue || !domainName) {
        //     return (
        //         <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
        //             {GENERAL.ESTIMATED_COST_HEADER}
        //         </Typography>
        //     );
        // } else if (isLoading) {
        //     return <LoadingComponent />;
        // } else {
        //     return <Typography variant="Regular_14">cost</Typography>;
        // }
        return (
            <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                {GENERAL.ESTIMATED_COST_HEADER}
            </Typography>
        );
    };
    return (
        <div className={styles['estimated-cost']}>
            <AccordionCard
                // isDisabled={!az1Value || !az2value || !vpcValue || !domainName}
                // isExpandDisabled={!az1Value || !az2value || !vpcValue || !domainName}
                isDisabled={true}
                isExpandDisabled={true}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="23"
                title={<div className={CommonStyles.title}>{GENERAL.ESTIMATED_COST}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <Typography variant="Regular_14">{GENERAL.ESTIMATED_SUBTEXT}</Typography>
                    </Typography>
                    {/* Inside container */}
                    <div className={styles.ecContainer}>
                        <div className={styles.ecContainerHeader}>
                            <Typography variant="Semibold_14" className={styles.resource}>
                                {GENERAL.RESOURCES}
                            </Typography>
                            <Typography variant="Semibold_14" className={styles.amount}>
                                {GENERAL.AMOUNT_IN_USD}
                            </Typography>
                        </div>

                        <div className={styles.computeContainer}>
                            <Typography variant="Semibold_14" className={styles.compute}>
                                {GENERAL.COMPUTE}
                            </Typography>
                            <div className={styles.secondRow}>
                                <Typography variant="Regular_14">
                                    {GENERAL.INSTANCE_TYPE}: {instanceTypeName}
                                </Typography>
                                <Typography variant="Regular_14">{GENERAL.QUANTITY}: 2</Typography>
                            </div>
                            <div className={styles.thirdRow}>
                                <Typography variant="Regular_14" className={styles.costValue}>
                                    {isLoading ? (
                                        <div className={styles.loadingPlacement}>
                                            <LoadingComponent />
                                        </div>
                                    ) : (
                                        '$ 4,347.36'
                                    )}
                                </Typography>
                            </div>
                        </div>

                        <div className={styles.storageContainer}>
                            <Typography variant="Semibold_14" className={styles.compute}>
                                {GENERAL.STORAGE}
                            </Typography>
                            <div className={styles.secondRow}>
                                <Typography variant="Regular_14">{GENERAL.TYPE}: FSx for NetApp ONTAP</Typography>
                                <Typography variant="Regular_14">{GENERAL.SIZE}: 1024 GB</Typography>
                                <Typography variant="Regular_14">{GENERAL.THROUGHPUT}</Typography>
                            </div>
                            <div className={styles.thirdRow}>
                                <Typography variant="Regular_14" className={styles.costValue}>
                                    {isLoading ? (
                                        <div className={styles.loadingPlacement}>
                                            <LoadingComponent />
                                        </div>
                                    ) : (
                                        '$ 500'
                                    )}
                                </Typography>

                                <Typography
                                    variant="Regular_14"
                                    style={{ marginTop: '28px' }}
                                    className={styles.costValue}
                                >
                                    {isLoading ? (
                                        <div className={styles.loadingPlacement}>
                                            <LoadingComponent />
                                        </div>
                                    ) : (
                                        '$ 154'
                                    )}
                                </Typography>
                            </div>
                        </div>

                        <div className={styles.connectivityContainer}>
                            <Typography variant="Semibold_14" className={styles.compute}>
                                {GENERAL.CONNECTIVITY}
                            </Typography>
                            <div className={styles.secondRow}>
                                <Typography variant="Regular_14">New VPC</Typography>
                            </div>
                            <div className={styles.thirdRow}>
                                <Typography variant="Regular_14" className={styles.costValue}>
                                    {isLoading ? (
                                        <div className={styles.loadingPlacement}>
                                            <LoadingComponent />
                                        </div>
                                    ) : (
                                        '$ 7.2'
                                    )}
                                </Typography>
                            </div>
                        </div>

                        <div className={styles.adContainer}>
                            <Typography variant="Semibold_14" className={styles.compute}>
                                {GENERAL.ACTIVE_DIRECTORY}
                            </Typography>
                            <div className={styles.secondRow}>
                                <Typography variant="Regular_14">New Active Directory</Typography>
                            </div>
                            <div className={styles.thirdRow}>
                                <Typography variant="Regular_14" className={styles.costValue}>
                                    {isLoading ? (
                                        <div className={styles.loadingPlacement}>
                                            <LoadingComponent />
                                        </div>
                                    ) : (
                                        '$ 288'
                                    )}
                                </Typography>
                            </div>
                        </div>

                        <div className={styles.lastContainer}>
                            <Typography variant="Semibold_14" className={styles.ecCost}>
                                {GENERAL.ESTIMATED_MONTHLY_COST}
                            </Typography>
                            <Typography variant="Semibold_14" className={styles.ecCostValue}>
                                {isLoading ? (
                                    <div className={styles.loadingPlacement}>
                                        <LoadingComponent />
                                    </div>
                                ) : (
                                    '$ 5,296.56'
                                )}
                            </Typography>
                        </div>

                        <div id="estimated-cost" className={styles.note}>
                            <ActionRequiredIcon />
                            <Typography variant="Regular_14">{GENERAL.EC_NOTE}</Typography>
                        </div>
                    </div>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default EstimatedCost;
