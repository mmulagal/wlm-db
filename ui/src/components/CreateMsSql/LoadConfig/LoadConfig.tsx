import { RadioButton, Spinner } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { GENERAL } from '../../../utils/appConstants';
import styles from './LoadConfig.module.scss';
import { useDeleteConfigMutation, useGetConfigListQuery } from '../../../utils/apiService';
import { useDispatch } from 'react-redux';
import { setLoadConfig } from '../../../store/mssql/mssqlFormSlice';
import { ReactComponent as DeleteIcon1 } from '../../../assets/delete-icon.svg';
import { useAppSelector } from '../../../store/storeHooks';

const LoadConfig = () => {
    const dispatch = useDispatch();
    const [hoveredItem, setHoveredItem] = useState(null);

    const { configData, configLoading} = useAppSelector(state => state.mssql.getSavedConfigList);

    // API call to get configuration list
    const {
        refetch: configListRefetch
    } = useGetConfigListQuery({});

    const [deleteConfigApi] = useDeleteConfigMutation();

    const [selectedConfig, setSelectedConfig] = useState('');

    useEffect(() => {
        if(configData && configData.length > 0){
            setSelectedConfig(configData[0]?.name);
            dispatch(setLoadConfig(configData[0]?.id));
        }
    }, [configData, dispatch]);
    
    const handleChange = (item: any) => {
        setSelectedConfig(item?.name);
        dispatch(setLoadConfig(item?.id));
    };

    const handleMouseEnter = (index: any) => {
        setHoveredItem(index);
    };

    const handleMouseLeave = () => {
        setHoveredItem(null);
    };

    const deleteConfig = (index: any) => {
        deleteConfigApi({configId: configData[index]?.id});
        configListRefetch();
    };

    return (
        <div className={styles['load-config']}>
            <div className={styles.content}>{GENERAL.LOAD_CONFIG_CONTENT}</div>
            <div className={styles.radioContainer}>
                {!configLoading && configData?.map((item: any, index: any) => (
                    <div className={index === 0 ? `${styles.item} ${styles.firstItem}` : `${styles.item}`} key={index} 
                        onMouseEnter={() => handleMouseEnter(index)}
                        onMouseLeave={handleMouseLeave}>
                        <div className={styles.setRow}>
                            <RadioButton
                                isChecked={selectedConfig === item?.name}
                                onChange={() => handleChange(item)}
                                children={item?.name}
                                className=""
                            />
                            {hoveredItem === index && <div className={styles.icon}>
                                <DeleteIcon1 onClick={() => deleteConfig(index)}/>
                            </div>}
                        </div>
                    </div>
                ))}
                {configLoading && <div className={styles.loading}><Spinner/></div>}
            </div>
        </div>
    );
};

export default LoadConfig;
