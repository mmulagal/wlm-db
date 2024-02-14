import { useAppSelector } from '../../../store/storeHooks';
import { useDispatch } from 'react-redux';

import CardComponentConfig from '../../../common/CardComponent/CardComponentConfig';
import { ReactComponent as BlueTick } from '../../../assets/blue-tick.svg';
import { ReactComponent as EasyCreate } from '../../../assets/Quick create.svg';
import { SELECT_CONFIG } from '../../../utils/appConstants';
import { setSelectedNewUserConfig } from '../../../store/workloadFactory/createNewUserSlice';

import styles from './CreateStyle.module.scss';

const CreateStyle = () => {
    const selectedConfigNewUser = useAppSelector(state => state.createNewUser.selectedNewUserConfig);
    const dispatch = useDispatch();
    const clickHandler = (val: string) => {
        dispatch(setSelectedNewUserConfig(val));
    };
    return (
        <div className={styles.createStyle}>
            <CardComponentConfig
                idToAdd="new-user-quick-create"
                selectedConfigCondition={selectedConfigNewUser === 'Quick create'}
                icon={<EasyCreate />}
                tickIcon={<BlueTick />}
                heading={SELECT_CONFIG.QUICK_CREATE}
                content={SELECT_CONFIG.EASY_CREATE_CONTENT}
                handleClick={() => clickHandler('Quick create')}
            />

            <CardComponentConfig
                idToAdd="new-user-standard-create"
                selectedConfigCondition={selectedConfigNewUser === 'Standard create'}
                icon={<EasyCreate />}
                tickIcon={<BlueTick />}
                heading={'Standard create'}
                content={SELECT_CONFIG.EASY_CREATE_CONTENT}
                handleClick={() => clickHandler('Standard create')}
            />
        </div>
    );
};

export default CreateStyle;
