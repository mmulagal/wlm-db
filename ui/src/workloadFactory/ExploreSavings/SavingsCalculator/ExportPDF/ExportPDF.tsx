import { useDispatch } from 'react-redux';
import { ReactComponent as Download } from '@netapp/icons/ic_download.svg';
import { ReactComponent as Calculate } from '../../../../assets/ic_calculate.svg';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import styles from './ExportPDF.module.scss';
import { DsTypography } from '@netapp/design-system';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventorySlice';
import { WLF_TABS } from '../../../../utils/consts';

const ExportPDF = ({ rootElementId }: any) => {
    const dispatch = useDispatch();

    const downloadPdfDocument = () => {
        const input = document.getElementById('export-pdf');
        //@ts-ignore
        html2canvas(input, {
            //@ts-ignore
            width: input.scrollWidth,
            //@ts-ignore
            windowWidth: input.scrollWidth,
            //@ts-ignore
            height: input.scrollHeight,
            //@ts-ignore
            windowHeight: input.scrollHeight
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4', true);
            const componentWidth = pdf.internal.pageSize.getWidth();
            const componentHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(componentWidth / imgWidth, componentHeight / imgHeight);
            const imgX = (componentWidth - imgWidth * ratio) / 2;
            const imgY = 10;
            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save('StorageCalculator.pdf');
        });
    };

    const handleExport = () => {
        downloadPdfDocument();
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
