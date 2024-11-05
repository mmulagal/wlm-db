import { Header } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import { useNavigate } from 'react-router-dom';

import { FORM_TO_WLF_NAVIGATE_BLUEXP } from '../../../utils/consts';

const PostgressHeader = () => {
    const state = useAppSelector(state => state);
    const isWorkloadFactoryStatus = state.auth?.isWorkloadFactory;
    const navigate = useNavigate();
    const handleNavigateWithoutDialog = () => {
        if (isWorkloadFactoryStatus) {
            navigate('../databases');
        } else {
            navigate(FORM_TO_WLF_NAVIGATE_BLUEXP);
        }
    };
    return (
        <Header
            title={'Create new PostgreSQL Server'}
            closeButtonProps={{
                onClick: () => {
                    handleNavigateWithoutDialog();
                }
            }}
            style={{ width: '100vw' }}
        ></Header>
    );
};

export default PostgressHeader;
