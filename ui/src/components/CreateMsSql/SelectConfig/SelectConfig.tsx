import { ReactComponent as StandardCreate } from '../../../assets/Advanced create.svg';
import { ReactComponent as BlueTick } from '../../../assets/blue-tick.svg';
import { ReactComponent as EasyCreate } from '../../../assets/Quick create.svg';

import styles from './SelectConfig.module.scss';

import { SELECT_CONFIG } from '../../../utils/appConstants';

import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectConfig } from '../../../store/mssql/mssqlFormSlice';
import { setIsWizardTouched } from '../../../store/chatbot/chatbotSlice';
import CardComponentConfig from '../../../common/CardComponent/CardComponentConfig';
import { useEffect } from 'react';
import { DBType } from '../../../utils/consts';

type SC = {
    isDisabled?: boolean;
};

const SelectConfig = ({ isDisabled = false }: SC) => {
    const dispatch = useDispatch();
    const selectedConfig = useAppSelector(state => state.mssqlForm.selectConfig);
    const selectedDatabaseType = useAppSelector(state => state.postgreForm.selectedDatabaseType);

    useEffect(() => {
        if (selectedDatabaseType === DBType.POSTGRESQL) {
            dispatch(setSelectConfig(SELECT_CONFIG.STANDARD_CREATE));
        } else {
            dispatch(setSelectConfig(SELECT_CONFIG.EASY_CREATE));
        }
    }, [selectedDatabaseType]);

    const clickHandler = (val: string) => {
        dispatch(setSelectConfig(val));
        dispatch(setIsWizardTouched(true));
    };

    return (
        <div className={styles['select-config']}>
            {/* Easy create section from here */}
            <CardComponentConfig
                idToAdd={'quick-create'}
                selectedConfigCondition={selectedConfig === SELECT_CONFIG.EASY_CREATE}
                icon={<EasyCreate />}
                tickIcon={<BlueTick />}
                heading={SELECT_CONFIG.QUICK_CREATE}
                content={SELECT_CONFIG.EASY_CREATE_CONTENT}
                handleClick={() => clickHandler(SELECT_CONFIG.EASY_CREATE)}
                isDisabled={isDisabled}
            />

            {/* Standard create section here */}
            <CardComponentConfig
                idToAdd={'advanced-create'}
                selectedConfigCondition={selectedConfig === SELECT_CONFIG.STANDARD_CREATE}
                icon={<StandardCreate />}
                tickIcon={<BlueTick />}
                heading={SELECT_CONFIG.ADVANCED_CREATE}
                content={SELECT_CONFIG.STANDARD_CREATE_CONTENT}
                handleClick={() => clickHandler(SELECT_CONFIG.STANDARD_CREATE)}
            />
        </div>
    );
};

export default SelectConfig;
