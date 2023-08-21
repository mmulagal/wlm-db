import { Typography, Popover } from '@netapp/design-system';
import styles from './InformationPane.module.scss';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';

type InformationDataType = {
    label: string;
    value: string;
    showCopy: boolean;
};

const InformationPane = () => {
    const informationData = [
        { label: 'SQL Server version', value: 'SQL2022', showCopy: true },
        { label: 'Edition', value: 'Standard', showCopy: true },
        { label: 'Engine', value: 'SQL Server express edition', showCopy: true },
        { label: 'Status', value: 'Healthy', showCopy: true },
        { label: 'ID', value: '625489731245678', showCopy: true },
        { label: 'Connections', value: '2', showCopy: false }
    ];

    return (
        <div className={styles.informationPane}>
            <div className={styles.informationTitle}>
                <Typography className={styles.informationTitleText} variant="Semibold_14">
                    Information
                </Typography>
            </div>
            <div className={styles.titleTag}>
                <Typography variant="Semibold_14">Microsoft SQL Server | ONTAP</Typography>
            </div>
            <div className={styles.informationContainer}>
                {informationData.map((item: InformationDataType) => {
                    return (
                        <div className={styles.infoItemContainer}>
                            <Typography variant="Semibold_14">{`${item.label}: `}</Typography>
                            <Typography variant="Regular_14">{item.value}</Typography>
                            {item.showCopy && (
                                <div className={styles.copyContainer}>
                                    <Popover
                                        popoverClass={styles['copy-popover']}
                                        children={'Copied to clipboard'}
                                        container={
                                            <CopyToClipboard text={item.value}>
                                                <CopyIcon fill={'#c8c8c8'}></CopyIcon>
                                            </CopyToClipboard>
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InformationPane;
