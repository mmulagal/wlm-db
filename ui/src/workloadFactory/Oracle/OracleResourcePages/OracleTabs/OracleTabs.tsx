import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
import styles from './OracleTabs.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { WELL_ARCHITECTED_TABS } from '../../../../utils/consts';
import { setSelectedOracleInnerPageTab } from '../../../../store/workloadFactory/oracleSlice';

const OracleTabs = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = useState<any>();
    const { selectedOracleInnerPageTab } = useAppSelector(state => state.oracleSlice);

    useEffect(() => {
        setSelectedTab(selectedOracleInnerPageTab);
    }, [selectedOracleInnerPageTab]);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedOracleInnerPageTab(value));
    };
    return (
        <div className={styles['oracle-tabs']}>
            <div
                className={
                    selectedTab === WELL_ARCHITECTED_TABS.OVERVIEW
                        ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthFirst}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === WELL_ARCHITECTED_TABS.OVERVIEW
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WELL_ARCHITECTED_TABS.OVERVIEW)}
                >
                    {t('databases.oracle-inner-page.overview')}
                </DsTypography>
            </div>
            <div
                className={
                    selectedTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                        ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthSecond}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS)}
                >
                    {t('databases.general.well_architected_status')}
                </DsTypography>
            </div>

            <div
                className={
                    selectedTab === WELL_ARCHITECTED_TABS.PDB
                        ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthThird}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === WELL_ARCHITECTED_TABS.PDB
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WELL_ARCHITECTED_TABS.PDB)}
                >
                    {t('databases.oracle-inner-page.pdb')}
                </DsTypography>
            </div>
        </div>
    );
};

export default OracleTabs;
