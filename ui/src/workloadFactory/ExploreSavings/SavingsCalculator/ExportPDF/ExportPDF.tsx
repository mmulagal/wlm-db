import { useDispatch } from 'react-redux';
import { ReactComponent as Download } from '@netapp/icons/ic_download.svg';
import { ReactComponent as Calculate } from '../../../../assets/ic_calculate.svg';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventorySlice';
import { WLF_TABS } from '../../../../utils/consts';
import styles from './ExportPDF.module.scss';
import { DsTypography, Popover } from '@netapp/design-system';

import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';

const ExportPDF = ({ printDocument }: any) => {
    const { storageSavingsLoading, selectedHostDetails, viewCalculationsLoading } = useAppSelector(
        state => state.exploreSavings
    );

    const dispatch = useDispatch();
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    const [loading, setLoading] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);

    useEffect(() => {
        setLoading(storageSavingsLoading || selectedHostDetails?.loading);
    }, [storageSavingsLoading, selectedHostDetails]);

    useEffect(() => {
        setViewLoading(selectedHostDetails?.loading || viewCalculationsLoading);
    }, [selectedHostDetails, viewCalculationsLoading]);

    const handleExport = () => {
        printDocument();
    };

    return (
        <div className={styles.exportPdf}>
            <div className={loading ? `${styles.insideContainer} ${styles.disabled}` : styles.insideContainer}>
                <div>
                    <Download />
                </div>
                <DsTypography
                    variant="Semibold_14"
                    className={styles.text}
                    style={{ width: '80px' }}
                    onClick={() => (loading ? () => {} : handleExport())}
                >
                    {GENERAL.EXPORT_PDF}
                </DsTypography>
            </div>

            {isDemoMode && (
                <>
                    <div
                        className={
                            viewLoading ? `${styles.insideContainer} ${styles.disabled}` : styles.insideContainer
                        }
                    >
                        <div>
                            <Calculate />
                        </div>
                        <DsTypography
                            variant="Semibold_14"
                            className={styles.text}
                            style={{ width: '147px' }}
                            onClick={() =>
                                viewLoading ? () => {} : dispatch(setSelectedHeaderTab(WLF_TABS.VIEW_THE_CALCULATIONS))
                            }
                        >
                            {GENERAL.VIEW_THE_CALCULATIONS}
                        </DsTypography>
                    </div>
                </>
            )}
            {!isDemoMode && (
                <>
                    {/* <div className={viewLoading ? `${styles.insideContainer} ${styles.disabled}` : styles.insideContainer}> */}
                    <div className={`${styles.insideContainer} ${styles.disabled}`}>
                        <div>
                            <Calculate />
                        </div>
                        <Popover
                            popoverClass={styles['popover']}
                            children={'This feature is currently unavailable'}
                            trigger="hover"
                            container={
                                <DsTypography
                                    variant="Semibold_14"
                                    className={styles.text}
                                    style={{ width: '147px' }}
                                    // onClick={() =>
                                    //     viewLoading ? () => {} : dispatch(setSelectedHeaderTab(WLF_TABS.VIEW_THE_CALCULATIONS))
                                    // }
                                    onClick={() => () => {}}
                                >
                                    {GENERAL.VIEW_THE_CALCULATIONS}
                                </DsTypography>
                            }
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default ExportPDF;
