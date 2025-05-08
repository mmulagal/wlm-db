import { useDispatch } from 'react-redux';
import styles from './WellArchitectTabs.module.scss';
import { useEffect, useState } from 'react';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setLandingFromInnerPage,
    setSelectedWellArchitectTab
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { DsTypography } from '@netapp/design-system';

const WellArchitectTabs = () => {
    const dispatch = useDispatch();
    const [selectedTab, setSelectedTab] = useState<any>();
    const { selectedWellArchitectTab } = useAppSelector(state => state.getWellOptimize);

    useEffect(() => {
        setSelectedTab(selectedWellArchitectTab);
    }, [selectedWellArchitectTab]);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedWellArchitectTab(value));
        dispatch(setLandingFromInnerPage(true));
    };
    return (
        <div className={styles['well-architect-tabs']}>
            <div
                className={
                    selectedTab === 'Overview'
                        ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthFirst}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Overview'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Overview')}
                >
                    Overview
                </DsTypography>
            </div>
            <div
                className={
                    selectedTab === 'Well-architected status'
                        ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthSecond}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Well-architected status'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Well-architected status')}
                >
                    Well-architected status
                </DsTypography>
            </div>

            <div
                className={
                    selectedTab === 'Databases'
                        ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthThird}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Databases'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Databases')}
                >
                    Databases
                </DsTypography>
            </div>

            <div
                className={
                    selectedTab === 'Sandboxes'
                        ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthThird}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Sandboxes'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Sandboxes')}
                >
                    Sandboxes
                </DsTypography>
            </div>
        </div>
    );
};

export default WellArchitectTabs;
