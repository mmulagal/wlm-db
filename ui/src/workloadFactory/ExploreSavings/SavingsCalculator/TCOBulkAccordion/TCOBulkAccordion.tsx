import { useEffect, useState, useMemo } from 'react';
import { AccordionCardContent, DsTypography, useDialog, SelectField, TextField, Button } from '@netapp/design-system';
import { DsButton } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import { AccordionCard, AccordionController } from '../../../../common/AccordionCard/AccordionCard';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import styles from './TCOBulkAccordion.module.scss';

import { ReactComponent as Info } from '../../../../assets/info.svg';

import InstanceInformation from '../InstanceInformation/InstanceInformation';
import SelectedVolumeSummary from '../SelectedVolumeSummary/SelectedVolumeSummary';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import TCOAddHostTable from './TCOAddHostTable/TCOAddHostTable';
import { useAppSelector } from '../../../../store/storeHooks';
import { SAVINGS_CALC_MODE } from '../../../../utils/consts';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import { setSelectedRowsForExploreSavingsEBSBulk } from '../../../../store/workloadFactory/exploreSavingsBulkSlice';
import {
    setRecommendedTargetInstance,
    setSelectedMonthlyBYOLCost
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { generateOptionType, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { generateLabel2ForInstanceType } from '../../ExploreSavingsUtils';
import { checkIfByolFieldRequired } from '../savingsUtil';
import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';
import { GENERAL } from '../../../../utils/appConstants';
import hostInstanceStyles from './HostInstanceSelection.module.scss';

const TCOBulkAccordion = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const { ebsTCOAction, selectedRowsForExploreSavingsEBSBulk } = useAppSelector(state => state.exploreSavingsBulk);

    // State to track recommendations per host
    const [hostRecommendations, setHostRecommendations] = useState<{ [hostId: string]: string }>({});

    const handleRemoveHost = (hostToRemove: any, event: React.SyntheticEvent) => {
        event.stopPropagation(); // Prevent accordion from toggling
        const updatedHosts = selectedRowsForExploreSavingsEBSBulk.filter((host: any) => host.id !== hostToRemove.id);
        dispatch(setSelectedRowsForExploreSavingsEBSBulk(updatedHosts));

        // Clean up the host recommendation state
        const newHostRecommendations = { ...hostRecommendations };
        delete newHostRecommendations[hostToRemove.id];
        setHostRecommendations(newHostRecommendations);
    };

    const addHostsDialogCallback = () => {
        closeDialog();
    };

    // Host-specific instance selection component
    const HostInstanceSelection = ({ host }: { host: any }) => {
        const {
            storageSavingsResponse,
            storageSavingsLoading,
            recommendedTargetInstance,
            monthlyBYOLCost,
            selectedHostDetails
        } = useAppSelector(state => state.exploreSavings);

        const [instanceTypeData, setInstanceTypeData] = useState<any>({
            missingPermissions: false,
            options: [],
            existingInstanceType: ''
        });

        // Get host-specific recommendation from parent state
        const hostId = host.id;
        const hostName = host.ec2InstanceName || host.name;
        const hostRecommendedInstance = hostRecommendations[hostId] || '';
        const [isByolField, setIsByolField] = useState<boolean>(false);
        const [byolValue, setByolValue] = useState(monthlyBYOLCost || '');
        const [textSearch, setTextSearch] = useSearchDebounce(500);

        useEffect(() => {
            setIsByolField(checkIfByolFieldRequired(selectedHostDetails, isByolField, savingsCalculatorFrom));
        }, [selectedHostDetails]);

        useEffect(() => {
            setTextSearch(byolValue);
        }, [byolValue]);

        useEffect(() => {
            if (textSearch || monthlyBYOLCost) {
                dispatch(setSelectedMonthlyBYOLCost(textSearch));
            }
        }, [textSearch]);

        // Extract instance type data for this specific host by matching hostname
        useEffect(() => {
            if (storageSavingsResponse?.compute && Array.isArray(storageSavingsResponse.compute)) {
                // Find compute data by matching hostname
                const hostComputeData = storageSavingsResponse.compute.find(
                    (computeItem: any) => computeItem.hostname === hostName
                );
                
                if (hostComputeData?.recommended?.recommendationOptions) {
                    const options = hostComputeData.recommended.recommendationOptions;
                    const existingInstanceType = hostComputeData?.existing?.instanceType || '';
                    const missingPermissions = !options || options.length === 0;

                    setInstanceTypeData({
                        missingPermissions,
                        options,
                        existingInstanceType
                    });

                    // Set default recommendation to first option if available
                    if (options && options.length > 0 && !hostRecommendedInstance) {
                        setHostRecommendations(prev => ({
                            ...prev,
                            [hostId]: options[0].instanceType
                        }));
                    }
                }
            }
        }, [storageSavingsResponse?.compute, hostName, hostRecommendedInstance]);

        const generateRecommendedInstanceTypes = useMemo(() => {
            const options: any[] = [];

            if (instanceTypeData.options && instanceTypeData.options.length > 0) {
                instanceTypeData.options.forEach((option: any) => {
                    // Calculate savings percentage for display
                    const computeArray = Array.isArray(storageSavingsResponse?.compute)
                        ? storageSavingsResponse.compute
                        : [];
                    // Find the compute data for this host by hostname
                    const existingCompute = computeArray.find(
                        (computeItem: any) => computeItem.hostname === hostName
                    )?.existing;
                    
                    const savingsPercent =
                        existingCompute && option.computeMonthlyPrice && existingCompute.computeMonthlyPrice
                            ? Math.round(
                                  ((existingCompute.computeMonthlyPrice - option.computeMonthlyPrice) /
                                      existingCompute.computeMonthlyPrice) *
                                      100
                              )
                            : 0;

                    // Always show savings percentage if it's calculated, otherwise fall back to default label
                    const label2 =
                        savingsPercent !== 0
                            ? `Savings opportunity: ${savingsPercent}%`
                            : generateLabel2ForInstanceType(
                                  instanceTypeData.options,
                                  option.instanceType,
                                  instanceTypeData.existingInstanceType
                              );

                    options.push(generateOptionType(option.instanceType, option.instanceType, label2, false, ''));
                });
            }

            return options;
        }, [
            instanceTypeData.options,
            instanceTypeData.existingInstanceType,
            storageSavingsResponse?.compute,
            hostName
        ]);

        const handleLearnHowClick = () => {
            // Todo : Need to check why this was written so we can open proper dialog and display the missing permissions info
            console.log('Learn how clicked for host:', host.name);
        };

        // Handle instance type change for this specific host
        const handleInstanceTypeChange = (selectedOptions: any) => {
            const selectedVal = selectedOptions.value;
            setHostRecommendations(prev => ({
                ...prev,
                [hostId]: selectedVal
            }));
            // Update global state if needed (for calculations)
            dispatch(
                setRecommendedTargetInstance(selectedVal === instanceTypeData?.existingInstanceType ? '' : selectedVal)
            );
        };

        return (
            <div className={hostInstanceStyles.hostInstanceSelection}>
                <div className={hostInstanceStyles.fieldsContainer}>
                    {isByolField && (
                        <div className={hostInstanceStyles.fieldWrapper}>
                            <TextField
                                label={GENERAL.BYOL_TEXT}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                    setByolValue(numVal);
                                }}
                                isOptional
                                value={byolValue}
                                className="savings-calculator-input-fields"
                            />
                        </div>
                    )}

                    <div className={`${hostInstanceStyles.fieldWrapper} ${hostInstanceStyles.instanceTypeContainer}`}>
                        <SelectField
                            label={GENERAL.RECOMMENDED_INSTANCE_TYPE}
                            info={GENERAL.RECOMMENDED_INSTANCE_TYPE_INFO}
                            isClearable={false}
                            isDisabled={
                                instanceTypeData?.missingPermissions || generateRecommendedInstanceTypes.length === 1
                            }
                            variant="two-lines"
                            isLoading={storageSavingsLoading}
                            value={generateOptionType(
                                hostRecommendedInstance || instanceTypeData.existingInstanceType,
                                hostRecommendedInstance || instanceTypeData.existingInstanceType,
                                generateLabel2ForInstanceType(
                                    instanceTypeData?.options,
                                    hostRecommendedInstance || instanceTypeData.existingInstanceType,
                                    instanceTypeData.existingInstanceType
                                ),
                                false,
                                ''
                            )}
                            onChange={handleInstanceTypeChange}
                            isSearchable={generateRecommendedInstanceTypes?.length > 5}
                            options={generateRecommendedInstanceTypes}
                            className="savings-calculator-input-fields"
                            menuPortalTarget={document.body}
                        />

                        {(instanceTypeData?.missingPermissions ||
                            (generateRecommendedInstanceTypes?.length === 1 && !storageSavingsLoading)) && (
                            <div className={hostInstanceStyles.errorContainer}>
                                <InfoIcon />
                                <DsTypography variant="Regular_13">
                                    {instanceTypeData?.missingPermissions
                                        ? GENERAL.MISSING_PERMISSIONS_NOTICE
                                        : GENERAL.RECOMMENDATIONS_UNAVAILABLE_NOTICE}
                                </DsTypography>
                                {instanceTypeData?.missingPermissions && (
                                    <Button variant="text" onClick={handleLearnHowClick}>
                                        {GENERAL.LEARN_HOW}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Logic for only single host
    const {
        selectedHostDetails,
        selectedOnPremHostDetails,
        selectedPartnerHostDetails,
        getPartnerHostDetailsLoading,
        savingsCalculatorFrom,
        selectedExploreSavingsTab,
        viewCalculationsResponse
    } = useAppSelector(state => state.exploreSavings);

    const [totalVolume, setTotalVolume] = useState(0);
    const [hostname, setHostname] = useState('');
    const [noOfInstances, setNoOfInstances] = useState('');
    const [showSsdTierCard, setShowSsdTierCard] = useState(false);

    // Check if SSD tier card should be shown based on ebsCapacity
    useEffect(() => {
        if (viewCalculationsResponse) {
            const totalEbsCapacity = viewCalculationsResponse?.fsxOntapCalculation?.ebsCapacity;

            if (totalEbsCapacity) {
                // Remove commas and extract the number part
                const numericValue = parseFloat(String(totalEbsCapacity).replace(/,/g, '').split(' ')[0]);

                // Show card if less than 800 GiB and if the selcted hosts are less than 5
                setShowSsdTierCard(numericValue < 800 && selectedRowsForExploreSavingsEBSBulk.length < 5);
            } else {
                setShowSsdTierCard(false);
            }
        }
    }, [viewCalculationsResponse, selectedRowsForExploreSavingsEBSBulk]);

    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
            setTotalVolume(0);
            setHostname(selectedOnPremHostDetails?.resourceName);
            setNoOfInstances(selectedOnPremHostDetails?.totalInstance);
        } else {
            let volumeCount = 0;
            if (selectedHostDetails?.ebsResourceInfo?.length) {
                volumeCount += selectedHostDetails?.ebsResourceInfo?.length;
            }
            if (selectedPartnerHostDetails?.ebsResourceInfo?.length) {
                volumeCount += selectedPartnerHostDetails?.ebsResourceInfo?.length;
            }
            setTotalVolume(volumeCount);
            setHostname(selectedHostDetails?.name);
            setNoOfInstances(selectedHostDetails?.totalInstance);
        }
    }, [selectedHostDetails, selectedPartnerHostDetails, selectedOnPremHostDetails, ebsTCOAction]);

    // Single host logic ends here

    const handleManageHosts = () => {
        let exploreSavingsHandler: (() => void) | null = null;

        setDialog(
            <DialogComponent
                header="Add hosts and explore savings"
                content={
                    <TCOAddHostTable
                        onExploreSavings={addHostsDialogCallback}
                        onHandlerReady={(handler: () => void) => {
                            exploreSavingsHandler = handler;
                        }}
                    />
                }
                primaryButton="Explore savings"
                secondaryButton="Close"
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
    return (
        <div className={styles.tcoBulkAccordion}>
            {/* SSD tier card - showed based on condition */}
            {showSsdTierCard && (
                <div className={styles.ssdContainer}>
                    <div style={{ position: 'relative', top: '5px' }}>
                        <Info />
                    </div>
                    <DsTypography variant="Regular_14">{t('databases.explore-savings.ssd-tier-text')}</DsTypography>
                </div>
            )}
            <AccordionController isGrouped>
                <div className={styles.header}>
                    <DsTypography variant="Semibold_16">
                        {t('databases.explore-savings.selected-hosts')} ({selectedRowsForExploreSavingsEBSBulk.length})
                    </DsTypography>
                    <DsButton type="text" onClick={handleManageHosts}>
                        {t('databases.explore-savings.add-hosts')}
                    </DsButton>
                </div>
                <>
                    {selectedRowsForExploreSavingsEBSBulk.map((host: any, index: number) => (
                        <AccordionCard
                            key={host.id || index}
                            ValueContent={() => (
                                <div className={styles.centerValue}>
                                    <DsTypography variant="Regular_14" className={styles.centerText}>
                                        {host.totalInstance} {t('databases.explore-savings.instances')}
                                        <SeparatorComponent variant="vertical" height="16px" />
                                        {(host.ec2Details && host.ec2Details.length) || 0}{' '}
                                        {t('databases.explore-savings.volumes')}
                                    </DsTypography>
                                </div>
                            )}
                            id={String(host.id || index + 1)}
                            title={<div className={CommonStyles.title}>{host.name || `Host ${index + 1}`}</div>}
                            RightWidget={() => (
                                <div className={styles.rightWidgetButton}>
                                    <DsButton
                                        type="text"
                                        isDisabled={selectedRowsForExploreSavingsEBSBulk.length <= 1}
                                        onClick={event => handleRemoveHost(host, event)}
                                    >
                                        {t('databases.explore-savings.remove')}
                                    </DsButton>
                                </div>
                            )}
                        >
                            <AccordionCardContent>
                                <DsTypography>
                                    {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && (
                                        <HostInstanceSelection host={host} />
                                    )}

                                    <InstanceInformation />

                                    <SelectedVolumeSummary />
                                </DsTypography>
                            </AccordionCardContent>
                        </AccordionCard>
                    ))}
                </>
            </AccordionController>
        </div>
    );
};

export default TCOBulkAccordion;
