import { useEffect, useState } from 'react';
import { DsTypography } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './AuthenticationTabsForBulk.module.scss';
import { PREPARE_PAGE_TABS } from '../../../../../../utils/consts';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { setSelectedPreparePageTab } from '../../../../../../store/workloadFactory/inventoryV2Slice';

const AuthenticationTabsForBulk = () => {
    const [selectedTab, setSelectedTab] = useState<string>();
    const { selectedPreparePageTab } = useAppSelector(state => state.inventoryV2);
    const dispatch = useDispatch();
    const { t } = useTranslation();

    useEffect(() => {
        setSelectedTab(selectedPreparePageTab);
    }, [selectedPreparePageTab]);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedPreparePageTab(value));
    };
    return (
        <div className={styles.authTabs}>
            <div
                className={
                    selectedTab === PREPARE_PAGE_TABS.PREREQUISITE_CHECK
                        ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthFirst}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === PREPARE_PAGE_TABS.PREREQUISITE_CHECK
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(PREPARE_PAGE_TABS.PREREQUISITE_CHECK)}
                >
                    {t('databases.register-flow.prerequisite-check-view')}
                </DsTypography>
            </div>

            <div
                className={
                    selectedTab === PREPARE_PAGE_TABS.INSTANCE_READINESS
                        ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthSecond}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === PREPARE_PAGE_TABS.INSTANCE_READINESS
                            ? `${styles.headerPart2} ${styles.activeText}`
                            : `${styles.headerPart2}`
                    }
                    onClick={() => handleClick(PREPARE_PAGE_TABS.INSTANCE_READINESS)}
                >
                    {t('databases.register-flow.instance-readiness-view')}
                </DsTypography>
            </div>
        </div>
    );
};

export default AuthenticationTabsForBulk;
