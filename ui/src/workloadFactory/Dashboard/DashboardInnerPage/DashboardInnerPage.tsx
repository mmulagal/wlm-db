import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { DsTypography } from '@netapp/design-system';
import ValueCard from './ValueCard/ValueCard';
import TagComponent from './TagComponent/TagComponent';
import { useEffect, useState } from 'react';

const DashboardInnerPage = () => {
    const dispatch = useDispatch();
    const { selectedConfig } = useAppSelector(state => state.databaseHome);
    const [valueCardData, setValueCardData] = useState({
        optimizationScore: '',
        optimizedInstances: '',
        notOptimizedInstances: '',
        severity: ''
    });

    useEffect(() => {
        switch (selectedConfig) {
            case 'Storage tier':
                setValueCardData({
                    optimizationScore: '55%',
                    optimizedInstances: '55',
                    notOptimizedInstances: '65',
                    severity: 'Critical'
                });
                break;
            case 'File system headroom':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical'
                });
                break;
            case 'Log drive size':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical'
                });
                break;

            case 'TempDB drive size':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical'
                });
                break;
            case 'User data files (.mdf)':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical'
                });
                break;
            case 'Log files (.ldf)':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical'
                });
                break;
            case 'TempDB placement':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical'
                });
                break;

            case 'ONTAP configuration':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical'
                });
                break;

            case 'Operating system':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical'
                });
                break;
            case 'Compute rightsizing':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical'
                });
                break;
        }
    }, [selectedConfig]);
    return (
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
                                title: `Optimize configuration (${selectedConfig})`
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography variant="Semibold_20">{selectedConfig}</DsTypography>
                    <DsTypography variant="Semibold_16">Manage instance optimization</DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.leftSection}>
                        <ValueCard
                            optimizationScore={valueCardData.optimizationScore}
                            optimizedInstances={valueCardData.optimizedInstances}
                            notOptimizedInstances={valueCardData.notOptimizedInstances}
                            severity={valueCardData.severity}
                        />
                    </div>
                    <div className={styles.rightSection}>
                        <TagComponent />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardInnerPage;
