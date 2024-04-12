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

const SavingsCalculator = () => {
    const dispatch = useDispatch();
    return (
        <div className={styles.savingsCalculator}>
            <div className={styles.breadCrumb}>
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

            <div className={styles.savingsHeading}>
                <DsTypography variant="Regular_24">Savings Calculator</DsTypography>
                <div />
            </div>

            <div className={styles.contentArea}>
                {/* Left side code here */}
                <div className={styles.firstContainer}>
                    <SavingsHeader />
                    <SavingsSelection />
                </div>

                {/* Right side code here */}
                <div className={styles.secondContainer}>
                    <div className={styles.firstSection}>
                        <CostSavings />
                    </div>
                    <div className={styles.secondSection}>
                        <TotalMonthlyCost />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SavingsCalculator;
