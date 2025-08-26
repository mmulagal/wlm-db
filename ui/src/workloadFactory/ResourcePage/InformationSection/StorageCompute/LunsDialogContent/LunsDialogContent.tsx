import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './LunsDialogContent.module.scss';
import { DBType } from '../../../../../utils/consts';

const LunsDialogContent = ({ resourceDetails, engineType }: any) => {
    const { t } = useTranslation();

    const volumes = resourceDetails?.databaseInstanceTopology?.storageSummary?.volumes || [];
    const fsxn = resourceDetails?.databaseInstanceTopology?.fileSystemName;

    type Volume = {
        name: string;
        luns?: { name: string }[];
    };

    const data = volumes.map((volume: Volume) => {
        const lunNames = (volume.luns || []).map(lun => lun.name).join(', ');
        return {
            volume: volume.name,
            lun: lunNames,
            fsxn
        };
    });

    return (
        <div className={styles.tableWrapper}>
            <div className={styles.tableRow}>
                <DsTypography variant="Semibold_14" className={styles.tableCellFsx}>
                    FSx for ONTAP
                </DsTypography>
                <DsTypography variant="Semibold_14" className={styles.tableCell}>
                    {t('databases.resource-overview.associated_volumes')}
                </DsTypography>

                {!(engineType === DBType.ORACLE && resourceDetails?.storage?.fsxn?.protocol?.[0] !== 'iSCSI') && (
                    <DsTypography variant="Semibold_14" className={styles.tableCell}>
                        {t('databases.resource-overview.associated_lun')}
                    </DsTypography>
                )}
            </div>
            {data.map((item: any) => (
                <div key={item.volume} className={styles.tableRow}>
                    <DsTypography variant="Regular_14" className={styles.tableCellFsx} title={item.fsxn}>
                        {item.fsxn}
                    </DsTypography>
                    <DsTypography variant="Regular_14" className={styles.tableCell} title={item.volume}>
                        {item.volume}
                    </DsTypography>
                    {!(engineType === DBType.ORACLE && resourceDetails?.storage?.fsxn?.protocol?.[0] !== 'iSCSI') && (
                        <DsTypography variant="Regular_14" className={styles.tableCell} title={item.lun}>
                            {item.lun}
                        </DsTypography>
                    )}
                </div>
            ))}
        </div>
    );
};

export default LunsDialogContent;
