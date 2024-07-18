import { useDispatch } from 'react-redux';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './SavingsCalculator.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../utils/consts';
import { DsTypography } from '@netapp/design-system';
import CostSavings from './CostSavings/CostSavings';
import TotalMonthlyCost from '../TotalMonthlyCost/TotalMonthlyCost';
import SavingsHeader from './SavingsHeader/SavingsHeader';
import SavingsSelection from './SavingsSelection/SavingsSelection';
import CostBreakdown from './CostBreakdown/CostBreakdown';
import SavingsSelectedHost from './SavingsSelectedHost/SavingsSelectedHost';
import InstanceInformation from './InstanceInformation/InstanceInformation';
import SelectedVolumeSummary from './SelectedVolumeSummary/SelectedVolumeSummary';
import { ReactComponent as Suggestion } from '../../../assets/Suggestion.svg';
import MSSQLAccordion from './MSSQLAccordion/MSSQLAccordion';
import { useEffect, useState } from 'react';
//@ts-ignore
import domToPdf from 'dom-to-pdf';
import ExportPDF from './ExportPDF/ExportPDF';
import { GENERAL } from '../../../utils/appConstants';
import {
    addExploreSavingsInitialData,
    setStorageSavingsLoading,
    setStorageSavingsResponse,
    setViewCalculationsLoading,
    setViewCalculationsResponse
} from '../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../store/storeHooks';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import ManualTCOFields from './ManualTCOFields/ManualTCOFields';
import ManualEC2 from './ManualEC2/ManualEC2';
import ManualVolumeTypes from './ManualVolumeTypes/ManualVolumeTypes';
import ManualTCOAccordion from './ManualTCOAccordion/ManualTCOAccordion';
import { useGetManualStorageSavingsMutation, useGetManualViewCalculationsMutation } from '../../../utils/apiService';
import { generateManualStorageSavingsPayload } from './savingsUtil';
import { formatViewCalcData } from '../ExploreSavingsUtils';

const SavingsCalculator = () => {
    const dispatch = useDispatch();
    const [printState, setPrintState] = useState(false);
    const [disableState, setDisableState] = useState(false);

    const [getManualStorageSavingsApi] = useGetManualStorageSavingsMutation();
    const [getManualViewCalculationsApi] = useGetManualViewCalculationsMutation();

    const {
        savingsCalculatorFrom,
        selectedServerName,
        numberOfClonedCopies,
        monthlyChangeRate,
        selectedManualDeploymentModel,
        selectedManualRegion,
        selectedManualServerEdition,
        selectedManualInstanceType,
        monthlyBYOLCost,
        manualMonthlyDescription,
        manualSecondaryMachineDescription,
        manualTCOVolumeTypes,
        volumeFilledStatus,
        manualTCOVolumeTypes2
    } = useAppSelector(state => state.exploreSavings);

    const getManualStorageSavingsData = async () => {
        const payload = generateManualStorageSavingsPayload();

        try {
            const result = await getManualStorageSavingsApi({
                regionId: selectedManualRegion?.data?.regionCode,
                payload: payload
            });
            dispatch(setStorageSavingsLoading(false));
            dispatch(setStorageSavingsResponse(result?.data));
        } catch (error) {
            dispatch(setStorageSavingsLoading(false));
        }
    };

    const getManualViewCalculationsData = async () => {
        const payload = generateManualStorageSavingsPayload();
        try {
            const result = await getManualViewCalculationsApi({
                regionId: selectedManualRegion?.data?.regionCode,
                payload: payload
            });
            dispatch(
                setViewCalculationsResponse(
                    formatViewCalcData(result?.data, selectedManualDeploymentModel?.label, monthlyChangeRate)
                )
            );
            dispatch(setViewCalculationsLoading(false));
        } catch (error) {
            dispatch(setViewCalculationsLoading(false));
        }
    };

    const triggerManualStorageAPI = () => {
        dispatch(setStorageSavingsLoading(true));
        dispatch(setViewCalculationsLoading(true));
        getManualStorageSavingsData();
        getManualViewCalculationsData();
    };

    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL) {
            if (
                selectedManualRegion &&
                numberOfClonedCopies &&
                monthlyChangeRate &&
                volumeFilledStatus &&
                selectedManualInstanceType
            ) {
                setDisableState(false);
                triggerManualStorageAPI();
            } else {
                setDisableState(true);
            }
        } else {
            setDisableState(false);
        }
    }, [
        savingsCalculatorFrom,
        numberOfClonedCopies,
        monthlyChangeRate,
        selectedManualDeploymentModel,
        selectedManualRegion,
        selectedManualServerEdition,
        selectedManualInstanceType,
        monthlyBYOLCost,
        manualMonthlyDescription,
        manualSecondaryMachineDescription,
        manualTCOVolumeTypes,
        volumeFilledStatus,
        manualTCOVolumeTypes2
    ]);

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
    return (
        <div style={{ height: '90vh', overflow: 'auto', backgroundColor: 'var(--main-background)' }}>
            <div className="scrollArea">
                <div className={styles.savingsCalculator} id="export-pdf">
                    <div className={styles.breadCrumb}>
                        <BreadCrumbs
                            items={[
                                {
                                    title: GENERAL.ES_SAVINGS,
                                    onClick: () => {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.EXPLORE_SAVINGS));
                                        dispatch(addExploreSavingsInitialData(null));
                                    }
                                },
                                {
                                    title:
                                        savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL
                                            ? 'Explore savings manually'
                                            : selectedServerName
                                }
                            ]}
                        />
                    </div>

                    <div className={styles.savingsHeading}>
                        <DsTypography variant="Regular_24">{GENERAL.SAVINGS_CALCULATOR}</DsTypography>
                        <div />
                    </div>

                    <div className={styles.contentArea}>
                        {/* Left side code here */}
                        <div className={styles.firstContainer}>
                            {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO && (
                                <>
                                    <SavingsHeader />
                                    <SavingsSelection printState={printState} />
                                    <SavingsSelectedHost />
                                    <InstanceInformation />
                                    <SelectedVolumeSummary />
                                </>
                            )}
                            {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL && (
                                <>
                                    <SavingsHeader />
                                    <div style={{ padding: '40px' }}>
                                        <ManualTCOFields />
                                        <ManualEC2 />
                                        <ManualVolumeTypes />
                                        {selectedManualDeploymentModel?.label === 'Always on availability group' && (
                                            <ManualTCOAccordion />
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

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
                        <div>
                            <Suggestion />
                        </div>
                        <div className={styles.textContent}>
                            <DsTypography variant="Semibold_16">{GENERAL.SELECTION_BASED_TEXT}</DsTypography>
                            <DsTypography variant="Regular_14" className={styles.secondText}>
                                {GENERAL.SELECTION_BASED_SECOND}
                            </DsTypography>
                        </div>
                    </div>

                    {/* Accordion here */}
                    <MSSQLAccordion printState={printState} disableState={disableState} />
                </div>

                {/* last section */}
                <ExportPDF printDocument={printDocument} disableState={disableState} />
            </div>
        </div>
    );
};

export default SavingsCalculator;
