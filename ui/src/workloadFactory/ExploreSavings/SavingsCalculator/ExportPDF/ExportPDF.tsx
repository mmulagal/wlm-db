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
        const input = document.getElementById(rootElementId) as HTMLElement;

        const originalHeight = input.style.height;
        input.style.height = `${input.scrollHeight}px`;

        html2canvas(input).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;

            const widthRatio = pageWidth / imgWidth;
            const heightRatio = pageHeight / imgHeight;
            const ratio = Math.min(widthRatio);

            const scaledWidth = imgWidth * ratio;
            const scaledHeight = imgHeight * ratio;

            let heightLeft = imgHeight;
            let heightPosition = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, scaledWidth, scaledHeight);
            heightLeft -= pageHeight / widthRatio;
            heightPosition -= pageHeight;

            while (heightLeft >= 0) {
                position = heightPosition - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, scaledWidth, scaledHeight);
                heightLeft -= pageHeight / widthRatio;
                heightPosition -= pageHeight;
            }

            pdf.save('SavingCalculator.pdf');
            input.style.height = originalHeight;
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
