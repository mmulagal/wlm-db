import { useDispatch } from 'react-redux';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './SavingsCalculator.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import { WLF_TABS } from '../../../utils/consts';
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
import { useState } from 'react';
//@ts-ignore
import domToPdf from 'dom-to-pdf';
import ExportPDF from './ExportPDF/ExportPDF';
import { GENERAL } from '../../../utils/appConstants';
import { addExploreSavingsInitialData } from '../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../store/storeHooks';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';

const SavingsCalculator = () => {
    const dispatch = useDispatch();
    const [printState, setPrintState] = useState(false);
    const selectedServerName = useAppSelector(state => state.exploreSavings.selectedServerName);

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
                                    title: selectedServerName
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
                            <SavingsHeader />
                            <SavingsSelection printState={printState} />
                            <SavingsSelectedHost />
                            <InstanceInformation />
                            <SelectedVolumeSummary />
                        </div>

                        {/* Right side code here */}
                        <div className={styles.secondContainer}>
                            <div className={styles.firstSection}>
                                <CostSavings />
                            </div>
                            <div className={styles.secondSection}>
                                <TotalMonthlyCost />
                            </div>
                            <div className={styles.secondSection}>
                                <CostBreakdown />
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
                    <MSSQLAccordion printState={printState} />
                </div>

                {/* last section */}
                <ExportPDF printDocument={printDocument} />
            </div>
        </div>
    );
};

export default SavingsCalculator;
