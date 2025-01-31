import { AccordionController, DsTypography } from '@netapp/design-system';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useDispatch } from 'react-redux';
import styles from './ViewCalculations.module.scss';
import { FSX_AZ_TYPE, SAVINGS_CALC_MODE, WLF_TABS } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { addExploreSavingsInitialData } from '../../../store/workloadFactory/exploreSavingsSlice';
import SnapshotsEBSCalculation from './EBSCalculation/SnapshotsEBSCalculation/SnapshotsEBSCalculation';
import ClonesEBSCalculation from './EBSCalculation/ClonesEBSCalculation/ClonesEBSCalculation';
import SnapshotsOntapCalculation from './OntapCalculation/SnapshotsOntapCalculation/SnapshotsOntapCalculation';
import ClonesOntapCalculation from './OntapCalculation/ClonesOntapCalculation/ClonesOntapCalculation';
import ElasticBlockStorageCalculation from './EBSCalculation/ElasticBlockStorageCalculation/ElasticBlockStorageCalculation';
import FsxnSazCalculation from './OntapCalculation/FsxnSazCalculation/FsxnSazCalculation';
import FsxnMazCalculation from './OntapCalculation/FsxnMazCalculation/FsxnMazCalculation';
import InstancesEbsCalculation from './EBSCalculation/InstancesEbsCalculation/InstancesEbsCalculation';
import InstancesOntapCalculation from './OntapCalculation/InstancesOntapCalculation/InstancesOntapCalculation';
import TotalMonthlyCostOntapCalculation from './OntapCalculation/TotalMonthlyCostOntapCalculation/TotalMonthlyCostOntapCalculation';
import TotalMonthlyCostEbsCalculation from './EBSCalculation/TotalMonthlyCostEbsCalculation/TotalMonthlyCostEbsCalculation';
import InstancesFsxwCalculation from './FSxWCalculation/InstancesFsxwCalculation/InstancesFsxwCalculation';
import FsxwSazCalculation from './FSxWCalculation/FsxwSazCalculation/FsxwSazCalculation';
import ClonesFsxwCalculation from './FSxWCalculation/ClonesFsxwCalculation/ClonesFsxwCalculation';
import TotalMonthlyCostFsxwCalculation from './FSxWCalculation/TotalMonthlyCostFsxwCalculation/TotalMonthlyCostFsxwCalculation';
import ShadowCopyFsxwCalculation from './FSxWCalculation/ShadowCopyFsxwCalculation/ShadowCopyFsxwCalculation';
import FsxwMazCalculation from './FSxWCalculation/FsxwMazCalculation/FsxwMazCalculation';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';

const ViewCalculations = ({ statusCheck }: any) => {
    const dispatch = useDispatch();
    const selectedServerName = useAppSelector(state => state.exploreSavings.selectedServerName);
    const { viewCalculationsResponse, savingsCalculatorFrom } = useAppSelector(state => state.exploreSavings);

    return (
        <div className={styles.viewCalculations}>
            <div className={styles.breadCrumb}>
                {statusCheck ? (
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
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
                                        ? 'Explore savings manually'
                                        : selectedServerName,
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
                                }
                            },
                            {
                                title: GENERAL.VIEW_CALCS
                            }
                        ]}
                    />
                ) : (
                    <BreadCrumbs
                        items={[
                            {
                                title:
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
                                        ? 'Explore savings manually'
                                        : selectedServerName,
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
                                }
                            },
                            {
                                title: GENERAL.VIEW_CALCS
                            }
                        ]}
                    />
                )}
            </div>

            {/* Accordion section */}
            <div className={styles.mainSection}>
                <div className={styles.headingArea}>
                    <div className={styles.topHeading}>
                        <DsTypography variant="Semibold_24">{GENERAL.COST_CALCULATION}</DsTypography>
                        <DsTypography variant="Regular_14" style={{ marginBottom: '4px' }}>
                            {GENERAL.VIEW_CALC_TEXT}
                        </DsTypography>

                        <DsTypography variant="Regular_14" style={{ marginBottom: '40px', fontWeight: '500' }}>
                            {GENERAL.VIEW_CAL_SECONDARY_TEXT}
                        </DsTypography>
                    </div>
                    <div></div>
                </div>

                <AccordionController isGrouped={false}>
                    <div className={styles.calcSection}>
                        <div>
                            <DsTypography variant="Regular_14" style={{ marginBottom: '14px', fontWeight: '500' }}>
                                {GENERAL.MS_ONTAP_CALCULATION}
                            </DsTypography>
                            <InstancesOntapCalculation />
                            {viewCalculationsResponse?.azType === FSX_AZ_TYPE.SINGLE ? (
                                <FsxnSazCalculation />
                            ) : (
                                <FsxnMazCalculation />
                            )}
                            <SnapshotsOntapCalculation />
                            <ClonesOntapCalculation />
                            <TotalMonthlyCostOntapCalculation />
                        </div>

                        {(savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) && (
                            <div>
                                <DsTypography variant="Regular_14" style={{ marginBottom: '14px', fontWeight: '500' }}>
                                    {GENERAL.MS_EBS_CALCULATION}
                                </DsTypography>
                                <InstancesEbsCalculation />
                                <ElasticBlockStorageCalculation />
                                <SnapshotsEBSCalculation />
                                <ClonesEBSCalculation />
                                <TotalMonthlyCostEbsCalculation />
                            </div>
                        )}
                        {(savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
                            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW) && (
                            <div>
                                <DsTypography variant="Regular_14" style={{ marginBottom: '14px', fontWeight: '500' }}>
                                    {GENERAL.MS_FSXW_CALCULATION}
                                </DsTypography>
                                <InstancesFsxwCalculation />
                                {viewCalculationsResponse?.azType === FSX_AZ_TYPE.SINGLE ? (
                                    <FsxwSazCalculation />
                                ) : (
                                    <FsxwMazCalculation />
                                )}
                                <ShadowCopyFsxwCalculation />
                                <ClonesFsxwCalculation />
                                <TotalMonthlyCostFsxwCalculation />
                            </div>
                        )}
                    </div>
                </AccordionController>
            </div>
        </div>
    );
};

export default ViewCalculations;
