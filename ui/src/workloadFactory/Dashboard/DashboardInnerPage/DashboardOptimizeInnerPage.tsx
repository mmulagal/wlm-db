import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
import { useMemo } from 'react';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import { ASSESSMENT_CONFIG_IDS, DBType, WLF_TABS } from '../../../utils/consts';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../store/storeHooks';
import CloneTabs from '../../GetWell/OptimizeInnerPage/CloneTabs';
import OptimizeCard from '../../GetWell/OptimizeInnerPage/OptimizeCard/OptimizeCard';
import TagComponent from './TagComponent/TagComponent';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { engineTypeBasedResourceStr } from '../../WellArchitectedTab/WellArchitectedTabUtils';
import { findFlatConfigItem } from '../../WellArchitectedTab/assessmentFormatUtils';

const DashboardOptimizeInnerPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedConfig } = useAppSelector(state => state.databaseHome);
    const { configEngineType } = useAppSelector(state => state.getWellOptimize);
    const { allmssqlHostAssessmentData, allOracleHostAssessmentData } = useAppSelector(state => state.inventoryV2);

    // Get full config item with categories from API data
    const configItem = useMemo(() => {
        if (!selectedConfig) return undefined;
        const hosts = configEngineType === DBType.ORACLE ? allOracleHostAssessmentData : allmssqlHostAssessmentData;
        return findFlatConfigItem(hosts, selectedConfig);
    }, [selectedConfig, configEngineType, allmssqlHostAssessmentData, allOracleHostAssessmentData]);

    return (
        <div className={styles.dashboardInnerPage}>
            <div className={styles.innerPage}>
                <div className={styles.breadCrumbSection}>
                    <BreadCrumbs
                        items={[
                            {
                                title: `${t('databases.general.well-architected')}`,
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.WELL_ARCHITECTED_TAB));
                                }
                            },
                            {
                                title: `${t('databases.well-architect.fix-configuration')} (${configItem?.name})`,
                                dataTestId: 'wlm-db-optimize-configuration',
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
                                }
                            },
                            {
                                title: `${configItem?.name}`,
                                dataTestId: 'wlm-db-optimize-configuration-clone'
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography
                        data-testid={`wlm-db-${configItem?.name?.toLowerCase().replace(/ /g, '-')}`}
                        variant="Semibold_20"
                    >
                        {configItem?.name}
                    </DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.contentSection}>
                        {/* Dashboard flow */}
                        <OptimizeCard fromPage={WLF_TABS.DASHBOARD} recommendationHeight="auto" />
                    </div>

                    <div className={styles.tagSection} style={{ width: '20%' }}>
                        <TagComponent tagHeight="236px" categories={configItem?.categories} />
                    </div>
                </div>

                {selectedConfig === ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT && (
                    <CloneTabs fromPage={WLF_TABS.DASHBOARD} engineType={configEngineType} />
                )}
            </div>
        </div>
    );
};

export default DashboardOptimizeInnerPage;
