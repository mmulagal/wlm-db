import { AccordionController, DsTypography } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './ViewCalculations.module.scss';
import { FSX_AZ_TYPE, SAVINGS_CALC_MODE, WLF_TABS } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { addExploreSavingsInitialData } from '../../../store/workloadFactory/exploreSavingsSlice';
import {
    setSelectedRowsForExploreSavingsEBSBulk,
    setSelectedRowsForExploreSavingsOnPremBulk,
    setSelectedRowsForExploreSavingsOracleOnPremBulk,
    setSelectedRowsForExploreSavingsOracleEbsBulk
} from '../../../store/workloadFactory/exploreSavingsBulkSlice';
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
    const { t } = useTranslation();
    const selectedServerName = useAppSelector(state => state.exploreSavings.selectedServerName);
    const { viewCalculationsResponse, savingsCalculatorFrom } = useAppSelector(state => state.exploreSavings);
    const {
        selectedRowsForExploreSavingsEBSBulk,
        selectedRowsForExploreSavingsOnPremBulk,
        selectedRowsForExploreSavingsOracleOnPremBulk,
        selectedRowsForExploreSavingsOracleEbsBulk
    } = useAppSelector(state => state.exploreSavingsBulk);

    const isOracleMode =
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS;

    const getDynamicBreadcrumbTitle = () => {
        // For manual modes, use the manual breadcrumb title
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS
        ) {
            return t('databases.explore-savings.view-calculation-breadcrumb-title-manual');
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

        // For ONPREM mode with bulk selection capability
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM && selectedRowsForExploreSavingsOnPremBulk) {
            if (selectedRowsForExploreSavingsOnPremBulk.length > 1) {
                return `${selectedRowsForExploreSavingsOnPremBulk.length} hosts selected`;
            }
            if (selectedRowsForExploreSavingsOnPremBulk.length === 1) {
                return selectedRowsForExploreSavingsOnPremBulk[0]?.resourceName || selectedServerName;
            }
        }

        // For ORACLE_ONPREM mode with bulk selection capability
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM) {
            if (selectedRowsForExploreSavingsOracleOnPremBulk?.length > 1) {
                return `${selectedRowsForExploreSavingsOracleOnPremBulk.length} hosts selected`;
            }
            if (selectedRowsForExploreSavingsOracleOnPremBulk?.length === 1) {
                return selectedRowsForExploreSavingsOracleOnPremBulk[0]?.resourceName || selectedServerName;
            }
            return selectedServerName || t('databases.explore-savings.oracle-on-premises-configuration');
        }

        // For ORACLE_AUTO_EBS mode with bulk selection capability
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS && selectedRowsForExploreSavingsOracleEbsBulk) {
            if (selectedRowsForExploreSavingsOracleEbsBulk.length > 1) {
                return `${selectedRowsForExploreSavingsOracleEbsBulk.length} hosts selected`;
            }
            if (selectedRowsForExploreSavingsOracleEbsBulk.length === 1) {
                return selectedRowsForExploreSavingsOracleEbsBulk[0]?.name || selectedServerName;
            }
        }

        return selectedServerName;
    };

    // Helper to get calculation labels based on savings calculator mode
    const getOntapCalculationLabel = () => {
        if (isOracleMode) {
            return t('databases.explore-savings.oracle-ontap-calculation');
        }
        return t('databases.explore-savings.mssql-ontap-calculation');
    };

    const getEbsCalculationLabel = () => {
        if (isOracleMode) {
            return t('databases.explore-savings.oracle-ebs-calculation');
        }
        return t('databases.explore-savings.mssql-ebs-calculation');
    };

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
                                    dispatch(setSelectedRowsForExploreSavingsEBSBulk([]));
                                    dispatch(setSelectedRowsForExploreSavingsOnPremBulk([]));
                                    dispatch(setSelectedRowsForExploreSavingsOracleOnPremBulk([]));
                                    dispatch(setSelectedRowsForExploreSavingsOracleEbsBulk([]));
                                }
                            },
                            {
                                title: getDynamicBreadcrumbTitle(),
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
                                title: getDynamicBreadcrumbTitle(),
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
                            {isOracleMode
                                ? t('databases.explore-savings.oracle-view-calc-text')
                                : t('databases.explore-savings.mssql-view-calc-text')}
                        </DsTypography>

                        <DsTypography variant="Regular_14" style={{ marginBottom: '40px', fontWeight: '500' }}>
                            {GENERAL.VIEW_CAL_SECONDARY_TEXT}
                        </DsTypography>
                    </div>
                    <div />
                </div>

                <AccordionController isGrouped={false}>
                    <div className={styles.calcSection}>
                        <div>
                            <DsTypography variant="Regular_14" style={{ marginBottom: '14px', fontWeight: '500' }}>
                                {getOntapCalculationLabel()}
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
                            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM ||
                            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM ||
                            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
                            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS) && (
                            <div>
                                <DsTypography variant="Regular_14" style={{ marginBottom: '14px', fontWeight: '500' }}>
                                    {getEbsCalculationLabel()}
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
