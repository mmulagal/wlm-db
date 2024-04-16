import { useDispatch } from 'react-redux';
import { ReactComponent as Download } from '@netapp/icons/ic_download.svg';
import { ReactComponent as Calculate } from '../../../../assets/ic_calculate.svg';

import styles from './ExportPDF.module.scss';
import { DsTypography } from '@netapp/design-system';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventorySlice';
import { WLF_TABS } from '../../../../utils/consts';
//@ts-ignore
import domToPdf from 'dom-to-pdf';

const ExportPDF = ({ rootElementId }: any) => {
    const dispatch = useDispatch();

    const printDocument = () => {
        setTimeout(() => {
            const elem = document.getElementById(rootElementId) as HTMLElement;
            var options = {
                filename: `SavingsCalculator.pdf`
            };
            domToPdf(elem, options, (pdf: any) => {});
        }, 200);
    };

    const handleExport = () => {
        printDocument();
    };
    return (
        <div className={styles.exportPdf}>
            <div className={styles.insideContainer}>
                <div>
                    <Download />
                </div>
                <DsTypography variant="Semibold_14" className={styles.text} onClick={() => handleExport()}>
                    Export PDF
                </DsTypography>
            </div>

            <div className={styles.insideContainer}>
                <div>
                    <Calculate />
                </div>
                <DsTypography
                    variant="Semibold_14"
                    className={styles.text}
                    onClick={() => dispatch(setSelectedHeaderTab(WLF_TABS.VIEW_THE_CALCULATIONS))}
                >
                    View the calculations
                </DsTypography>
            </div>
        </div>
    );
};

export default ExportPDF;
