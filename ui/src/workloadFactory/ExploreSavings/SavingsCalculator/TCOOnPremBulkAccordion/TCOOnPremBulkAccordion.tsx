import { useEffect, useState } from 'react';
import { AccordionCardContent, DsTypography, useDialog } from '@netapp/design-system';
import { DsButton } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { ReactComponent as Info } from '../../../../assets/info.svg';
import {
    AccordionCard,
    AccordionController,
    useAccordionContext
} from '../../../../common/AccordionCard/AccordionCard';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import styles from './TCOOnPremBulkAccordion.module.scss';

import InstanceInformation from '../InstanceInformation/InstanceInformation';
import ComputeInformation from '../ComputeInformation/ComputeInformation';
import StoragePerformance from '../StoragePerformance/StoragePerformance';
import { useAppSelector } from '../../../../store/storeHooks';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import {
    setSelectedRowsForExploreSavingsOnPremBulk,
    setSelectedRowsForExploreSavingsOracleOnPremBulk,
    setTriggerBulkDataFetch
} from '../../../../store/workloadFactory/exploreSavingsBulkSlice';
import {
    setOnPremStorageAndComputeInfoFull,
    setSelectedServerName,
    setSelectedEsPageInstance,
    setStorageSavingsResponse
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { formatFractionalNumber } from '../../../../utils/utilityFunctions';
import { GIB_IN_BYTE, SAVINGS_CALC_MODE } from '../../../../utils/consts';
import TCOOnPremAddHostTable from './TCOOnPremAddHostTable/TCOOnPremAddHostTable';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import SavingsSelectedHost from '../SavingsSelectedHost/SavingsSelectedHost';

const AutoExpandAccordions = ({ hostIds }: { hostIds: string[] }) => {
    const context = useAccordionContext();
    useEffect(() => {
        if (context?.setOpenChildren && hostIds.length > 0) {
            const openState: Record<string, boolean> = {};
            hostIds.forEach(id => {
                openState[id] = true;
            });
            context.setOpenChildren(openState);
        }
    }, []);
    return null;
};

const TCOOnPremBulkAccordion = ({ printState }: { printState: boolean }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForExploreSavingsOnPremBulk, selectedRowsForExploreSavingsOracleOnPremBulk } = useAppSelector(
        state => state.exploreSavingsBulk
    );
    const {
        onPremiseData,
        onPremiseDataLoading,
        onPremiseOracleData,
        onPremiseOracleDataLoading,
        storageSavingsLoading,
        viewCalculationsResponse,
        savingsCalculatorFrom,
        selectedOnPremHostDetails,
        onPremStorageAndComputeInfo
    } = useAppSelector(state => state.exploreSavings);
    const { setDialog, closeDialog } = useDialog();

    // Check if Oracle on-prem mode
    const isOracleOnPrem = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;

    // State to track total host count
    const [totalHostCount, setTotalHostCount] = useState(0);

    // State to track if SSD tier card should be shown
    const [showSsdTierCard, setShowSsdTierCard] = useState(false);

    // Update total host count whenever selection changes
    useEffect(() => {
        if (isOracleOnPrem) {
            setTotalHostCount(selectedRowsForExploreSavingsOracleOnPremBulk?.length || 0);
        } else {
            setTotalHostCount(selectedRowsForExploreSavingsOnPremBulk.length);
        }
    }, [selectedRowsForExploreSavingsOnPremBulk, selectedRowsForExploreSavingsOracleOnPremBulk, isOracleOnPrem]);

    // Check if SSD tier card should be shown based on ebsCapacity
    useEffect(() => {
        if (viewCalculationsResponse) {
            const totalEbsCapacity = viewCalculationsResponse?.fsxOntapCalculation?.ebsCapacity;

            if (totalEbsCapacity !== null && totalEbsCapacity !== undefined) {
                // Remove commas and extract the number part
                const numericValue = parseFloat(String(totalEbsCapacity).replace(/,/g, '').split(' ')[0]);

                // Show card if less than 800 GiB and if the selected hosts are less than 5
                const hostCount = isOracleOnPrem
                    ? selectedRowsForExploreSavingsOracleOnPremBulk?.length || 0
                    : selectedRowsForExploreSavingsOnPremBulk.length;
                setShowSsdTierCard(numericValue < 800 && hostCount < 5);
            } else {
                setShowSsdTierCard(false);
            }
        }
    }, [
        viewCalculationsResponse,
        selectedRowsForExploreSavingsOnPremBulk,
        selectedRowsForExploreSavingsOracleOnPremBulk,
        isOracleOnPrem
    ]);

    const handleRemoveHost = (hostToRemove: any, event: React.SyntheticEvent) => {
        event.stopPropagation();

        if (isOracleOnPrem) {
            const updatedHosts = selectedRowsForExploreSavingsOracleOnPremBulk.filter(
                (host: any) => host.resourceId !== hostToRemove.resourceId
            );
            dispatch(setSelectedRowsForExploreSavingsOracleOnPremBulk(updatedHosts));

            if (updatedHosts.length > 0) {
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
        } else {
            const updatedHosts = selectedRowsForExploreSavingsOnPremBulk.filter(
                (host: any) => host.resourceId !== hostToRemove.resourceId
            );
            dispatch(setSelectedRowsForExploreSavingsOnPremBulk(updatedHosts));

            if (updatedHosts.length > 0) {
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
        }

        const filteredStorageAndCompute: any = {};
        const removedResourceId = hostToRemove.resourceId;
        if (onPremStorageAndComputeInfo) {
            Object.keys(onPremStorageAndComputeInfo).forEach(key => {
                if (!key.startsWith(`${removedResourceId}_`)) {
                    filteredStorageAndCompute[key] = onPremStorageAndComputeInfo[key];
                }
            });
        }
        dispatch(setOnPremStorageAndComputeInfoFull(filteredStorageAndCompute));

        dispatch(setStorageSavingsResponse(null));
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
        if (isOracleOnPrem) {
            if (!onPremiseOracleData || !Array.isArray(onPremiseOracleData)) return null;
            return onPremiseOracleData.find((item: any) => item.resourceName === host);
        }
        if (!onPremiseData?.items) return null;
        return onPremiseData.items.find((item: any) => item.resourceName === host);
    };

    // Helper function to get instance/database count for a host
    const getHostInstanceCount = (host: any) => {
        const hostDetails = getHostDetails(host);
        if (isOracleOnPrem) {
            return hostDetails?.oracleDatabases?.length || 0;
        }
        return hostDetails?.sqlServerInstances?.length || 0;
    };

    // Helper function to get node count for a host
    const getHostNodeCount = (host: any) => {
        const hostDetails = getHostDetails(host);
        return hostDetails?.onPremisesNodes?.length || 0;
    };

    // Get the list of hosts to display (Oracle bulk/single-host or MSSQL bulk)
    const getHostsToDisplay = () => {
        if (isOracleOnPrem) {
            if (selectedRowsForExploreSavingsOracleOnPremBulk?.length > 1) {
                return selectedRowsForExploreSavingsOracleOnPremBulk;
            }
            return selectedOnPremHostDetails ? [selectedOnPremHostDetails] : [];
        }
        return selectedRowsForExploreSavingsOnPremBulk;
    };

    const hostsToDisplay = getHostsToDisplay();

    // Get instance/database label based on mode
    const getInstanceLabel = () => {
        if (isOracleOnPrem) {
            return t('databases.explore-savings.databases');
        }
        return t('databases.explore-savings.instances');
    };

    // Show Add/Remove for Oracle bulk (>1 hosts) and always for MSSQL on-prem
    const isOracleBulkMode = isOracleOnPrem && selectedRowsForExploreSavingsOracleOnPremBulk?.length > 1;

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
            <div className={styles.hostListSection}>
                <div className={styles.header}>
                    <DsTypography variant="Semibold_16">
                        {`${t('databases.explore-savings.selected-hosts')} (${hostsToDisplay.length})`}
                    </DsTypography>
                    <DsButton
                        type="text"
                        onClick={handleManageHosts}
                        isDisabled={isOracleOnPrem ? onPremiseOracleDataLoading : onPremiseDataLoading}
                    >
                        {t('databases.explore-savings.add-hosts')}
                    </DsButton>
                </div>
                <AccordionController isGrouped>
                    {isOracleOnPrem && !isOracleBulkMode && (
                        <AutoExpandAccordions
                            hostIds={hostsToDisplay.map((host: any, index: number) =>
                                String(host?.resourceName || index + 1)
                            )}
                        />
                    )}
                    <div className={styles.accordionScrollContainer}>
                        {hostsToDisplay.map((host: any, index: number) => {
                            const hostDetails = getHostDetails(host);
                            const hostName = host?.resourceName || host;

                            return (
                                <AccordionCard
                                    printState={printState}
                                    key={hostName || index}
                                    ValueContent={() => (
                                        <div className={styles.centerValue}>
                                            <DsTypography variant="Regular_14" className={styles.centerText}>
                                                {getHostInstanceCount(host)} {getInstanceLabel()}
                                                {!isOracleOnPrem && (
                                                    <>
                                                        <SeparatorComponent variant="vertical" height="16px" />
                                                        {getHostNodeCount(host)}{' '}
                                                        {hostDetails?.deploymentModel === 'Standalone'
                                                            ? 'node'
                                                            : 'nodes'}
                                                    </>
                                                )}
                                            </DsTypography>
                                        </div>
                                    )}
                                    id={String(hostName || index + 1)}
                                    title={
                                        <div className={isOracleOnPrem ? styles.oracleTitle : CommonStyles.title}>
                                            {hostName || `Host ${index + 1}`}
                                        </div>
                                    }
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
                                            <ComputeInformation host={hostDetails} printState={printState} />
                                        </DsTypography>
                                        <DsTypography>
                                            <StoragePerformance host={hostDetails} printState={printState} />
                                        </DsTypography>
                                    </AccordionCardContent>
                                </AccordionCard>
                            );
                        })}
                    </div>
                </AccordionController>
            </div>
        </div>
    );
};

export default TCOOnPremBulkAccordion;
