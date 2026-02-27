import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { BlueXPListeners, DsButton, DsTypography, postBlueXPMessage } from '@netapp/design-system';
import { useEffect, useRef, useState } from 'react';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './SavingsCalculator.module.scss';
import { DBType, DETECT_HOST_VAR, SAVINGS_CALC_MODE, WLF_TABS } from '../../../utils/consts';
import CostSavings from './CostSavings/CostSavings';
import TotalMonthlyCost from '../TotalMonthlyCost/TotalMonthlyCost';
import SavingsHeader from './SavingsHeader/SavingsHeader';
import SavingsSelection from './SavingsSelection/SavingsSelection';
import CostBreakdown from './CostBreakdown/CostBreakdown';
import SavingsSelectedHost from './SavingsSelectedHost/SavingsSelectedHost';
import InstanceInformation from './InstanceInformation/InstanceInformation';
import { ReactComponent as Suggestion } from '../../../assets/Suggestion.svg';
import { ReactComponent as SuggestionDisable } from '../../../assets/SuggestionDisable.svg';
import { ReactComponent as CalculateIcon } from '../../../assets/ic_calculateicon.svg';
import { ReactComponent as LightIcon } from '../../../assets/lighticon.svg';
import MSSQLAccordion from './MSSQLAccordion/MSSQLAccordion';

import ExportPDF from './ExportPDF/ExportPDF';
import downloadPdf from '../../../common/pdfGenerator';
import {
    addExploreSavingsInitialData,
    setShowOptimizeModal,
    setStorageSavingsResponse,
    setViewCalculationsResponse
} from '../../../store/workloadFactory/exploreSavingsSlice';
import { setSelectedRowsForExploreSavingsEBSBulk } from '../../../store/workloadFactory/exploreSavingsBulkSlice';
import { useAppSelector } from '../../../store/storeHooks';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import ManualTCOFields from './ManualTCOFields/ManualTCOFields';
import ManualEC2 from './ManualEC2/ManualEC2';
import ManualVolumeTypes from './ManualVolumeTypes/ManualVolumeTypes';
import ManualTCOAccordion from './ManualTCOAccordion/ManualTCOAccordion';

import { formatStorageSavingsRecommendedData } from '../ExploreSavingsUtils';
import ManualTCOFSXFields from './ManualTCOFSXFields/ManualTCOFSXFields';
import ManualFSXEC2 from './ManualFSXEC2/ManualFSXEC2';
import WindowFileServer from './WindowFileServer/WindowFileServer';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import OnPremRegion from './OnPremRegion/OnPremRegion';
import downloadPdfEmail from '../../../common/emailPDF';
import CalculateSavingCard from './CalculateSavingCard/CalculateSavingCard';
import { useGetSendEmailMutation } from '../../../utils/apiService';
import OptimizedModel from './OptimizedModel/OptimizedModel';
import CalculatorMode from './CalculatorMode/CalculatorMode';
import { prepareViewCalcData } from './savingsUtil';
import TCOBulkAccordion from './TCOBulkAccordion/TCOBulkAccordion';
import TCOOnPremBulkAccordion from './TCOOnPremBulkAccordion/TCOOnPremBulkAccordion';
// Oracle-specific imports (only API remains Oracle-specific)
import OracleSavingsCalculatorApi from '../OracleTCO/OracleSavingsCalculator/OracleSavingsCalculatorApi';

const SavingsCalculator = ({ statusCheck }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [printState, setPrintState] = useState(false);
    const [isMutliFsx, setIsMutliFsx] = useState(false);
    const buttonRef: any = useRef(null);
    const [isCardOpen, setIsCardOpen] = useState(false);
    const { statusData } = useAppSelector(state => state.headers.getStatus);

    const [getSendEmail] = useGetSendEmailMutation();

    const {
        savingsCalculatorFrom,
        selectedServerName,
        monthlyChangeRate,
        selectedManualDeploymentModel,
        selectedDeploymentModel,
        recommendedTargetInstance,
        storageSavingsResponse,
        viewCalculationsApiResponse,
        viewCalculationsResponse,
        disableState,
        selectedExploreSavingsTab,
        showOptimizedModal,
        showOptimizeLink,
        showOptimizeMode,
        selectedCalculatorMode,
        selectedOnPremHostDetails,
        selectedTCOHostType
    } = useAppSelector(state => state.exploreSavings);

    // Helper to check if in Oracle on-prem mode
    const isOracleOnPrem = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;
    const isOnPremMode = selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES || isOracleOnPrem;

    const { selectedRowsForExploreSavingsEBSBulk, selectedRowsForExploreSavingsOnPremBulk } = useAppSelector(
        state => state.exploreSavingsBulk
    );

    const { isWorkloadFactory, userMetadata } = useAppSelector(state => state.auth);

    useEffect(() => {
        if (
            (!statusData || statusData?.isActive === false) &&
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW)
        ) {
            setIsCardOpen(true);
        } else {
            setIsCardOpen(false);
        }
    }, [savingsCalculatorFrom, statusData]);

    useEffect(() => {
        dispatch(setStorageSavingsResponse(formatStorageSavingsRecommendedData(storageSavingsResponse)));
        if (viewCalculationsApiResponse) {
            prepareViewCalcData(viewCalculationsApiResponse, dispatch, selectedDeploymentModel, monthlyChangeRate);
        } else {
            dispatch(setViewCalculationsResponse(null));
        }
    }, [recommendedTargetInstance, selectedCalculatorMode]);

    useEffect(() => {
        const requiredNumOfFsx = viewCalculationsResponse?.fsxOntapCalculation?.requiredNumOfFsx;
        if (requiredNumOfFsx && Number(requiredNumOfFsx) > 1) {
            setIsMutliFsx(true);
        } else {
            setIsMutliFsx(false);
        }
    }, [viewCalculationsResponse]);

    const setEmailSubject = () => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS
        ) {
            return SAVINGS_CALC_MODE.EBS;
        }
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
        ) {
            return SAVINGS_CALC_MODE.FSXW;
        }
        return SAVINGS_CALC_MODE.ONPREM_MODE;
    };

    const sendEmail = async () => {
        setPrintState(true);
        setTimeout(async () => {
            const elem = document.getElementById('export-pdf') as HTMLElement;
            const options = {
                filename: 'SavingsCalculator.pdf',
                compression: 'MEDIUM'
            };
            const report = await downloadPdfEmail(elem, options, true, () => {});

            const formData = new FormData();
            formData.append('file', report, `SavingsCalculator-${Date.now()}.pdf`);
            formData.append('userEmail', userMetadata?.email);
            formData.append('emailType', 'savings-calculations');
            formData.append('storageType', setEmailSubject());
            formData.append(
                'databaseType',
                selectedTCOHostType === DBType.MSSQL ? DETECT_HOST_VAR.MSSQL : DETECT_HOST_VAR.ORACLE
            );
            const dynamicHostName = getDynamicBreadcrumbTitle();
            if (dynamicHostName) {
                formData.append('hostName', dynamicHostName);
            }
            getSendEmail({ payload: formData })
                .then(resp => {
                    if (!resp.error) {
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.SUCCESS,
                                message: 'Calculation report was sent to you by email'
                            })
                        );
                    } else {
                        // @ts-ignore
                        if (resp?.error?.data?.message === 'Too many requests') {
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    // @ts-ignore
                                    message: 'Calculation report was failed to be delivered.',
                                    additionalText:
                                        "You've reached the calculation result emails limit for the day. Try again tomorrow."
                                })
                            );
                        } else {
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    // @ts-ignore
                                    message: resp?.error?.data?.message
                                })
                            );
                        }
                    }

                    setPrintState(false);
                })
                .catch(err => {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: 'Calculation report was failed to be delivered.'
                        })
                    );

                    setPrintState(false);
                });
        }, 10);
    };

    const printDocument = () => {
        setPrintState(true);
        setTimeout(() => {
            const elem = document.getElementById('export-pdf') as HTMLElement;
            const options = {
                filename: `SavingsCalculator-${Date.now()}.pdf`,
                compression: 'MEDIUM'
            };
            // @ts-ignore
            downloadPdf(elem, options, (pdf: any) => {
                setPrintState(false);
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: t('databases.explore-savings.pdf-download-success')
                    })
                );
            });
        }, 10);
    };

    const setManualBreadcrumbTitle = () => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS) {
            return 'Custom configuration for EBS';
        }
        return 'Custom configuration for FSx for Windows';
    };

    const getDynamicBreadcrumbTitle = () => {
        // For manual modes, use the manual breadcrumb title
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
        ) {
            return setManualBreadcrumbTitle();
        }

        // For AUTO_EBS mode with bulk selection capability
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && selectedRowsForExploreSavingsEBSBulk) {
            if (selectedRowsForExploreSavingsEBSBulk.length > 1) {
                return `${selectedRowsForExploreSavingsEBSBulk.length} hosts selected`;
            }
            if (selectedRowsForExploreSavingsEBSBulk.length === 1) {
                return selectedRowsForExploreSavingsEBSBulk[0]?.name || selectedServerName;
            }
        }

        // For Oracle on-prem mode
        if (isOracleOnPrem) {
            return selectedServerName || selectedOnPremHostDetails?.resourceName;
        }

        // Fallback to original selectedServerName for other modes
        return selectedServerName;
    };

    const setCSSForTextArea = () => {
        if (isOnPremMode) {
            return `${styles.selectionArea} ${styles.selectionAreaOnPrem}`;
        }
        return styles.selectionArea;
    };

    const handleOpenCard = () => {
        setIsCardOpen(!isCardOpen);
    };

    const setFirstContainerClass = () => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW) {
            if (printState) {
                return `${styles.firstContainer} ${styles.classForManualFsx} ${styles.classForPrint}`;
            }
            return `${styles.firstContainer} ${styles.classForManualFsx}`;
        }
        if (printState) {
            return `${styles.firstContainer} ${styles.classForPrint}`;
        }
        return `${styles.firstContainer} `;
    };

    const handleOptimizeLinkButton = () => {
        dispatch(setShowOptimizeModal(true));
    };
    return (
        <div style={{ height: 'inherit', overflow: 'auto', backgroundColor: 'var(--main-background)' }}>
            {/* Oracle API handler component - conditionally rendered */}
            {isOracleOnPrem && <OracleSavingsCalculatorApi />}
            <div className="scrollArea">
                <div className={styles.savingsCalculator} id="export-pdf">
                    {statusCheck ? (
                        <div className={styles.breadCrumb}>
                            <BreadCrumbs
                                items={[
                                    {
                                        title: t('databases.explore-savings.explore-savings-title'),
                                        onClick: () => {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.EXPLORE_SAVINGS));
                                            dispatch(addExploreSavingsInitialData(null));
                                            dispatch(setSelectedRowsForExploreSavingsEBSBulk([]));
                                            postBlueXPMessage({
                                                type: BlueXPListeners.navigate,
                                                payload: {
                                                    pathname: `${
                                                        isWorkloadFactory
                                                            ? './explore-savings'
                                                            : '../../fsxdb/exploreSaving'
                                                    }`,
                                                    replace: true
                                                }
                                            });
                                        }
                                    },
                                    {
                                        title: getDynamicBreadcrumbTitle()
                                    }
                                ]}
                            />
                        </div>
                    ) : (
                        <div style={{ marginBottom: '40px' }} />
                    )}

                    <div
                        className={
                            isOnPremMode
                                ? `${styles.savingsHeading} ${styles.savingsHeadingOnPremise}`
                                : styles.savingsHeading
                        }
                    >
                        <DsTypography variant="Regular_24" style={{ width: '100%' }}>
                            {t('databases.explore-savings.savings-calculator')}
                        </DsTypography>
                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && showOptimizeLink && (
                            <div className={styles.optimizeLinkContainer}>
                                <LightIcon />
                                <DsButton type="text" onClick={handleOptimizeLinkButton}>
                                    {t('databases.explore-savings.optimize-your-calculation')}
                                </DsButton>
                            </div>
                        )}
                        {(!statusData || statusData?.isActive === false) &&
                            (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW) && (
                                <DsButton
                                    ref={buttonRef}
                                    onClick={() => {
                                        handleOpenCard();
                                    }}
                                    type="text"
                                    icon={<CalculateIcon />}
                                >
                                    Calculate savings based on existing resources
                                </DsButton>
                            )}

                        {isCardOpen && (
                            <CalculateSavingCard
                                buttonRef={buttonRef}
                                setIsCardOpen={setIsCardOpen}
                                savingsCalculatorFrom={savingsCalculatorFrom}
                            />
                        )}
                    </div>

                    {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && showOptimizeMode?.showCalcMode && (
                        <div className={styles.optimizeModeContainer}>
                            <CalculatorMode />
                        </div>
                    )}

                    <div
                        className={
                            isOnPremMode ? `${styles.contentArea} ${styles.contentAreaOnPremise}` : styles.contentArea
                        }
                    >
                        {/* Left side code here */}
                        {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES && !isOracleOnPrem && (
                            <div className={setFirstContainerClass()}>
                                {(savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW) && (
                                    <>
                                        <SavingsHeader />
                                        <SavingsSelection printState={printState} />

                                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && <TCOBulkAccordion />}

                                        {/* Condition for EBS TCO Bulk for Auto - accordions to be displayed */}
                                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW && (
                                            <>
                                                <SavingsSelectedHost />
                                                <InstanceInformation />
                                                <WindowFileServer />
                                            </>
                                        )}
                                    </>
                                )}
                                {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS && (
                                    <>
                                        <SavingsHeader />
                                        <div style={{ padding: '40px' }}>
                                            <ManualTCOFields printState={printState} />
                                            <ManualEC2 />
                                            <ManualVolumeTypes />
                                            {selectedManualDeploymentModel?.label ===
                                                'Always on availability group' && <ManualTCOAccordion />}
                                        </div>
                                    </>
                                )}

                                {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW && (
                                    <>
                                        <SavingsHeader />
                                        <div style={{ padding: '40px' }}>
                                            <ManualTCOFields printState={printState} />
                                            <ManualTCOFSXFields printState={printState} />
                                            <ManualFSXEC2 />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {isOnPremMode && (
                            <div
                                className={
                                    printState
                                        ? `${styles.onPremiseContainer} ${styles.classForPrintOnPrem}`
                                        : `${styles.onPremiseContainer} `
                                }
                            >
                                <SavingsHeader />
                                <OnPremRegion />

                                {(isOracleOnPrem ||
                                    (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM &&
                                        selectedRowsForExploreSavingsOnPremBulk.length >= 1)) && (
                                    <>
                                        <SavingsSelection printState={printState} />
                                        <TCOOnPremBulkAccordion printState={printState} />
                                    </>
                                )}
                            </div>
                        )}

                        {/* Right side code here */}

                        <div className={styles.secondContainer}>
                            <div className={styles.firstSection}>
                                <CostSavings disableState={disableState} />
                            </div>
                            <div className={styles.secondSection}>
                                <TotalMonthlyCost disableState={disableState} />
                            </div>
                            <div className={styles.secondSection}>
                                <CostBreakdown disableState={disableState} />
                            </div>
                        </div>
                    </div>

                    {/* Text Area */}

                    <div className={setCSSForTextArea()}>
                        <div>{isMutliFsx ? <SuggestionDisable /> : <Suggestion />}</div>
                        <div className={styles.textContent}>
                            <DsTypography variant="Semibold_16" className={isMutliFsx ? styles.textDisable : ''}>
                                {t('databases.explore-savings.mssql-selection-based-text')}
                            </DsTypography>
                            <DsTypography
                                variant="Regular_14"
                                className={
                                    isMutliFsx ? `${styles.secondText} ${styles.textDisable}` : styles.secondText
                                }
                            >
                                {isOracleOnPrem
                                    ? t('databases.explore-savings.oracle-ec2-single-fsx')
                                    : t('databases.explore-savings.mssql-selection-based-second-text')}
                            </DsTypography>
                        </div>
                    </div>

                    {/* Accordion here - MSSQLAccordion handles both MSSQL and Oracle */}

                    <MSSQLAccordion printState={printState} disableState={disableState} isMutliFsx={isMutliFsx} />
                </div>

                {/* last section */}
                <ExportPDF
                    printDocument={printDocument}
                    disableState={disableState}
                    isMutliFsx={isMutliFsx}
                    sendEmail={sendEmail}
                    emailStatus={printState}
                />
            </div>

            {showOptimizedModal && savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && <OptimizedModel />}
        </div>
    );
};

export default SavingsCalculator;
