import { ReactComponent as StandardCreate } from '../../../assets/Advanced create.svg';
import { ReactComponent as BlueTick } from '../../../assets/blue-tick.svg';
import { ReactComponent as EasyCreate } from '../../../assets/Quick create.svg';

import styles from './SelectConfig.module.scss';

import { SELECT_CONFIG } from '../../../utils/appConstants';

import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectConfig } from '../../../store/mssql/mssqlFormSlice';
import { Typography } from '@netapp/design-system';
const SelectConfig = () => {
    const dispatch = useDispatch();
    const selectedConfig = useAppSelector(state => state.mssqlForm.selectConfig);

    return (
        <div className={styles['select-config']}>
            {/* Easy create section from here */}
            <div
                id="easy-create"
                className={
                    selectedConfig === SELECT_CONFIG.EASY_CREATE
                        ? `${styles['easy-create']} ${styles['add-border']}`
                        : styles['easy-create']
                }
                onClick={() => dispatch(setSelectConfig(SELECT_CONFIG.EASY_CREATE))}
            >
                <div className={styles.level}>
                    <EasyCreate />
                    <div className={styles['easy-create-content']}>
                        <div className={styles['easy-create-heading']}>{SELECT_CONFIG.EASY_CREATE}</div>
                        <Typography variant="Regular_13" className={styles['easy-create-content-text']}>
                            {SELECT_CONFIG.EASY_CREATE_CONTENT}
                        </Typography>
                    </div>
                </div>

                {selectedConfig === SELECT_CONFIG.EASY_CREATE && (
                    <div className={styles['tick-placement']}>
                        <BlueTick />
                    </div>
                )}
                {/* <div className={styles['tag']}>
                    <Tag backgroundColor="var(--chart-9)">{SELECT_CONFIG.COMING_SOON}</Tag>
                </div> */}
            </div>
            {/* Standard create section here */}
            <div
                className={
                    selectedConfig === SELECT_CONFIG.STANDARD_CREATE
                        ? `${styles['standard-create']} ${styles['add-border']}`
                        : styles['standard-create']
                }
                onClick={() => dispatch(setSelectConfig(SELECT_CONFIG.STANDARD_CREATE))}
            >
                <div className={styles.level}>
                    <StandardCreate />
                    <div className={styles['standard-create-content']}>
                        <div className={styles['standard-create-heading']}>{SELECT_CONFIG.STANDARD_CREATE}</div>
                        <Typography variant="Regular_13" className={styles['standard-create-content-text']}>
                            {SELECT_CONFIG.STANDARD_CREATE_CONTENT}
                        </Typography>
                    </div>
                </div>

                {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && (
                    <div className={styles['tick-placement']}>
                        <BlueTick />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SelectConfig;
