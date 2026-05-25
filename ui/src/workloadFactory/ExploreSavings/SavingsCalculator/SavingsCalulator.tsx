import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { BlueXPListeners, DsButton, DsTypography, postBlueXPMessage } from '@netapp/design-system';
import { useEffect, useRef, useState } from 'react';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './SavingsCalculator.module.scss';
import { DATABASE_DEPLOYMENT_MODE, DBType, DETECT_HOST_VAR, SAVINGS_CALC_MODE, WLF_TABS } from '../../../utils/consts';
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
import RecommendedAccordion from './RecommendedAccordion/RecommendedAccordion';

import ExportPDF from './ExportPDF/ExportPDF';
import downloadPdf from '../../../common/pdfGenerator';
import {
    addExploreSavingsInitialData,
    setShowOptimizeModal,
    setStorageSavingsResponse,
    setViewCalculationsResponse
} from '../../../store/workloadFactory/exploreSavingsSlice';
import {
    setSelectedRowsForExploreSavingsEBSBulk,
    setSelectedRowsForExploreSavingsOnPremBulk,
    setSelectedRowsForExploreSavingsOracleOnPremBulk,
    setSelectedRowsForExploreSavingsOracleEbsBulk
} from '../../../store/workloadFactory/exploreSavingsBulkSlice';
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
import OracleEbsSavingsCalculatorApi from '../OracleTCO/OracleSavingsCalculator/OracleEbsSavingsCalculatorApi';

const SavingsCalculator = ({ statusCheck }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [pdfCaptureMode, setPdfCaptureMode] = useState(false);
    const [isMutliFsx, setIsMutliFsx] = useState(false);
    const buttonRef: any = useRef(null);
    const [isCardOpen, setIsCardOpen] = useState(false);
    const savingsHeadingRef = useRef<HTMLDivElement>(null);
    const [headingWidth, setHeadingWidth] = useState<number | undefined>(undefined);
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
    const isOracleEbs = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
    const isOracleManualEbs = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS;
    const isOnPremMode =
        (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && !isOracleEbs && !isOracleManualEbs) ||
        isOracleOnPrem ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM;

    const {
        selectedRowsForExploreSavingsEBSBulk,
        selectedRowsForExploreSavingsOnPremBulk,
        selectedRowsForExploreSavingsOracleOnPremBulk,
        selectedRowsForExploreSavingsOracleEbsBulk
    } = useAppSelector(state => state.exploreSavingsBulk);

    const { isWorkloadFactory, userMetadata } = useAppSelector(state => state.auth);

    useEffect(() => {
        if (
            (!statusData || statusData?.isActive === false) &&
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS)
        ) {
            setIsCardOpen(true);
        } else {
            setIsCardOpen(false);
        }
    }, [savingsCalculatorFrom, statusData]);

    useEffect(() => {
        dispatch(setStorageSavingsResponse(formatStorageSavingsRecommendedData(storageSavingsResponse)));
        if (viewCalculationsApiResponse) {
            prepareViewCalcData(
                viewCalculationsApiResponse,
                dispatch,
                selectedDeploymentModel,
                monthlyChangeRate,
                selectedCalculatorMode
            );
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

    useEffect(() => {
        const el = savingsHeadingRef.current;
        if (!el) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setHeadingWidth(entry.contentRect.width);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const setEmailSubject = () => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
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

    const savingsCalculatorPdfOptions = (elem: HTMLElement) => ({
        filename: `SavingsCalculator-${Date.now()}.pdf`,
        compression: 'MEDIUM',
        overrideWidth: elem.clientWidth,
        excludeTagNames: ['button']
    });

    const sendEmail = async () => {
        setPdfCaptureMode(true);
        setTimeout(async () => {
            try {
                const elem = document.getElementById('export-pdf') as HTMLElement;
                const report = await downloadPdfEmail(elem, savingsCalculatorPdfOptions(elem), true, () => {});
                if (!report) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.explore-savings.pdf-download-error')
                        })
                    );
                    return;
                }

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

                const resp = await getSendEmail({ payload: formData });
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
            } catch {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: 'Calculation report was failed to be delivered.'
                    })
                );
            } finally {
                setPdfCaptureMode(false);
            }
        }, 500);
    };

    const printDocument = () => {
        setPdfCaptureMode(true);
        setTimeout(() => {
            const elem = document.getElementById('export-pdf') as HTMLElement;
            const options = savingsCalculatorPdfOptions(elem);
            // @ts-ignore
            downloadPdf(elem, options, (pdf: any) => {
                setPdfCaptureMode(false);
                if (pdf) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: t('databases.explore-savings.pdf-download-success')
                        })
                    );
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.explore-savings.pdf-download-error')
                        })
                    );
                }
            });
        }, 500);
    };

    const setManualBreadcrumbTitle = () => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS
        ) {
            return 'Custom configuration for EBS';
        }
        return 'Custom configuration for FSx for Windows';
    };

    const getDynamicBreadcrumbTitle = () => {
        // For manual modes, use the manual breadcrumb title
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS
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

        // For Oracle EBS mode (bulk or single)
        if (isOracleEbs && selectedRowsForExploreSavingsOracleEbsBulk) {
            if (selectedRowsForExploreSavingsOracleEbsBulk.length > 1) {
                return `${selectedRowsForExploreSavingsOracleEbsBulk.length} hosts selected`;
            }
            if (selectedRowsForExploreSavingsOracleEbsBulk.length === 1) {
                return selectedRowsForExploreSavingsOracleEbsBulk[0]?.name || selectedServerName;
            }
        }

        // For Oracle on-prem mode (bulk or single)
        if (isOracleOnPrem) {
            if (selectedRowsForExploreSavingsOracleOnPremBulk?.length > 1) {
                return `${selectedRowsForExploreSavingsOracleOnPremBulk.length} hosts selected`;
            }
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
            return `${styles.firstContainer} ${styles.classForManualFsx}`;
        }
        return styles.firstContainer;
    };

    const handleOptimizeLinkButton = () => {
        dispatch(setShowOptimizeModal(true));
    };
    return (
        <div
            style={{
                height: 'inherit',
                overflow: pdfCaptureMode ? 'hidden' : 'auto',
                backgroundColor: 'var(--main-background)'
            }}
        >
            {/* Oracle API handler components - conditionally rendered */}
            {isOracleOnPrem && <OracleSavingsCalculatorApi />}
            {isOracleEbs && <OracleEbsSavingsCalculatorApi />}
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
                                            dispatch(setSelectedRowsForExploreSavingsOnPremBulk([]));
                                            dispatch(setSelectedRowsForExploreSavingsOracleOnPremBulk([]));
                                            dispatch(setSelectedRowsForExploreSavingsOracleEbsBulk([]));
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
                        ref={savingsHeadingRef}
                        className={
                            isOnPremMode
                                ? `${styles.savingsHeading} ${styles.savingsHeadingOnPremise}`
                                : styles.savingsHeading
                        }
                    >
                        <DsTypography variant="Regular_24" style={{ width: '100%' }}>
                            {t('databases.explore-savings.savings-calculator')}
                        </DsTypography>
                        {(savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) &&
                            showOptimizeLink && (
                                <div className={styles.optimizeLinkContainer}>
                                    <LightIcon />
                                    <DsButton type="text" onClick={handleOptimizeLinkButton}>
                                        {t('databases.explore-savings.optimize-your-calculation')}
                                    </DsButton>
                                </div>
                            )}
                        {(!statusData || statusData?.isActive === false) &&
                            (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS) && (
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

                    {(savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) &&
                        showOptimizeMode?.showCalcMode && (
                            <div className={styles.optimizeModeContainer}>
                                <CalculatorMode printState={false} />
                            </div>
                        )}

                    <div
                        className={
                            isOnPremMode ? `${styles.contentArea} ${styles.contentAreaOnPremise}` : styles.contentArea
                        }
                    >
                        {/* Left side code here */}
                        {!isOnPremMode && (
                            <div className={setFirstContainerClass()}>
                                {(savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW) && (
                                    <>
                                        <SavingsHeader />
                                        <SavingsSelection printState={false} />

                                        {(savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                                            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) && (
                                            <TCOBulkAccordion printState={pdfCaptureMode} />
                                        )}

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
                                        <div className={styles.manualContentWrapper}>
                                            <ManualTCOFields printState={false} />
                                            <ManualEC2 printState={false} />
                                            <ManualVolumeTypes printState={false} />
                                            {selectedManualDeploymentModel?.label ===
                                                'Always on availability group' && <ManualTCOAccordion />}
                                        </div>
                                    </>
                                )}

                                {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW && (
                                    <>
                                        <SavingsHeader />
                                        <div className={styles.manualContentWrapper}>
                                            <ManualTCOFields printState={false} />
                                            <ManualTCOFSXFields printState={false} />
                                            <ManualFSXEC2 />
                                        </div>
                                    </>
                                )}

                                {savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS && (
                                    <>
                                        <SavingsHeader />
                                        <div className={styles.manualContentWrapper}>
                                            <ManualTCOFields printState={false} />
                                            <ManualEC2 printState={false} />
                                            <ManualVolumeTypes printState={false} />
                                            {selectedManualDeploymentModel?.label ===
                                                DATABASE_DEPLOYMENT_MODE.DATAGUARD && <ManualTCOAccordion />}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {isOnPremMode && (
                            <div className={styles.onPremiseContainer}>
                                <SavingsHeader />
                                <OnPremRegion />

                                {(isOracleOnPrem ||
                                    (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM &&
                                        selectedRowsForExploreSavingsOnPremBulk.length >= 1)) && (
                                    <>
                                        <SavingsSelection printState={pdfCaptureMode} />
                                        <TCOOnPremBulkAccordion printState={pdfCaptureMode} />
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

                    <div
                        className={setCSSForTextArea()}
                        style={headingWidth !== undefined ? { width: headingWidth } : undefined}
                    >
                        <div>
                            {isMutliFsx && !isOracleOnPrem && !isOracleEbs && !isOracleManualEbs ? (
                                <SuggestionDisable />
                            ) : (
                                <Suggestion />
                            )}
                        </div>
                        <div className={styles.textContent}>
                            <DsTypography
                                variant="Semibold_16"
                                className={
                                    isMutliFsx && !isOracleOnPrem && !isOracleEbs && !isOracleManualEbs
                                        ? styles.textDisable
                                        : ''
                                }
                            >
                                {t('databases.explore-savings.mssql-selection-based-text')}
                            </DsTypography>
                            <DsTypography
                                variant="Regular_14"
                                className={
                                    isMutliFsx && !isOracleOnPrem && !isOracleEbs && !isOracleManualEbs
                                        ? `${styles.secondText} ${styles.textDisable}`
                                        : styles.secondText
                                }
                            >
                                {isOracleOnPrem || isOracleEbs || isOracleManualEbs
                                    ? t('databases.explore-savings.oracle-ec2-single-fsx')
                                    : t('databases.explore-savings.mssql-selection-based-second-text')}
                            </DsTypography>
                        </div>
                    </div>

                    {/* Accordion here - RecommendedAccordion handles both MSSQL and Oracle */}

                    <RecommendedAccordion
                        printState={pdfCaptureMode}
                        disableState={disableState}
                        isMutliFsx={isMutliFsx}
                        width={headingWidth}
                    />
                </div>

                {/* last section */}
                <ExportPDF
                    printDocument={printDocument}
                    disableState={disableState}
                    isMutliFsx={isMutliFsx}
                    sendEmail={sendEmail}
                    emailStatus={pdfCaptureMode}
                    width={headingWidth}
                />
            </div>

            {showOptimizedModal &&
                (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) && <OptimizedModel />}
        </div>
    );
};

export default SavingsCalculator;
