import { DsTypography } from '@tlveng/wlm-ds';
import { RadioButton } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FSx } from '../../../../../../assets/FSx.svg';
import styles from './HeaderCard.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { FSX_FOR_ONTAP_CRED_OPTION } from '../../../../../../utils/consts';
import { setSelectedFSxForOntapCredentials } from '../../../../../../store/workloadFactory/inventoryV2Slice';

interface HeaderCardProps {
    isRadioDisabled?: boolean;
}

const HeaderCard = ({ isRadioDisabled = false }: HeaderCardProps) => {
    const dispatch = useDispatch();
    const { selectedFSxForOntapCredentials } = useAppSelector(state => state.inventoryV2);
    const { t } = useTranslation();
    return (
        <div className={styles.headerCard}>
            <FSx />

            <div className={styles.rightSide}>
                <DsTypography variant="Semibold_14">FSx for ONTAP Credentials </DsTypography>

                <div className={styles.radioGroup}>
                    <RadioButton
                        id="use-the-same-credentials-for-all-resources"
                        isChecked={selectedFSxForOntapCredentials === FSX_FOR_ONTAP_CRED_OPTION.USE_THE_SAME_CRED}
                        onChange={() => {
                            dispatch(setSelectedFSxForOntapCredentials(FSX_FOR_ONTAP_CRED_OPTION.USE_THE_SAME_CRED));
                        }}
                        children={t('databases.register-flow.use-the-same-credentials-for-all-resources')}
                        className=""
                        isDisabled={isRadioDisabled}
                    />
                    <RadioButton
                        id="select-config-oracle"
                        isChecked={selectedFSxForOntapCredentials === FSX_FOR_ONTAP_CRED_OPTION.MANAGE_CRED_MANUALLY}
                        onChange={() => {
                            dispatch(setSelectedFSxForOntapCredentials(FSX_FOR_ONTAP_CRED_OPTION.MANAGE_CRED_MANUALLY));
                        }}
                        children={t('databases.register-flow.manage-credentials-manually')}
                        className=""
                        isDisabled={isRadioDisabled}
                    />
                </div>
            </div>
        </div>
    );
};

export default HeaderCard;
