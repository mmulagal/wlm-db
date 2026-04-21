import { useEffect, useState, useMemo, useRef } from 'react';
import { AccordionCardContent, DsTypography, useDialog, SelectField, TextField, Button } from '@netapp/design-system';
import { DsButton } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
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
import { FROM_DIALOG, SAVINGS_CALC_MODE } from '../../../../utils/consts';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import {
    setSelectedRowsForExploreSavingsEBSBulk,
    setSelectedRowsForExploreSavingsOracleEbsBulk,
    resetBulkAuthCredentialsAndStatus,
    resetRowsRequiringAuthBulk,
    setRowsRequiringAuthBulk,
    setTriggerBulkDataFetch
} from '../../../../store/workloadFactory/exploreSavingsBulkSlice';
import {
    setRecommendedTargetInstance,
    setOnPremStorageAndComputeInfo,
    removeOnPremStorageAndComputeInfoKey
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { generateOptionType, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { generateLabel2ForInstanceType, handleAuthenticate } from '../../ExploreSavingsUtils';
import { checkIfByolFieldRequired } from '../savingsUtil';
import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';
import { GENERAL } from '../../../../utils/appConstants';
import hostInstanceStyles from './HostInstanceSelection.module.scss';
import LearnHowDialog from '../SavingsSelection/LearnHowDialog/LearnHowDialog';
import AuthBulkDialog from '../../ExploreSavingsTableV2/AuthDialog/AuthBulkDialog';
import { useRegisterResourceCredentialsBulkMutation } from '../../../../utils/apiService';
import { resetDialogComponent } from '../../../../store/workloadFactory/dialogComponentSlice';

const TCOBulkAccordion = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { setDialog, closeDialog } = useDialog();
    const { selectedRowsForExploreSavingsEBSBulk, selectedRowsForExploreSavingsOracleEbsBulk, rowsRequiringAuthBulk } =
        useAppSelector(state => state.exploreSavingsBulk);
    const { savingsCalculatorFrom, viewCalculationsResponse, onPremStorageAndComputeInfo } = useAppSelector(
        state => state.exploreSavings
    );
    const { isWorkloadFactory } = useAppSelector(state => state.auth);
    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();

    const isOracleEbs = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
    const activeRows = isOracleEbs ? selectedRowsForExploreSavingsOracleEbsBulk : selectedRowsForExploreSavingsEBSBulk;
    const setActiveRows = isOracleEbs
        ? setSelectedRowsForExploreSavingsOracleEbsBulk
        : setSelectedRowsForExploreSavingsEBSBulk;

    // State to track recommendations per host
    const [hostRecommendations, setHostRecommendations] = useState<{ [hostId: string]: string }>({});

    // State to track BYOL values per host
    const [hostBYOLValues, setHostBYOLValues] = useState<{ [hostId: string]: string }>({});

    // State to track previous BYOL values to detect actual changes
    const [previousBYOLValues, setPreviousBYOLValues] = useState<{ [hostId: string]: string }>({});

    // State to track total host count (considering both selected and requiring auth)
    const [totalHostCount, setTotalHostCount] = useState(0);

    // Update total host count whenever selection or auth requirements change
    useEffect(() => {
        if (rowsRequiringAuthBulk && rowsRequiringAuthBulk.length > 0) {
            setTotalHostCount(rowsRequiringAuthBulk.length);
        } else {
            setTotalHostCount(activeRows.length);
        }
    }, [activeRows, rowsRequiringAuthBulk]);

    // Initialize onPremStorageAndComputeInfo entries for Oracle EBS hosts
    useEffect(() => {
        if (isOracleEbs && activeRows.length > 0) {
            activeRows.forEach((host: any) => {
                const ec2Id = host?.ec2InstanceId || host?.ec2Details?.[0]?.id;
                const credId = host?.credentialId;
                const regId = host?.regionId;
                if (ec2Id && credId && regId) {
                    const key = `${ec2Id}_${credId}_${regId}`;
                    // Only initialize if not already present
                    if (!onPremStorageAndComputeInfo?.[key]) {
                        dispatch(
                            setOnPremStorageAndComputeInfo({
                                type: key,
                                mode: 'monthlyOracleCost',
                                value: ''
                            })
                        );
                    }
                }
            });
        }
    }, [isOracleEbs, activeRows, onPremStorageAndComputeInfo]);

    const handleRemoveHost = (hostToRemove: any, event: React.SyntheticEvent) => {
        event.stopPropagation(); // Prevent accordion from toggling
        const updatedHosts = activeRows.filter((host: any) => host.id !== hostToRemove.id);
        dispatch(setActiveRows(updatedHosts));

        // Also remove from rowsRequiringAuthBulk if it exists there
        if (rowsRequiringAuthBulk && rowsRequiringAuthBulk.length > 0) {
            const updatedAuthRows = rowsRequiringAuthBulk.filter((row: any) => row.id !== hostToRemove.id);
            dispatch(setRowsRequiringAuthBulk(updatedAuthRows));
        }

        // Clean up the host recommendation state
        const newHostRecommendations = { ...hostRecommendations };
        delete newHostRecommendations[hostToRemove.id];
        setHostRecommendations(newHostRecommendations);

        // Clean up the host BYOL value state
        const newHostBYOLValues = { ...hostBYOLValues };
        delete newHostBYOLValues[hostToRemove.id];
        setHostBYOLValues(newHostBYOLValues);

        // Clean up the previous BYOL value state
        const newPreviousBYOLValues = { ...previousBYOLValues };
        delete newPreviousBYOLValues[hostToRemove.id];
        setPreviousBYOLValues(newPreviousBYOLValues);

        // Clean up onPremStorageAndComputeInfo for Oracle EBS
        if (isOracleEbs) {
            const ec2Id = hostToRemove?.ec2InstanceId || hostToRemove?.ec2Details?.[0]?.id;
            const credId = hostToRemove?.credentialId;
            const regId = hostToRemove?.regionId;
            if (ec2Id && credId && regId) {
                const key = `${ec2Id}_${credId}_${regId}`;
                dispatch(removeOnPremStorageAndComputeInfoKey(key));
            }
        }

        // Trigger data fetch after removing hosts when authentication is not required
        dispatch(setTriggerBulkDataFetch(true));
    };

    const addHostsDialogCallback = () => {
        closeDialog();
    };

    const handleAddHostsAuthDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={t('databases.explore-savings.authentication-required')}
                content={<AuthBulkDialog />}
                primaryButton={t('databases.explore-savings.apply')}
                secondaryButton={t('databases.explore-savings.close')}
                closeCallback={() => {
                    dispatch(resetDialogComponent());
                    dispatch(resetBulkAuthCredentialsAndStatus());
                    dispatch(resetRowsRequiringAuthBulk());
                    closeDialog();
                }}
                dialogFrom={FROM_DIALOG.EXPLORE_SAVINGS}
                callback={() => {
                    handleAuthenticate(
                        rowData,
                        dispatch,
                        GENERAL.EBS,
                        isWorkloadFactory,
                        navigate,
                        () => closeDialog(),
                        t,
                        registerResourceCredBulk,
                        true // isFromAddHosts = true
                    );
                }}
            />
        );
    };

    // Host-specific instance selection component
    const HostInstanceSelection = ({ host }: { host: any }) => {
        const { storageSavingsResponse, storageSavingsLoading } = useAppSelector(state => state.exploreSavings);

        const [instanceTypeData, setInstanceTypeData] = useState<any>({
            missingPermissions: false,
            options: [],
            existingInstanceType: ''
        });

        // Get host-specific recommendation from parent state
        const hostId = host.id;
        const hostName = host.name;
        const hostRecommendedInstance = hostRecommendations[hostId] || '';
        const [isByolField, setIsByolField] = useState<boolean>(false);

        // Local state for the BYOL input field
        const [localByolValue, setLocalByolValue] = useState<string>('');
        const [textSearch, setTextSearch] = useSearchDebounce(1000);

        // Track if this is the initial mount to avoid triggering API on accordion expand
        const isInitialMount = useRef(true);

        useEffect(() => {
            setIsByolField(checkIfByolFieldRequired(host, isByolField, savingsCalculatorFrom));
        }, [host, savingsCalculatorFrom]);

        // Initialize local state from host object or parent state
        useEffect(() => {
            const initialValue =
                hostBYOLValues[hostId] !== undefined ? hostBYOLValues[hostId] : host.monthlySqlByolCost || '';

            setLocalByolValue(initialValue);
            setTextSearch(initialValue);
        }, [host.id]); // Only run when host changes

        // When user types, update local state and debounced search
        const handleByolChange = (value: string) => {
            setLocalByolValue(value);
            setTextSearch(value);
        };

        useEffect(() => {
            // Skip on initial mount (when accordion first expands) to avoid false API trigger
            if (isInitialMount.current) {
                isInitialMount.current = false;
                // Initialize previous value on first mount
                if (textSearch) {
                    setPreviousBYOLValues(prev => ({
                        ...prev,
                        [hostId]: textSearch
                    }));
                }
                return;
            }

            const previousValue = previousBYOLValues[hostId] || '';

            // Only trigger API if the value actually changed (not just expanding a different accordion)
            if (textSearch !== previousValue) {
                // Update previous value to track this change
                setPreviousBYOLValues(prev => ({
                    ...prev,
                    [hostId]: textSearch
                }));

                // Update parent state after debounce so that user do not lose focus while typing
                setHostBYOLValues(prev => ({
                    ...prev,
                    [hostId]: textSearch
                }));

                // Update the host object in selectedRowsForExploreSavingsEBSBulk with monthlySqlByolCost
                // Convert empty string to null for API payload as monthlySqlByolCost is optional argument so where it is not applicable will send null
                const updatedHosts = activeRows.map((h: any) =>
                    h.id === hostId ? { ...h, monthlySqlByolCost: textSearch || null } : h
                );
                dispatch(setActiveRows(updatedHosts));

                // Trigger bulk data fetch - this will call the API with the updated BYOL value
                dispatch(setTriggerBulkDataFetch(true));
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
            setDialog(
                <DialogComponent
                    header={GENERAL.LEARN_HOW_DIALOG.TITLE}
                    content={<LearnHowDialog type="tco" />}
                    primaryButton={GENERAL.CLOSE}
                    callback={() => closeDialog()}
                />
            );
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
                                    handleByolChange(numVal);
                                }}
                                isOptional
                                value={localByolValue}
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

    const [showSsdTierCard, setShowSsdTierCard] = useState(false);

    // Check if SSD tier card should be shown based on ebsCapacity
    useEffect(() => {
        if (viewCalculationsResponse) {
            const totalEbsCapacity = viewCalculationsResponse?.fsxOntapCalculation?.ebsCapacity;

            if (totalEbsCapacity) {
                // Remove commas and extract the number part
                const numericValue = parseFloat(String(totalEbsCapacity).replace(/,/g, '').split(' ')[0]);

                // Show card if less than 800 GiB and if the selcted hosts are less than 5
                setShowSsdTierCard(numericValue < 800 && activeRows.length < 5);
            } else {
                setShowSsdTierCard(false);
            }
        }
    }, [viewCalculationsResponse, activeRows]);

    // Function to calculate total volume count for a specific host
    const getHostVolumeCount = (host: any) => {
        if (!host?.ebsResourceInfo) {
            return 0;
        }
        return host.ebsResourceInfo.length || 0;
    };

    const handleManageHosts = () => {
        let exploreSavingsHandler: (() => void) | null = null;

        setDialog(
            <DialogComponent
                header={t('databases.explore-savings.add-hosts-header')}
                content={
                    <TCOAddHostTable
                        onExploreSavings={addHostsDialogCallback}
                        onHandlerReady={(handler: () => void) => {
                            exploreSavingsHandler = handler;
                        }}
                        onAuthRequired={(selectedRows: any[]) => {
                            // Close the add hosts dialog first
                            closeDialog();
                            // Open the auth dialog after a small delay to allow the first dialog to close
                            setTimeout(() => {
                                handleAddHostsAuthDialog(selectedRows[0]);
                            }, 100);
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
                        {t('databases.explore-savings.selected-hosts')} ({activeRows.length})
                    </DsTypography>
                    <DsButton type="text" onClick={handleManageHosts}>
                        {t('databases.explore-savings.add-hosts')}
                    </DsButton>
                </div>
                <div className={styles.accordionScrollContainer}>
                    {activeRows.map((host: any, index: number) => (
                        <AccordionCard
                            key={host.id || index}
                            ValueContent={() => (
                                <div className={styles.centerValue}>
                                    <DsTypography variant="Regular_14" className={styles.centerText}>
                                        {host.totalInstance}{' '}
                                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS
                                            ? t('databases.explore-savings.databases')
                                            : t('databases.explore-savings.instances')}
                                        <SeparatorComponent variant="vertical" height="16px" />
                                        {getHostVolumeCount(host)} {t('databases.explore-savings.volumes')}
                                    </DsTypography>
                                </div>
                            )}
                            id={String(host.id || index + 1)}
                            title={<div className={CommonStyles.title}>{host.name || `Host ${index + 1}`}</div>}
                            RightWidget={() => (
                                <div className={styles.rightWidgetButton}>
                                    <DsButton
                                        type="text"
                                        isDisabled={totalHostCount <= 1}
                                        onClick={event => handleRemoveHost(host, event)}
                                    >
                                        {t('databases.explore-savings.remove')}
                                    </DsButton>
                                </div>
                            )}
                        >
                            <AccordionCardContent className={styles.accordionContent}>
                                <DsTypography>
                                    {(savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                                        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) && (
                                        <HostInstanceSelection host={host} />
                                    )}

                                    <InstanceInformation host={host} />

                                    <SelectedVolumeSummary host={host} />
                                </DsTypography>
                            </AccordionCardContent>
                        </AccordionCard>
                    ))}
                </div>
            </AccordionController>
        </div>
    );
};

export default TCOBulkAccordion;
