import { useDispatch } from 'react-redux';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import './SavingsCalculator.scss';
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
import ExportPDF from './ExportPDF/ExportPDF';

const SavingsCalculator = () => {
    const dispatch = useDispatch();
    return (
        <div className={'savingsCalculator'} id="export-pdf">
            <div className={'breadCrumb'}>
                <BreadCrumbs
                    items={[
                        {
                            title: 'Explore savings',
                            onClick: () => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.EXPLORE_SAVINGS));
                            }
                        },
                        {
                            title: 'Host name'
                        }
                    ]}
                />
            </div>

            <div className={'savingsHeading'}>
                <DsTypography variant="Regular_24">Savings calculator</DsTypography>
                <div />
            </div>

            <div className={'contentArea'}>
                {/* Left side code here */}
                <div className={'firstContainer'}>
                    <SavingsHeader />
                    <SavingsSelection />
                    <SavingsSelectedHost />
                    <InstanceInformation />
                    <SelectedVolumeSummary />
                </div>

                {/* Right side code here */}
                <div className={'secondContainer'}>
                    <div className={'firstSection'}>
                        <CostSavings />
                    </div>
                    <div className={'secondSection'}>
                        <TotalMonthlyCost />
                    </div>
                    <div className={'secondSection'}>
                        <CostBreakdown />
                    </div>
                </div>
            </div>

            {/* Text Area */}
            <div className={'selectionArea'}>
                <div>
                    <Suggestion />
                </div>
                <div className={'textContent'}>
                    <DsTypography variant="Semibold_16">
                        Based on your selections, we recommend creating the following:
                    </DsTypography>
                    <DsTypography variant="Regular_14">
                        Microsoft SQL Server on AWS Ec2 using FSx for ONTAP file system
                    </DsTypography>
                </div>
            </div>

            {/* Accordion here */}
            <MSSQLAccordion />

            {/* last section */}
            <ExportPDF rootElementId="export-pdf" />
        </div>
    );
};

export default SavingsCalculator;
