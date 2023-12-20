import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';

type accordionType = {
    handleToggle: any;
    openKey: string;
};

const ISActiveDirectory = ({ handleToggle, openKey }: accordionType) => {
    const resourceDetails = useAppSelector(state => state.workloadFactoryResource.resourceDetails);
    const contentArea = () => {
        return (
            <>
                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.DOMAIN_NAME_INFO}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.topology?.activeDirectoryDetails?.name || ''}
                    >
                        {resourceDetails?.topology?.activeDirectoryDetails?.name}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.DNS_ADDRESS_INFO}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.topology?.activeDirectoryDetails?.address || ''}
                    >
                        {resourceDetails?.topology?.activeDirectoryDetails?.address}
                    </Typography>
                </div>
            </>
        );
    };
    return (
        <div className={''}>
            <DbAccordion
                heading="Active Directory"
                toggle={handleToggle}
                open={openKey === 'Active Directory'}
                content={contentArea()}
            />
        </div>
    );
};

export default ISActiveDirectory;
