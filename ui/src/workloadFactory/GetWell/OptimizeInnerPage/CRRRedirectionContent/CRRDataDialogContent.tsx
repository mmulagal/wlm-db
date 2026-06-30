import { useMemo } from 'react';
import { DsRadioButton, DsTypography, DsSelect } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setSelectedLinkOption,
    setExistingLinks,
    setExistingLinksLoading,
    setSelectedExistingLink,
    setShowLinkError
} from '../../../../store/workloadFactory/crrRedirectionSlice';
import { useGetExistingLinksMutation } from '../../../../utils/apiService';
import styles from './CRRRedirectionContent.module.scss';
import { ReactComponent as InfoIcon } from '../../../../assets/info.svg';

const CRRDataDialogContent = ({ isWad = false }) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedLinkOption, fsxDetails, existingLinks, existingLinksLoading, selectedExistingLink, showLinkError } =
        useAppSelector(state => state.crrRedirection);

    const [getExistingLinksApi] = useGetExistingLinksMutation();

    const handleAssociateExistingLink = async () => {
        dispatch(setSelectedLinkOption('associateExistingLink'));
        if (existingLinks.items.length === 0 && !existingLinksLoading) {
            dispatch(setExistingLinksLoading(true));
            const response: any = await getExistingLinksApi({});
            if (response?.data) {
                dispatch(setExistingLinks(response.data));
            }
            dispatch(setExistingLinksLoading(false));
        }
    };

    // Function to generate options for DsSelect for Link
    const generateExistingLinkOptions = useMemo(
        () =>
            existingLinks.items.map(item => {
                const type = item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : '';
                const features = item.features?.length > 0 ? item.features.join(', ').toUpperCase() : '';
                const subnetPart = item.subnetIds?.[0] ?? '';
                const vpcPart = item.vpcId ?? '';
                const subLabel = [subnetPart, vpcPart, features].filter(Boolean).join(' | ');
                const status = item?.state?.status;

                return {
                    id: item.id,
                    label: `${item.name} | ID: ${item.id} | ${type}`,
                    value: item.name,
                    subLabel,
                    isDisabled: status === 'FAILED' || status === 'PENDING',
                    disabledReason:
                        status === 'FAILED'
                            ? 'Link is in status FAILED and cannot be associated'
                            : 'Link is in status PENDING and cannot be associated'
                };
            }),
        [existingLinks.items]
    );

    const labelForDropDown = () => {
        if (selectedExistingLink?.value) {
            return selectedExistingLink.value;
        }
        return 'Select link';
    };

    return (
        <div className={styles.crrDataDialogContent}>
            {isWad && (
                <div className={styles.wadBanner}>
                    <InfoIcon />
                    <DsTypography variant="Regular_14">{t('databases.wad.tab-disabled-message-oracle')}</DsTypography>
                </div>
            )}
            <DsTypography variant="Regular_14">{t('databases.well-architect.crr-dialog-text')}</DsTypography>

            <div className={styles.networkInfoBox}>
                <DsTypography variant="Regular_14">FSx for ONTAP network identifier</DsTypography>
                <DsTypography variant="Semibold_14">{fsxDetails?.vpcInfo?.vpcName}</DsTypography>
                <DsTypography variant="Semibold_14">{fsxDetails?.vpcInfo?.vpcCidr}</DsTypography>
            </div>

            <div className={styles.radioGroup}>
                <DsRadioButton
                    id="create-new-link"
                    variant="Default"
                    title="Create a new link"
                    isSelected={selectedLinkOption === 'createNewLink'}
                    onClick={() => dispatch(setSelectedLinkOption('createNewLink'))}
                />
                <DsRadioButton
                    id="associate-existing-link"
                    variant="Default"
                    title="Associate an existing link"
                    isSelected={selectedLinkOption === 'associateExistingLink'}
                    onClick={handleAssociateExistingLink}
                />
            </div>

            {selectedLinkOption === 'createNewLink' && (
                <DsTypography variant="Regular_14">{t('databases.well-architect.create-new-link-text')}</DsTypography>
            )}

            {selectedLinkOption === 'associateExistingLink' && (
                <DsSelect
                    title={t('databases.well-architect.link-name')}
                    formatLabel={() => labelForDropDown()}
                    className={styles.selectBox}
                    // @ts-ignore
                    options={generateExistingLinkOptions}
                    selectionType="single"
                    onSelect={(option: any) => {
                        dispatch(setSelectedExistingLink(option?.[0] ?? null));
                        if (option?.[0]) {
                            dispatch(setShowLinkError(false));
                        }
                    }}
                    formatOptionLabel={(option: any) => (
                        <div className={styles.optionLabel}>
                            <DsTypography variant="Semibold_14" className={styles.optionText}>
                                {option.label}
                            </DsTypography>
                            {option.subLabel && (
                                <DsTypography variant="Regular_14" className={styles.optionSubText}>
                                    {option.subLabel}
                                </DsTypography>
                            )}
                        </div>
                    )}
                    isCleanable={false}
                    dropDown={{
                        isCloseOnClickOutside: true
                    }}
                    searchMethod={{
                        method: 'smart'
                    }}
                    isDisabled={false}
                    isLoading={existingLinksLoading}
                    {...(showLinkError && !selectedExistingLink
                        ? {
                              message: {
                                  type: 'error',
                                  value: 'Please select a link',
                                  tooltipValue: 'Please select a link'
                              }
                          }
                        : {})}
                />
            )}
        </div>
    );
};

export default CRRDataDialogContent;
