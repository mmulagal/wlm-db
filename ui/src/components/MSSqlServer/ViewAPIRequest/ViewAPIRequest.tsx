import { Popover } from '@netapp/design-system/dist/components/Popover';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import { ReactComponent as CopyIcon } from '../../../assets/ic_copy.svg';

import styles from './ViewAPIRequest.module.scss';

const ViewAPIRequest = () => {
    return (
        <div className={styles['dialog-content']}>
            <div className={styles['dialog-body']}>
                <div className={styles['code-box']}>
                    <div className={styles['code']}>{'text'}</div>
                    <div className={styles['copy']}>
                        <Popover
                            popoverClass={styles['copy-popover']}
                            children={'Copied to clipboard'}
                            container={
                                <CopyToClipboard text={'text'}>
                                    <CopyIcon fill={'#A7A7A7'}></CopyIcon>
                                </CopyToClipboard>
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewAPIRequest;
