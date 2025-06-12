import { Typography } from '@netapp/design-system';
import { Popover } from '@netapp/design-system/dist/components/Popover';

import { ReactComponent as DownloadIcon } from '@netapp/icons/ic_download.svg';
import { ReactComponent as CopyIcon } from '../../assets/ic_copy.svg';
import styles from './ViewDialog.module.scss';
import { downloadObjectAsJson } from '../../utils/utilityFunctions';
import CopyToClipboardCommon from '../CopyToClipboard/copyToClipboard';

const ViewDialog = ({
    data,
    isDownload = false,
    copyResponseData
}: {
    data: string | any;
    isDownload?: boolean;
    copyResponseData?: () => void;
}) => (
    <div className={styles['dialog-content']}>
        <div className={styles['dialog-body']}>
            <div className={styles['code-box']}>
                <div className={styles.code}>
                    <pre>
                        <Typography variant="Regular_14">{data}</Typography>
                    </pre>
                </div>
                <div className={styles.copy}>
                    <Popover
                        popoverClass={styles['copy-popover']}
                        children="Copied to clipboard"
                        container={
                            <CopyToClipboardCommon
                                value={copyResponseData ? copyResponseData() : data}
                                iconProvided={<CopyIcon fill="#A7A7A7" />}
                            />
                        }
                    />

                    {isDownload && (
                        <div className={styles.download}>
                            <Popover
                                popoverClass={styles['copy-popover']}
                                children="Rest API downloaded"
                                container={
                                    <div onClick={() => downloadObjectAsJson(data, new Date())}>
                                        <DownloadIcon />
                                    </div>
                                }
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
);

export default ViewDialog;
