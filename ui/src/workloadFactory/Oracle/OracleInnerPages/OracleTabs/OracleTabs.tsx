import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { DsTypography } from '@netapp/design-system';
import styles from './OracleTabs.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { WELL_ARCHITECTED_TABS } from '../../../../utils/consts';
import { setSelectedOracleInnerPageTab } from '../../../../store/workloadFactory/oracleSlice';

const OracleTabs = () => {
    const dispatch = useDispatch();
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
                    {GENERAL.OVERVIEW}
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
                    {GENERAL.WELL_ARCHITECTED_STATUS}
                </DsTypography>
            </div>
        </div>
    );
};

export default OracleTabs;
