import { useEffect, useState } from 'react';

import {
    AccordionCard,
    AccordionCardContent,
    TooltipInfo,
    Typography,
    useAccordionContext
} from '@netapp/design-system';
import { ReactComponent as ActionRequiredIcon } from '../../../assets/action-required.svg';
import styles from './EstimatedCost.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { useGetEstimationCostMutation } from '../../../utils/apiService';
import LoadingComponent from '../../../common/LoadingConponent/LoadingComponent';
import { FSX_DEPLOYMENT_MODE } from '../../../utils/consts';
import SizePopover from './SizePopover/SizePopover';
import { isFsxnNew } from '../../../utils/utilityFunctions';

type Res = {
    data: {
        compute: '';
        fsxnStorage: {
            capacity: '';
            throughput: '';
            size: {
                total: '';
            };
        };
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
    const selectedCredId = useAppSelector(state => state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId);
    const regionValue = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedRegion);
    const instanceTypeName = useAppSelector(state => state.mssqlForm.instanceType?.value);
    const sqlSoftwareTypeValue = useAppSelector(state => state.mssqlForm.dbEdition);
    const diskSize = useAppSelector(state => state.mssqlForm.storageCapacity?.capacity);
    const diskSizeUnit = useAppSelector(state => state.mssqlForm.storageCapacity?.unit?.value);
    const throughputValue = useAppSelector(state => state.mssqlForm.throughput?.value);
    const iopsValueType = useAppSelector(state => state.mssqlForm.provisionedIOPS?.provisionedType);
    const iopsValue = useAppSelector(state => state.mssqlForm.provisionedIOPS?.IOPSValue);
    const deploymentModel = useAppSelector(state => state.mssqlForm.dbDeploymentModel);

    const selectedZone1 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedAzNode1);
    const selectedZone2 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedAzNode2);
    const selectedFsxnType = useAppSelector(state => state.mssqlForm.fsxN.fsxNType);

    const fsxVolThroughput = () => {
        const value = (throughputValue || '').split(' ');
        if (value.length === 2) {
            if (value[1] === 'GBps') {
                return value[0] * 1024;
            } else {
                return Number(value[0]);
            }
        } else {
            return throughputValue;
        }
    };

    const computeObj = (updatedStr: string) => {
        return {
            regionCode: updatedStr || '',
            instanceType: instanceTypeName || '',
            sqlSoftwareType: sqlSoftwareTypeValue.value === 'Standard' ? 'SQL std' : 'SQL ent' || '',
            sqlDeploymentMode: deploymentModel?.value
        };
    };

    useEffect(() => {
        let validDisk = false;
        if (
            diskSize &&
            diskSizeUnit &&
            ((diskSizeUnit === 'TiB' && Number(diskSize) <= 130 && Number(diskSize) >= 1) ||
                (diskSizeUnit === 'GiB' && Number(diskSize) <= 133120 && Number(diskSize) >= 120))
        ) {
            validDisk = true;
        }
        if (
            selectedCredId &&
            regionValue &&
            instanceTypeName &&
            sqlSoftwareTypeValue &&
            validDisk &&
            (iopsValueType !== GENERAL.USER_PROVISIONED ||
                (iopsValueType === GENERAL.USER_PROVISIONED &&
                    (iopsValue === '' || (Number(iopsValue) >= 3072 && Number(iopsValue) <= 160000))))
        ) {
            const splitRegion = regionValue?.value.split('|');
            const updatedStr = splitRegion[0].replace(/\s?$/, '');
            let payload;

            if (isFsxnNew(selectedFsxnType)) {
                payload = {
                    compute: computeObj(updatedStr),
                    fsxnStorage: {
                        regionCode: updatedStr || '',
                        diskSize: diskSizeUnit === 'TiB' ? 1024 * diskSize : Number(diskSize),
                        throughput: fsxVolThroughput(),
                        iops: iopsValueType === GENERAL.USER_PROVISIONED ? Number(iopsValue) : 0,
                        deploymentOption:
                            deploymentModel?.label === GENERAL.SINGLE_INSTANCE
                                ? FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
                                : FSX_DEPLOYMENT_MODE.MULTI_AZ_1
                    }
                };
            } else {
                payload = {
                    compute: computeObj(updatedStr)
                };
            }
            setIsLoading(true);
            getEstimationCost({ payload: payload })
                .then((data: any) => {
                    setTimeout(() => {
                        setIsLoading(false);
                        setFetchResult(true);
                        if (data.error) {
                            setIsDisabled(true);
                        } else {
                            setData(data);
                            setIsDisabled(false);
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
        iopsValue,
        deploymentModel,
        selectedFsxnType
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
        if (!regionValue) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.ESTIMATED_COST_HEADER}
                </Typography>
            );
        } else if (!selectedZone1 || (deploymentModel?.label === GENERAL.FAILOVER_CLUSTER && !selectedZone2)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_AZ}
                </Typography>
            );
        } else if (isLoading) {
            return <LoadingComponent />;
        } else if (isDisabled) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.COST_ERROR}
                </Typography>
            );
        } else {
            return <Typography variant="Regular_14">{`$${Number(data?.data?.total).toFixed(2)}`}</Typography>;
        }
    };

    const costDisableCheck = () => {
        if (deploymentModel?.label === GENERAL.SINGLE_INSTANCE) {
            return isDisabled || !regionValue || !selectedZone1;
        } else {
            return isDisabled || !regionValue || !selectedZone1 || !selectedZone2;
        }
    };

    return (
        <div className={styles['estimated-cost']}>
            <AccordionCard
                isDisabled={costDisableCheck()}
                isExpandDisabled={costDisableCheck()}
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
                                <Typography variant="Regular_14">
                                    {GENERAL.QUANTITY}: {deploymentModel?.label === GENERAL.SINGLE_INSTANCE ? 1 : 2}
                                </Typography>
                            </div>
                            <div className={styles.thirdRow}>
                                <Typography variant="Regular_14" className={styles.costValue}>
                                    {isLoading ? (
                                        <div className={styles.loadingPlacement}>
                                            <LoadingComponent />
                                        </div>
                                    ) : (
                                        //@ts-ignore
                                        `$${Number(data?.data?.compute).toFixed(2)}` || ''
                                    )}
                                </Typography>
                            </div>
                        </div>

                        {isFsxnNew(selectedFsxnType) && (
                            <div className={styles.storageContainer}>
                                <Typography variant="Semibold_14" className={styles.compute}>
                                    {GENERAL.STORAGE}
                                </Typography>
                                <div className={styles.secondRow}>
                                    <Typography variant="Regular_14">{GENERAL.TYPE}: FSx for NetApp ONTAP</Typography>
                                    <div className={styles.sizeRow}>
                                        <Typography variant="Regular_14">
                                            {GENERAL.SIZE}: {data?.data?.fsxnStorage?.size?.total + ' GiB'}
                                        </Typography>
                                        {/* {data?.data?.fsxnStorage?.size?.total && (
                                            <TooltipInfo className={styles.tooltipClass}>
                                                {Number(data?.data?.fsxnStorage?.size?.total || 0) > 1024
                                                    ? SizePopover(data?.data?.fsxnStorage?.size)
                                                    : GENERAL.MIN_FSX_CAPACITY_MESSAGE}
                                            </TooltipInfo>
                                        )} */}
                                    </div>

                                    <Typography variant="Regular_14">
                                        {GENERAL.THROUGHPUT}: {throughputValue}
                                    </Typography>
                                </div>
                                <div className={styles.thirdRow}>
                                    <Typography variant="Regular_14" className={styles.costValue}>
                                        {isLoading ? (
                                            <div className={styles.loadingPlacement}>
                                                <LoadingComponent />
                                            </div>
                                        ) : (
                                            //@ts-ignore
                                            `$${Number(data?.data?.fsxnStorage?.capacityCost).toFixed(2)}` || ''
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
                                            `$${Number(data?.data?.fsxnStorage?.operationalCost).toFixed(2)}` || ''
                                        )}
                                    </Typography>
                                </div>
                            </div>
                        )}

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
                                    `$${Number(data?.data?.total).toFixed(2)}` || ''
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
