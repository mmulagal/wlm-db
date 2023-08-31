import { RadioButton } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { GENERAL } from '../../../utils/appConstants';
import styles from './LoadConfig.module.scss';
import { useGetConfigListQuery } from '../../../utils/apiService';
import { useDispatch } from 'react-redux';
import { setLoadConfig } from '../../../store/mssql/mssqlFormSlice';

const LoadConfig = () => {
    const dispatch = useDispatch();

    // API call to get configuration list
    const {
        data: configList,
    } = useGetConfigListQuery({});

    const [selectedConfig, setSelectedConfig] = useState('');

    useEffect(() => {
        if(configList && configList.length > 0){
            setSelectedConfig(configList[0]?.name);
            dispatch(setLoadConfig(configList[0]?.id));
        }
    }, [configList, dispatch]);
    
    const handleChange = (item: any) => {
        setSelectedConfig(item?.name);
        dispatch(setLoadConfig(item?.id));
    };
    return (
        <div className={styles['load-config']}>
            <div className={styles.content}>{GENERAL.LOAD_CONFIG_CONTENT}</div>
            <div className={styles.radioContainer}>
                {configList?.map((item: any, index: any) => (
                    <div className={index === 0 ? `${styles.item} ${styles.firstItem}` : `${styles.item}`} key={index}>
                        <RadioButton
                            isChecked={selectedConfig === item?.name}
                            onChange={() => handleChange(item)}
                            children={item?.name}
                            className=""
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LoadConfig;
