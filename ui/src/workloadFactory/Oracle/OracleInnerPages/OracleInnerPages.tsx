import { useDispatch } from 'react-redux';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import styles from './OracleInnerPages.module.scss';
import { WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import OracleTabs from './OracleTabs/OracleTabs';

const OracleInnerPages = () => {
    const dispatch = useDispatch();
    const { breadCrumbSelectedFrom } = useAppSelector(state => state.inventoryV2);
    return (
        <div className={styles['oracle-inner-pages']}>
            <div className={`${commonStyles.commonBreadCrumb} ${styles.breadCrumb}`} style={{ left: '0%' }}>
                <BreadCrumbs
                    items={[
                        {
                            title: breadCrumbSelectedFrom === WLF_TABS.INVENTORY ? 'Inventory' : 'Dashboard',
                            onClick: () => {
                                if (breadCrumbSelectedFrom === WLF_TABS.INVENTORY) {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                                } else {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                                }
                            }
                        },
                        {
                            title: 'Host name'
                        }
                    ]}
                />
            </div>

            <OracleTabs />
        </div>
    );
};

export default OracleInnerPages;
