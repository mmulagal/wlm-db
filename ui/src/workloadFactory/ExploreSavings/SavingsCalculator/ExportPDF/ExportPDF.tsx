import { useDispatch } from 'react-redux';
import { ReactComponent as Download } from '@netapp/icons/ic_download.svg';
import { ReactComponent as Calculate } from '../../../../assets/ic_calculate.svg';
import { ReactComponent as Email } from '../../../../assets/ic_email.svg';
import { WLF_TABS } from '../../../../utils/consts';
import styles from './ExportPDF.module.scss';
import { DsTypography } from '@netapp/design-system';

import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';

const ExportPDF = ({ printDocument, disableState, sendEmail }: any) => {
    const {
        storageSavingsLoading,
        selectedHostDetails,
        viewCalculationsLoading,
        viewCalculationsResponse,
        selectedExploreSavingsTab
    } = useAppSelector(state => state.exploreSavings);

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

    const handleSendEmail = () => {
        sendEmail();
    };

    const setCSSForExportPDF = () => {
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            return `${styles.exportPdf} ${styles.exportPdfOnPrem}`;
        } else {
            return styles.exportPdf;
        }
    };

    return (
        <div className={setCSSForExportPDF()}>
            <div
                className={
                    loading || disableState || !viewCalculationsResponse
                        ? `${styles.insideContainer} ${styles.disabled}`
                        : styles.insideContainer
                }
            >
                <div>
                    <Download />
                </div>
                <DsTypography
                    variant="Semibold_14"
                    className={styles.text}
                    style={{ width: '80px' }}
                    onClick={() => (loading || disableState || !viewCalculationsResponse ? () => {} : handleExport())}
                    id="es-export-pdf"
                >
                    {GENERAL.EXPORT_PDF}
                </DsTypography>
            </div>

            <div
                className={
                    loading || disableState || !viewCalculationsResponse
                        ? `${styles.insideContainer} ${styles.disabled}`
                        : styles.insideContainer
                }
            >
                <div>
                    <Email />
                </div>
                <DsTypography
                    variant="Semibold_14"
                    className={styles.text}
                    onClick={() =>
                        loading || disableState || !viewCalculationsResponse ? () => {} : handleSendEmail()
                    }
                    id="es-export-pdf"
                >
                    Send by Email
                </DsTypography>
            </div>

            {isDemoMode && (
                <>
                    <div
                        className={
                            viewLoading || disableState || !viewCalculationsResponse
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
                                viewLoading || disableState || !viewCalculationsResponse
                                    ? () => {}
                                    : dispatch(setSelectedHeaderTab(WLF_TABS.VIEW_THE_CALCULATIONS))
                            }
                            id="view-calculations"
                        >
                            {GENERAL.VIEW_THE_CALCULATIONS}
                        </DsTypography>
                    </div>
                </>
            )}
            {!isDemoMode && (
                <>
                    <div
                        className={
                            viewLoading || disableState || !viewCalculationsResponse
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
                                viewLoading || disableState || !viewCalculationsResponse
                                    ? () => {}
                                    : dispatch(setSelectedHeaderTab(WLF_TABS.VIEW_THE_CALCULATIONS))
                            }
                            id="view-calculations"
                        >
                            {GENERAL.VIEW_THE_CALCULATIONS}
                        </DsTypography>
                    </div>
                </>
            )}
        </div>
    );
};

export default ExportPDF;
