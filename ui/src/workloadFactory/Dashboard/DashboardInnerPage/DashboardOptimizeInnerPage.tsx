import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { ASSESSMENT_CONFIG_NAMES, WLF_TABS } from '../../../utils/consts';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../store/storeHooks';
import { DsTypography } from '@netapp/design-system';
import CloneTabs from '../../GetWell/OptimizeInnerPage/CloneTabs';
import OptimizeCard from '../../GetWell/OptimizeInnerPage/OptimizeCard/OptimizeCard';
import TagComponent from './TagComponent/TagComponent';

const DashboardOptimizeInnerPage = () => {
    const dispatch = useDispatch();
    const { selectedConfig } = useAppSelector(state => state.databaseHome);

    return (
        <>
            <div className={styles.dashboardInnerPage}>
                <div className={styles.innerPage}>
                    <div className={commonStyles.commonBreadCrumb}>
                        <BreadCrumbs
                            items={[
                                {
                                    title: 'Dashboard',
                                    onClick: () => {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                                    }
                                },
                                {
                                    title: `Fix configuration (${selectedConfig})`,
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
                            {selectedConfig}
                        </DsTypography>
                        <DsTypography
                            data-testid={`wlm-db-manage-instance-optimization-heading-for-${selectedConfig
                                .toLowerCase()
                                .replace(/ /g, '-')}`}
                            variant="Semibold_16"
                        >
                            Manage instance fixing
                        </DsTypography>
                    </div>

                    <div className={styles.mainSection}>
                        <div className={styles.contentSection}>
                            {/* Dashboard flow */}
                            <OptimizeCard fromPage={WLF_TABS.DASHBOARD} recommendationHeight={'auto'} />
                        </div>

                        <div className={styles.tagSection}>
                            <TagComponent tagHeight={'236px'} type={selectedConfig} />
                        </div>
                    </div>

                    {selectedConfig === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT && (
                        <CloneTabs fromPage={WLF_TABS.DASHBOARD} />
                    )}
                </div>
            </div>
        </>
    );
};

export default DashboardOptimizeInnerPage;
