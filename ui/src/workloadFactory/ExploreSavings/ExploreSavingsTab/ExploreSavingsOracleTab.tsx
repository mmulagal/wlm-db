import { DsTypography } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ExploreSavingsTab.module.scss';
import { setSelectedOracleExploreSavingsTab } from '../../../store/workloadFactory/exploreSavingsSlice';
import { WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { handleExploreSavingsURL } from '../../../utils/utilityFunctions';

const ExploreSavingsOracleTab = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = useState(WLF_TABS.ORACLE_SERVER_ON_PREMISES);
    const selectedOracleExploreSavingsTab = useAppSelector(
        state => state.exploreSavings.selectedOracleExploreSavingsTab
    );
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);

    useEffect(() => {
        setSelectedTab(selectedOracleExploreSavingsTab);
        handleExploreSavingsURL(selectedOracleExploreSavingsTab, isWorkloadFactory);
    }, [selectedOracleExploreSavingsTab, isWorkloadFactory]);
    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedOracleExploreSavingsTab(value));
        handleExploreSavingsURL(value, isWorkloadFactory);
    };
    return (
        <div className={styles.exploreSavingsTab}>
            <div
                className={
                    selectedTab === WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
                        ? `${styles.headers} ${styles.headerOracleTab} ${styles.active}`
                        : `${styles.headers} ${styles.headerOracleTab}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE)}
                >
                    <span>{t('databases.explore-savings.oracle-database-ebs')}</span>
                </DsTypography>
            </div>

            <div
                className={
                    selectedTab === WLF_TABS.ORACLE_SERVER_ON_PREMISES
                        ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthFirst}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === WLF_TABS.ORACLE_SERVER_ON_PREMISES
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WLF_TABS.ORACLE_SERVER_ON_PREMISES)}
                >
                    {t('databases.explore-savings.oracle-database-on-premises')}
                </DsTypography>
            </div>
        </div>
    );
};

export default ExploreSavingsOracleTab;
