import { useDispatch } from 'react-redux';
import { ReactComponent as Download } from '@netapp/icons/ic_download.svg';
import { ReactComponent as Calculate } from '../../../../assets/ic_calculate.svg';

import styles from './ExportPDF.module.scss';
import { DsTypography } from '@netapp/design-system';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventorySlice';
import { WLF_TABS } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';

const ExportPDF = ({ printDocument }: any) => {
    const { storageSavingsLoading, selectedHostDetails, viewCalculationsLoading, viewCalculationsResponse } =
        useAppSelector(state => state.exploreSavings);

    const dispatch = useDispatch();

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(storageSavingsLoading || selectedHostDetails?.loading);
    }, [storageSavingsLoading, selectedHostDetails]);

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

            <div
                className={
                    loading || viewCalculationsLoading || !viewCalculationsResponse
                        ? `${styles.insideContainer} ${styles.disabled}`
                        : styles.insideContainer
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
                        loading ? () => {} : dispatch(setSelectedHeaderTab(WLF_TABS.VIEW_THE_CALCULATIONS))
                    }
                    title={!viewCalculationsResponse ? GENERAL.VIEW_CALC_NO_DATA : ''}
                >
                    {GENERAL.VIEW_THE_CALCULATIONS}
                </DsTypography>
            </div>
        </div>
    );
};

export default ExportPDF;
