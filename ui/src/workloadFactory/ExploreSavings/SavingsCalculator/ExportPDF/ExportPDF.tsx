import { useDispatch } from 'react-redux';
import { ReactComponent as Download } from '@netapp/icons/ic_download.svg';
import { ReactComponent as Calculate } from '../../../../assets/ic_calculate.svg';

import styles from './ExportPDF.module.scss';
import { DsTypography } from '@netapp/design-system';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventorySlice';
import { WLF_TABS } from '../../../../utils/consts';
//@ts-ignore
import domToPdf from 'dom-to-pdf';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';

const ExportPDF = ({ printDocument }: any) => {
    const { loading } = useAppSelector(state => state.exploreSavings);
    const dispatch = useDispatch();

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
                    onClick={() => (loading ? () => {} : handleExport())}
                >
                    {GENERAL.EXPORT_PDF}
                </DsTypography>
            </div>

            <div className={loading ? `${styles.insideContainer} ${styles.disabled}` : styles.insideContainer}>
                <div>
                    <Calculate />
                </div>
                <DsTypography
                    variant="Semibold_14"
                    className={styles.text}
                    onClick={() =>
                        loading ? () => {} : dispatch(setSelectedHeaderTab(WLF_TABS.VIEW_THE_CALCULATIONS))
                    }
                >
                    {GENERAL.VIEW_THE_CALCULATIONS}
                </DsTypography>
            </div>
        </div>
    );
};

export default ExportPDF;
