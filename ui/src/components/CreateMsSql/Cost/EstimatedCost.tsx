import { useEffect, useState } from 'react';

import { AccordionCard, AccordionCardContent, Typography, useAccordionContext } from '@netapp/design-system';
import { ReactComponent as ActionRequiredIcon } from '../../../assets/action-required.svg';
import styles from './EstimatedCost.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { useGetEstimationCostMutation } from '../../../utils/apiService';
import LoadingComponent from '../../../common/LoadingConponent/LoadingComponent';

type Res = {
    data: {
        compute: '';
        connectivity: '';
        storage: '';
        throughput: '';
        total: '';
    };
};

const EstimatedCost = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<Res>();
    const [fetchResult, setFetchResult] = useState(false);
    const accordionContext = useAccordionContext()?.setOpenChildren!;
    const [isDisabled, setIsDisabled] = useState(false);

    const [getEstimationCost] = useGetEstimationCostMutation();

    //To get the Cost value based on the below parameters
    const regionValue = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedRegion);
    const instanceTypeName = useAppSelector(state => state.mssqlForm.instanceType?.value);
    const sqlSoftwareTypeValue = useAppSelector(state => state.mssqlForm.dbEdition);
    const diskSize = useAppSelector(state => state.mssqlForm.storageCapacity?.capacity);
    const diskSizeUnit = useAppSelector(state => state.mssqlForm.storageCapacity?.unit?.value);
    const throughputValue = useAppSelector(state => state.mssqlForm.throughput?.value);
    const iopsValueType = useAppSelector(state => state.mssqlForm.provisionedIOPS?.provisionedType);
    const iopsValue = useAppSelector(state => state.mssqlForm.provisionedIOPS?.IOPSValue);
    const deploymentModel = useAppSelector(state => state.mssqlForm.dbDeploymentModel);

    useEffect(() => {
        if (
            regionValue &&
            instanceTypeName &&
            sqlSoftwareTypeValue &&
            diskSize &&
            (iopsValueType !== GENERAL.USER_PROVISIONED ||
                (iopsValueType === GENERAL.USER_PROVISIONED &&
                    (iopsValue === '' || (Number(iopsValue) > 3072 && Number(iopsValue) < 160000))))
        ) {
            const splitRegion = regionValue?.value.split('|');
            const updatedStr = splitRegion[0].replace(/\s?$/, '');
            const payload = {
                compute: {
                    regionCode: updatedStr || '',
                    instanceType: instanceTypeName || '',
                    sqlSoftwareType: sqlSoftwareTypeValue.value === 'Standard' ? 'SQL std' : 'SQL ent' || ''
                },
                storage: {
                    regionCode: updatedStr || '',
                    diskSize: `${diskSize}${diskSizeUnit}`,
                    throughput: throughputValue,
                    iops: iopsValueType === GENERAL.USER_PROVISIONED ? Number(iopsValue) : 0,
                    deploymentOption: deploymentModel?.label === GENERAL.SINGLE_INSTANCE ? 'singleAZ' : 'multiAZ'
                }
                // vpc: {
                //     regionCode: updatedStr || '',
                // }
            };
            setIsLoading(true);
            getEstimationCost(payload)
                .then((data: any) => {
                    setTimeout(() => {
                        setIsLoading(false);
                        setFetchResult(true);
                        if (data.error) {
                            setIsDisabled(true);
                        } else {
                            setData(data);
                        }
                    }, 2000);
                })
                .catch((error: any) => {
                    setIsLoading(false);
                    setFetchResult(false);
                    setIsDisabled(true);
                    console.log('Error while fetching data - ', error);
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        regionValue,
        sqlSoftwareTypeValue,
        instanceTypeName,
        diskSize,
        diskSizeUnit,
        throughputValue,
        iopsValueType,
        iopsValue
    ]);

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
        if (isLoading) {
            return <LoadingComponent />;
        } else if (isDisabled) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.COST_ERROR}
                </Typography>
            );
        } else if (!regionValue) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.ESTIMATED_COST_HEADER}
                </Typography>
            );
        } else {
            return <Typography variant="Regular_14">{`$${data?.data?.total}`}</Typography>;
        }
    };
    return (
        <div className={styles['estimated-cost']}>
            <AccordionCard
                isDisabled={isDisabled || !regionValue}
                isExpandDisabled={isDisabled || !regionValue}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="24"
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
                                        //@ts-ignore
                                        `$${data?.data?.compute}` || ''
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
                                        //@ts-ignore
                                        `$${data?.data?.storage?.storageCapacity}` || ''
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
                                        //@ts-ignore
                                        `$${data?.data?.storage?.throughput}` || ''
                                    )}
                                </Typography>
                            </div>
                        </div>

                        {/* <div className={styles.connectivityContainer}>
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
                                        //@ts-ignore
                                        data?.data?.vpc || ''
                                    )}
                                </Typography>
                            </div>
                        </div> */}

                        {/* <div className={styles.adContainer}>
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
                        </div> */}

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
                                    //@ts-ignore
                                    `$${data?.data?.total}` || ''
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
