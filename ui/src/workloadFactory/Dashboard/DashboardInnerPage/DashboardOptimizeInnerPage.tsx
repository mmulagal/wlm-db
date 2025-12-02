import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
import { useMemo } from 'react';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import { ASSESSMENT_CONFIG_NAMES, WLF_TABS } from '../../../utils/consts';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../store/storeHooks';
import CloneTabs from '../../GetWell/OptimizeInnerPage/CloneTabs';
import OptimizeCard from '../../GetWell/OptimizeInnerPage/OptimizeCard/OptimizeCard';
import TagComponent from './TagComponent/TagComponent';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { engineTypeBasedResourceStr } from '../../WellArchitectedTab/WellArchitectedTabUtils';

const DashboardOptimizeInnerPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedConfig } = useAppSelector(state => state.databaseHome);
    const { configEngineType } = useAppSelector(state => state.getWellOptimize);

    const selectedConfigName = useMemo(() => {
        if (selectedConfig === ASSESSMENT_CONFIG_NAMES.CRR) {
            return 'Cross-Region Replication (CRR)';
        }
        return selectedConfig;
    }, [selectedConfig]);

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
                                title: `${t('databases.well-architect.fix-configuration')} (${selectedConfigName})`,
                                dataTestId: 'wlm-db-optimize-configuration',
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
                                }
                            },
                            {
                                title: `${selectedConfig}`,
                                dataTestId: 'wlm-db-optimize-configuration-clone'
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography
                        data-testid={`wlm-db-${selectedConfig.toLowerCase().replace(/ /g, '-')}`}
                        variant="Semibold_20"
                    >
                        {selectedConfigName}
                    </DsTypography>
                    <SeparatorComponent variant="vertical" height="24px" />
                    <DsTypography
                        data-testid={`wlm-db-manage-instance-optimization-heading-for-${selectedConfig
                            .toLowerCase()
                            .replace(/ /g, '-')}`}
                        variant="Regular_16"
                    >
                        {engineTypeBasedResourceStr(
                            configEngineType,
                            t('databases.well-architect.register-database-fixing'),
                            t('databases.well-architect.register-instance-fixing')
                        )}
                    </DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.contentSection}>
                        {/* Dashboard flow */}
                        <OptimizeCard fromPage={WLF_TABS.DASHBOARD} recommendationHeight="auto" />
                    </div>

                    <div className={styles.tagSection} style={{ width: '20%' }}>
                        <TagComponent tagHeight="236px" type={selectedConfig} />
                    </div>
                </div>

                {selectedConfig === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT && (
                    <CloneTabs fromPage={WLF_TABS.DASHBOARD} />
                )}
            </div>
        </div>
    );
};

export default DashboardOptimizeInnerPage;
