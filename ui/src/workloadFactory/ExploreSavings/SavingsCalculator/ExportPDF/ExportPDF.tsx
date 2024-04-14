import { ReactComponent as Download } from '@netapp/icons/ic_download.svg';
import { ReactComponent as Calculate } from '../../../../assets/ic_calculate.svg';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import styles from './ExportPDF.module.scss';
import { DsTypography } from '@netapp/design-system';

const ExportPDF = ({ rootElementId }: any) => {
    const downloadPdfDocument = () => {
        const input = document.getElementById(rootElementId);
        //@ts-ignore
        html2canvas(input).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4', true);
            const componentWidth = pdf.internal.pageSize.getWidth();
            const componentHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(componentWidth / imgWidth, componentHeight / imgHeight);
            const imgX = (componentWidth - imgWidth * ratio) / 2;
            const imgY = 30;
            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save('SavingCalculator.pdf');
        });
    };

    // const exportDivToPdf = () => {
    //     const input = document.getElementById(rootElementId);

    //     // Get total height of content inside the div
    //     //@ts-ignore
    //     const totalHeight = input.scrollHeight;

    //     // Create a canvas to hold the content of the div
    //     //@ts-ignore
    //     const divCanvas = document.createElement('canvas');
    //     //@ts-ignore
    //     divCanvas.width = input.offsetWidth;
    //     divCanvas.height = totalHeight;

    //     const ctx = divCanvas.getContext('2d');

    //     // Function to capture and render a section of the div content
    //     //@ts-ignore
    //     const captureAndRender = (scrollY: any) => {
    //         //@ts-ignore
    //         input.scrollTo(0, scrollY);

    //         return new Promise(resolve => {
    //             // Wait for scrolling and rendering to complete
    //             setTimeout(() => {
    //                 //@ts-ignore
    //                 html2canvas(input).then(canvas => {
    //                     //@ts-ignore
    //                     ctx.drawImage(canvas, 0, scrollY);
    //                     //@ts-ignore
    //                     resolve();
    //                 });
    //             }, 2000); // Adjust the delay if needed
    //         });
    //     };

    //     // Function to capture full content of the div
    //     const captureFullDivContent = async () => {
    //         let scrollY = 0;
    //         while (scrollY < totalHeight) {
    //             await captureAndRender(scrollY);
    //             //@ts-ignore
    //             scrollY += input.offsetHeight;
    //         }

    //         // Create a PDF from the div canvas
    //         const imgData = divCanvas.toDataURL('image/png');
    //         const pdf = new jsPDF('p', 'mm', 'a4');
    //         const imgWidth = pdf.internal.pageSize.getWidth();
    //         const imgHeight = (divCanvas.height * imgWidth) / divCanvas.width;
    //         pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    //         pdf.save('abc');
    //     };

    //     // Start capturing the full content of the div
    //     captureFullDivContent();
    // };

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
                <DsTypography variant="Semibold_14" className={styles.text}>
                    View the calculations
                </DsTypography>
            </div>
        </div>
    );
};

export default ExportPDF;
