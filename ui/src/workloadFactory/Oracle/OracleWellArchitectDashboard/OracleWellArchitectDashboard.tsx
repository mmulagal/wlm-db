import { useState } from 'react';
import TotalOptimizationScore from '../../GetWell/TotalOptimizationScore/TotalOptimizationScore';
import OracleConfigureCategory from './OracleConfigureCategory/OracleConfigureCategory';
import styles from './OracleWellArchitectDashboard.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import StorageLayoutSection from './Categories/StorageLayoutSection';

const OracleWellArchitectDashboard = () => {
    const [optimizePrintState, setOptimizePrintState] = useState(false);
    const loading = false;
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const [expandedValue, setExpandedValue] = useState(undefined);
    const [clickedAccordionId, setClickedAccordionId] = useState<string | undefined>(undefined);

    const isAccordionExpanded = (id: string, optimizePrintState: any): boolean | undefined => {
        if (optimizePrintState) {
            return true;
        }

        return clickedAccordionId === expandedValue && expandedValue === id;
    };

    const handleAccordionExpanded = (id: any, isExpanded: boolean) => {
        isExpanded && clickedAccordionId === id && setExpandedValue(id);
    };

    return (
        <div className={styles['well-architected']}>
            <div className={styles.cards}>
                <TotalOptimizationScore />
                <OracleConfigureCategory />
            </div>

            <div className={styles.sectionTwo}>
                <div className={styles.sectionClass}>
                    <StorageLayoutSection
                        styles={styles}
                        isAccordionExpanded={isAccordionExpanded}
                        setClickedAccordionId={setClickedAccordionId}
                        loading={loading}
                        handleAccordionExpanded={handleAccordionExpanded}
                        isDarkTheme={isDarkTheme}
                        optimizePrintState={optimizePrintState}
                    />
                </div>
            </div>
        </div>
    );
};

export default OracleWellArchitectDashboard;
