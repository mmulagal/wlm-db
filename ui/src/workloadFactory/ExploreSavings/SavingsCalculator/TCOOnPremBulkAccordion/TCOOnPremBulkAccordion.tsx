import { useEffect, useState } from 'react';
import { AccordionCardContent, DsTypography, useDialog } from '@netapp/design-system';
import { DsButton } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { ReactComponent as Info } from '../../../../assets/info.svg';
import { AccordionCard, AccordionController } from '../../../../common/AccordionCard/AccordionCard';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import styles from './TCOOnPremBulkAccordion.module.scss';

import InstanceInformation from '../InstanceInformation/InstanceInformation';
import ComputeInformation from '../ComputeInformation/ComputeInformation';
import StoragePerformance from '../StoragePerformance/StoragePerformance';
import { useAppSelector } from '../../../../store/storeHooks';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import {
    setSelectedRowsForExploreSavingsOnPremBulk,
    setTriggerBulkDataFetch
} from '../../../../store/workloadFactory/exploreSavingsBulkSlice';
import {
    setOnPremStorageAndComputeInfoFull,
    setSelectedServerName,
    setSelectedEsPageInstance,
    setStorageSavingsResponse
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { formatFractionalNumber } from '../../../../utils/utilityFunctions';
import { GIB_IN_BYTE } from '../../../../utils/consts';
import TCOOnPremAddHostTable from './TCOOnPremAddHostTable/TCOOnPremAddHostTable';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import SavingsSelectedHost from '../SavingsSelectedHost/SavingsSelectedHost';

const TCOOnPremBulkAccordion = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForExploreSavingsOnPremBulk } = useAppSelector(state => state.exploreSavingsBulk);
    const {
        onPremiseData,
        onPremiseDataLoading,
        storageSavingsLoading,
        storageSavingsResponse,
        viewCalculationsResponse
    } = useAppSelector(state => state.exploreSavings);
    const { setDialog, closeDialog } = useDialog();

    // State to track total host count
    const [totalHostCount, setTotalHostCount] = useState(0);

    // State to track if SSD tier card should be shown
    const [showSsdTierCard, setShowSsdTierCard] = useState(false);

    // Update total host count whenever selection changes
    useEffect(() => {
        setTotalHostCount(selectedRowsForExploreSavingsOnPremBulk.length);
    }, [selectedRowsForExploreSavingsOnPremBulk]);

    // Check if SSD tier card should be shown based on ebsCapacity
    useEffect(() => {
        if (viewCalculationsResponse) {
            const totalEbsCapacity = viewCalculationsResponse?.fsxOntapCalculation?.ebsCapacity;

            if (totalEbsCapacity !== null && totalEbsCapacity !== undefined) {
                // Remove commas and extract the number part
                const numericValue = parseFloat(String(totalEbsCapacity));

                // Show card if less than 800 GiB and if the selected hosts are less than 5
                setShowSsdTierCard(numericValue < 800 && selectedRowsForExploreSavingsOnPremBulk.length < 5);
            } else {
                setShowSsdTierCard(false);
            }
        }
    }, [viewCalculationsResponse, selectedRowsForExploreSavingsOnPremBulk]);

    const handleRemoveHost = (hostToRemove: any, event: React.SyntheticEvent) => {
        event.stopPropagation(); // Prevent accordion from toggling
        const updatedHosts = selectedRowsForExploreSavingsOnPremBulk.filter(
            (host: any) => host.resourceId !== hostToRemove.resourceId
        );
        dispatch(setSelectedRowsForExploreSavingsOnPremBulk(updatedHosts));

        // Update server name to reflect new host count or name
        if (updatedHosts.length > 0) {
            // Show host name if only 1 host, otherwise show count
            const serverName =
                updatedHosts.length === 1 ? updatedHosts[0]?.resourceName : `${updatedHosts.length} hosts selected`;

            dispatch(setSelectedServerName(serverName));
            dispatch(
                setSelectedEsPageInstance({
                    instanceId: '',
                    credentialId: '',
                    regionId: '',
                    deploymentModel: updatedHosts[0]?.deploymentModel,
                    serverName
                })
            );
        }

        // Rebuild compute/storage data for remaining hosts
        const storagePerfAndCompute: any = {};
        updatedHosts.forEach((rowData: any) => {
            if (rowData?.sqlServerInstances?.length) {
                rowData.sqlServerInstances.forEach((instance: any) => {
                    const uniqueKey = `${rowData.resourceId}_${instance.sqlInstanceName}`;
                    if (!storagePerfAndCompute[uniqueKey]) {
                        storagePerfAndCompute[uniqueKey] = {};
                    }
                    storagePerfAndCompute[uniqueKey].totalStorage = formatFractionalNumber(
                        Number(instance?.totalStorage || 0) / GIB_IN_BYTE,
                        3
                    );
                    storagePerfAndCompute[uniqueKey].totalIops = formatFractionalNumber(instance?.totalIops, 3);
                    storagePerfAndCompute[uniqueKey].totalThroughput = formatFractionalNumber(
                        instance?.totalThroughput,
                        3
                    );
                    storagePerfAndCompute[uniqueKey].noOfVcpusInUse = instance?.noOfVcpusInUse;
                    storagePerfAndCompute[uniqueKey].memory = formatFractionalNumber(
                        Number(instance?.memory || 0) / GIB_IN_BYTE,
                        3
                    );
                    storagePerfAndCompute[uniqueKey].sqlInstanceName = instance?.sqlInstanceName;
                    storagePerfAndCompute[uniqueKey].sqlInstanceId = instance?.sqlInstanceId;
                    storagePerfAndCompute[uniqueKey].networkPerformance = instance?.networkPerformance;
                    storagePerfAndCompute[uniqueKey].hostResourceName = rowData?.resourceName;
                });
            }
        });

        // Replace compute/storage data with updated data
        dispatch(setOnPremStorageAndComputeInfoFull(storagePerfAndCompute));

        // Clear storageSavingsResponse before triggering API to prevent showing stale/partial data
        dispatch(setStorageSavingsResponse(null));

        // Trigger data fetch after removing hosts - the API will create fresh aggregated data
        dispatch(setTriggerBulkDataFetch(true));
    };

    const addHostsDialogCallback = () => {
        closeDialog();
    };

    const handleManageHosts = () => {
        let exploreSavingsHandler: (() => void) | null = null;

        setDialog(
            <DialogComponent
                header={t('databases.explore-savings.add-hosts-header')}
                content={
                    <TCOOnPremAddHostTable
                        onExploreSavings={addHostsDialogCallback}
                        onHandlerReady={(handler: () => void) => {
                            exploreSavingsHandler = handler;
                        }}
                    />
                }
                primaryButton={t('databases.explore-savings.explore-savings-button')}
                secondaryButton={t('databases.explore-savings.close')}
                callback={() => {
                    if (exploreSavingsHandler) {
                        exploreSavingsHandler();
                    }
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
            />
        );
    };

    // Helper function to get host details
    const getHostDetails = (host: any) => {
        if (host && typeof host === 'object' && host.resourceName) {
            return host;
        }
        if (!onPremiseData?.items) return null;
        return onPremiseData.items.find((item: any) => item.resourceName === host);
    };

    // Helper function to get instance count for a host
    const getHostInstanceCount = (host: any) => {
        const hostDetails = getHostDetails(host);
        return hostDetails?.sqlServerInstances?.length || 0;
    };

    // Helper function to get node count for a host
    const getHostNodeCount = (host: any) => {
        const hostDetails = getHostDetails(host);
        return hostDetails?.onPremisesNodes?.length || 0;
    };

    return (
        <div className={styles.tcoOnPremBulkAccordion}>
            {/* SSD tier card */}
            {showSsdTierCard && (
                <div className={styles.ssdContainer}>
                    <div className={styles.iconWrapper}>
                        <Info />
                    </div>
                    <DsTypography variant="Regular_14">{t('databases.explore-savings.ssd-tier-text')}</DsTypography>
                </div>
            )}
            <AccordionController isGrouped>
                <div className={styles.header}>
                    <DsTypography variant="Semibold_16">
                        {t('databases.explore-savings.selected-hosts')} (
                        {selectedRowsForExploreSavingsOnPremBulk.length})
                    </DsTypography>
                    <DsButton type="text" onClick={handleManageHosts} isDisabled={onPremiseDataLoading}>
                        {t('databases.explore-savings.add-hosts')}
                    </DsButton>
                </div>
                <div className={styles.accordionScrollContainer}>
                    {selectedRowsForExploreSavingsOnPremBulk.map((host: any, index: number) => {
                        const hostDetails = getHostDetails(host);
                        const hostName = host?.resourceName || host;

                        return (
                            <AccordionCard
                                key={hostName || index}
                                ValueContent={() => (
                                    <div className={styles.centerValue}>
                                        <DsTypography variant="Regular_14" className={styles.centerText}>
                                            {getHostInstanceCount(host)} {t('databases.explore-savings.instances')}
                                            <SeparatorComponent variant="vertical" height="16px" />
                                            {getHostNodeCount(host)}{' '}
                                            {hostDetails?.deploymentModel === 'Standalone' ? 'node' : 'nodes'}
                                        </DsTypography>
                                    </div>
                                )}
                                id={String(hostName || index + 1)}
                                title={<div className={CommonStyles.title}>{hostName || `Host ${index + 1}`}</div>}
                                RightWidget={() => (
                                    <div className={styles.rightWidgetButton}>
                                        <DsButton
                                            type="text"
                                            isDisabled={totalHostCount <= 1 || storageSavingsLoading}
                                            onClick={event => handleRemoveHost(host, event)}
                                        >
                                            {t('databases.explore-savings.remove')}
                                        </DsButton>
                                    </div>
                                )}
                            >
                                <AccordionCardContent className={styles.accordionContent}>
                                    <DsTypography>
                                        <SavingsSelectedHost host={hostDetails} />
                                    </DsTypography>
                                    <DsTypography>
                                        <InstanceInformation host={hostDetails} />
                                    </DsTypography>
                                    <DsTypography>
                                        <ComputeInformation host={hostDetails} printState={false} />
                                    </DsTypography>
                                    <DsTypography>
                                        <StoragePerformance host={hostDetails} printState={false} />
                                    </DsTypography>
                                </AccordionCardContent>
                            </AccordionCard>
                        );
                    })}
                </div>
            </AccordionController>
        </div>
    );
};

export default TCOOnPremBulkAccordion;
