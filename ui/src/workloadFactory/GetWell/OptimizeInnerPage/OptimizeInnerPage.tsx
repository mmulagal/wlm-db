import { DsTypography } from '@netapp/design-system';
import styles from './OptimizeInnerPage.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useDispatch } from 'react-redux';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { WLF_TABS } from '../../../utils/consts';
import OptimizeCard from './OptimizeCard/OptimizeCard';

const OptimizeInnerPage = () => {
    const dispatch = useDispatch();
    return (
        <div className={styles['optimize-inner-page']}>
            <div className={styles.innerPage}>
                <div className={commonStyles.commonBreadCrumb}>
                    <BreadCrumbs
                        items={[
                            {
                                title: 'Inventory',
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                                }
                            },
                            {
                                title: `Host name / Instance name`,
                                dataTestId: 'wlm-db-optimize-configuration'
                            },
                            {
                                title: `Storage tier`,
                                dataTestId: 'wlm-db-storage-tier'
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography data-testid={`wlm-db-$`} variant="Semibold_20">
                        Storage tier
                    </DsTypography>
                    <DsTypography
                        // data-testid={`wlm-db-manage-instance-optimization-heading-for-${selectedConfig
                        //     .toLowerCase()
                        //     .replace(/ /g, '-')}`}
                        variant="Semibold_16"
                    >
                        Manage instance optimization
                    </DsTypography>
                </div>

                <div className={styles.contentSection}>
                    <OptimizeCard />
                </div>
            </div>
        </div>
    );
};

export default OptimizeInnerPage;
