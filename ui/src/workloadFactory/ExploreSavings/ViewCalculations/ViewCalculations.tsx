import { AccordionController, DsTypography } from '@netapp/design-system';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useDispatch } from 'react-redux';
import styles from './ViewCalculations.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import { WLF_TABS } from '../../../utils/consts';
import OntapCalculation from './OntapCalculation/OntapCalculation';
import EBSCalculation from './EBSCalculation/EBSCalculation';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';

const ViewCalculations = () => {
    const dispatch = useDispatch();
    const selectedServerName = useAppSelector(state => state.exploreSavings.selectedServerName);

    return (
        <div className={styles.viewCalculations}>
            <div className={styles.breadCrumb}>
                <BreadCrumbs
                    items={[
                        {
                            title: GENERAL.ES_SAVINGS,
                            onClick: () => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.EXPLORE_SAVINGS));
                            }
                        },
                        {
                            title: selectedServerName,
                            onClick: () => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
                            }
                        },
                        {
                            title: GENERAL.VIEW_CALCS
                        }
                    ]}
                />
            </div>

            {/* Accordion section */}
            <div className={styles.mainSection}>
                <div className={styles.headingArea}>
                    <div>
                        <DsTypography variant="Semibold_24" className={styles.accordionContainer}>
                            {GENERAL.COST_CALCULATION}
                        </DsTypography>
                        <DsTypography variant="Regular_14" style={{ marginBottom: '4px' }}>
                            {GENERAL.VIEW_CALC_TEXT}
                        </DsTypography>

                        <DsTypography variant="Regular_14" style={{ marginBottom: '24px', fontWeight: '500' }}>
                            {GENERAL.VIEW_CAL_SECONDARY_TEXT}
                        </DsTypography>
                    </div>
                    <div></div>
                </div>
                <div className={styles.accordionContainer}>
                    <AccordionController isGrouped>
                        <OntapCalculation />
                        <EBSCalculation />
                    </AccordionController>
                </div>
            </div>
        </div>
    );
};

export default ViewCalculations;
