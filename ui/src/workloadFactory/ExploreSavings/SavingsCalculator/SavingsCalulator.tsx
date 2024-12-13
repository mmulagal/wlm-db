import { useDispatch } from 'react-redux';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './SavingsCalculator.module.scss';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../utils/consts';
import { BlueXPListeners, DsTypography, postBlueXPMessage } from '@netapp/design-system';
import CostSavings from './CostSavings/CostSavings';
import TotalMonthlyCost from '../TotalMonthlyCost/TotalMonthlyCost';
import SavingsHeader from './SavingsHeader/SavingsHeader';
import SavingsSelection from './SavingsSelection/SavingsSelection';
import CostBreakdown from './CostBreakdown/CostBreakdown';
import SavingsSelectedHost from './SavingsSelectedHost/SavingsSelectedHost';
import InstanceInformation from './InstanceInformation/InstanceInformation';
import SelectedVolumeSummary from './SelectedVolumeSummary/SelectedVolumeSummary';
import { ReactComponent as Suggestion } from '../../../assets/Suggestion.svg';
import { ReactComponent as SuggestionDisable } from '../../../assets/SuggestionDisable.svg';
import MSSQLAccordion from './MSSQLAccordion/MSSQLAccordion';
import { useEffect, useState } from 'react';
//@ts-ignore
import domToPdf from 'dom-to-pdf';
import ExportPDF from './ExportPDF/ExportPDF';
import { GENERAL } from '../../../utils/appConstants';
import {
    addExploreSavingsInitialData,
    setStorageSavingsResponse,
    setViewCalculationsResponse
} from '../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../store/storeHooks';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import ManualTCOFields from './ManualTCOFields/ManualTCOFields';
import ManualEC2 from './ManualEC2/ManualEC2';
import ManualVolumeTypes from './ManualVolumeTypes/ManualVolumeTypes';
import ManualTCOAccordion from './ManualTCOAccordion/ManualTCOAccordion';

import { formatStorageSavingsRecommendedData, formatViewCalcData } from '../ExploreSavingsUtils';
import ManualTCOFSXFields from './ManualTCOFSXFields/ManualTCOFSXFields';
import ManualFSXEC2 from './ManualFSXEC2/ManualFSXEC2';
import WindowFileServer from './WindowFileServer/WindowFileServer';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import ComputeInformation from './ComputeInformation/ComputeInformation';
import StoragePerformance from './StoragePerformance/StoragePerformance';
import OnPremRegion from './OnPremRegion/OnPremRegion';

const SavingsCalculator = ({ statusCheck }: any) => {
    const dispatch = useDispatch();
    const [printState, setPrintState] = useState(false);
    // const [disableState, setDisableState] = useState(false);
    const [isMutliFsx, setIsMutliFsx] = useState(false);

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
        selectedExploreSavingsTab
    } = useAppSelector(state => state.exploreSavings);

    const { isWorkloadFactory } = useAppSelector(state => state.auth);

    useEffect(() => {
        dispatch(setStorageSavingsResponse(formatStorageSavingsRecommendedData(storageSavingsResponse)));
        if (viewCalculationsApiResponse) {
            dispatch(
                setViewCalculationsResponse(
                    formatViewCalcData(viewCalculationsApiResponse, selectedDeploymentModel, monthlyChangeRate)
                )
            );
        } else {
            dispatch(setViewCalculationsResponse(null));
        }
    }, [recommendedTargetInstance]);

    useEffect(() => {
        const requiredNumOfFsx = viewCalculationsResponse?.fsxOntapCalculation?.requiredNumOfFsx;
        if (requiredNumOfFsx && Number(requiredNumOfFsx) > 1) {
            setIsMutliFsx(true);
        } else {
            setIsMutliFsx(false);
        }
    }, [viewCalculationsResponse]);

    const printDocument = () => {
        setPrintState(true);
        setTimeout(() => {
            const elem = document.getElementById('export-pdf') as HTMLElement;
            var options = {
                filename: `SavingsCalculator.pdf`,
                compression: 'MEDIUM'
            };
            domToPdf(elem, options, (pdf: any) => {
                setPrintState(false);
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: GENERAL.PDF_DOWNLOAD_SUCCESS
                    })
                );
            });
        }, 10);
    };

    const setManualBreadcrumbTitle = () => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS) {
            return 'Custom configuration for EBS';
        } else {
            return 'Custom configuration for FSx for Windows';
        }
    };
    return (
        <div style={{ height: 'inherit', overflow: 'auto', backgroundColor: 'var(--main-background)' }}>
            <div className="scrollArea">
                <div className={styles.savingsCalculator} id="export-pdf">
                    {statusCheck ? (
                        <div className={styles.breadCrumb}>
                            <BreadCrumbs
                                items={[
                                    {
                                        title: GENERAL.ES_SAVINGS,
                                        onClick: () => {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.EXPLORE_SAVINGS));
                                            dispatch(addExploreSavingsInitialData(null));
                                            postBlueXPMessage({
                                                type: BlueXPListeners.navigate,
                                                payload: {
                                                    pathname: `${
                                                        isWorkloadFactory
                                                            ? './explore-savings'
                                                            : '../../fsxdb/explore-savings'
                                                    }`,
                                                    replace: true
                                                }
                                            });
                                        }
                                    },
                                    {
                                        title:
                                            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                                            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
                                                ? setManualBreadcrumbTitle()
                                                : selectedServerName
                                    }
                                ]}
                            />
                        </div>
                    ) : (
                        <div style={{ marginBottom: '40px' }}></div>
                    )}

                    <div className={styles.savingsHeading}>
                        <DsTypography variant="Regular_24">{GENERAL.SAVINGS_CALCULATOR}</DsTypography>
                        <div />
                    </div>

                    <div
                        className={styles.contentArea}
                        style={{
                            width: selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES ? '1607px' : '1336px'
                        }}
                    >
                        {/* Left side code here */}
                        {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES && (
                            <div
                                className={
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
                                        ? `${styles.firstContainer} ${styles.classForManualFsx}`
                                        : styles.firstContainer
                                }
                            >
                                {(savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW) && (
                                    <>
                                        <SavingsHeader />
                                        <SavingsSelection printState={printState} />
                                        <SavingsSelectedHost />
                                        <InstanceInformation />
                                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && (
                                            <SelectedVolumeSummary />
                                        )}
                                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW && <WindowFileServer />}
                                    </>
                                )}
                                {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS && (
                                    <>
                                        <SavingsHeader />
                                        <div style={{ padding: '40px' }}>
                                            <ManualTCOFields />
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
                                            <ManualTCOFields />
                                            <ManualTCOFSXFields />
                                            <ManualFSXEC2 />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                            <div className={`${styles.onPremiseContainer} `}>
                                <>
                                    <SavingsHeader />
                                    <OnPremRegion />
                                    <SavingsSelectedHost />
                                    <InstanceInformation />
                                    <ComputeInformation />
                                    <StoragePerformance />
                                </>
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

                    <div className={styles.selectionArea}>
                        <div>{isMutliFsx ? <SuggestionDisable /> : <Suggestion />}</div>
                        <div className={styles.textContent}>
                            <DsTypography variant="Semibold_16" className={isMutliFsx ? styles.textDisable : ''}>
                                {GENERAL.SELECTION_BASED_TEXT}
                            </DsTypography>
                            <DsTypography
                                variant="Regular_14"
                                className={
                                    isMutliFsx ? `${styles.secondText} ${styles.textDisable}` : styles.secondText
                                }
                            >
                                {GENERAL.SELECTION_BASED_SECOND}
                            </DsTypography>
                        </div>
                    </div>

                    {/* Accordion here */}
                    <MSSQLAccordion printState={printState} disableState={disableState} isMutliFsx={isMutliFsx} />
                </div>

                {/* last section */}
                <ExportPDF printDocument={printDocument} disableState={disableState} isMutliFsx={isMutliFsx} />
            </div>
        </div>
    );
};

export default SavingsCalculator;
