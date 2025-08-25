import { Typography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

type accordionType = {
    handleToggle: any;
    openKey: string;
    resourceDetails: any;
    resourceLoading: boolean;
};

const Location = ({ handleToggle, openKey, resourceDetails, resourceLoading }: accordionType) => {
    const { t } = useTranslation();
    const contentArea = () => (
        <>
            <div className={commonStyles.row}>
                <Typography variant="Semibold_14" className={commonStyles.heading}>
                    {GENERAL.AWS_ACC_INFO}
                </Typography>
                <Typography
                    variant="Regular_14"
                    className={commonStyles.valueCSS}
                    title={resourceDetails?.topology?.awsAccount || ''}
                >
                    {resourceDetails?.topology?.awsAccount}
                </Typography>
            </div>

            <div className={commonStyles.row}>
                <Typography variant="Semibold_14" className={commonStyles.heading}>
                    {GENERAL.REGION_INFO}
                </Typography>
                <Typography
                    variant="Regular_14"
                    className={commonStyles.valueCSS}
                    title={resourceDetails?.topology?.region || ''}
                >
                    {resourceDetails?.topology?.region}
                </Typography>
            </div>

            {resourceDetails?.topology?.ec2Details?.length && (
                <>
                    <div className={commonStyles.row}>
                        <Typography variant="Semibold_14" className={commonStyles.heading}>
                            {resourceDetails?.topology?.ec2Details?.length === 1
                                ? t('databases.resource-overview.availability-zone')
                                : t('databases.resource-overview.availability-zone-1')}
                        </Typography>
                        <Typography
                            variant="Regular_14"
                            className={commonStyles.valueCSS}
                            title={resourceDetails?.topology?.ec2Details[0]?.availabilityZone || ''}
                        >
                            {resourceDetails?.topology?.ec2Details[0]?.availabilityZone}
                        </Typography>
                    </div>

                    <div className={commonStyles.row}>
                        <Typography variant="Semibold_14" className={commonStyles.heading}>
                            {resourceDetails?.topology?.ec2Details?.length === 1
                                ? t('databases.resource-overview.subnet')
                                : t('databases.resource-overview.subnet-1')}
                        </Typography>
                        <Typography
                            variant="Regular_14"
                            className={commonStyles.valueCSS}
                            title={resourceDetails?.topology?.ec2Details[0]?.subnetId || ''}
                        >
                            {resourceDetails?.topology?.ec2Details[0]?.subnetId}
                        </Typography>
                    </div>
                </>
            )}

            {resourceDetails?.topology?.ec2Details?.length > 1 && (
                <>
                    <div className={commonStyles.row}>
                        <Typography variant="Semibold_14" className={commonStyles.heading}>
                            {GENERAL.AZ_INFO_2}
                        </Typography>
                        <Typography
                            variant="Regular_14"
                            className={commonStyles.valueCSS}
                            title={resourceDetails?.topology?.ec2Details[1]?.availabilityZone || ''}
                        >
                            {resourceDetails?.topology?.ec2Details[1]?.availabilityZone}
                        </Typography>
                    </div>

                    <div className={commonStyles.row}>
                        <Typography variant="Semibold_14" className={commonStyles.heading}>
                            {GENERAL.SUBNET_INFO_2}
                        </Typography>
                        <Typography
                            variant="Regular_14"
                            className={commonStyles.valueCSS}
                            title={resourceDetails?.topology?.ec2Details[1]?.subnetId || ''}
                        >
                            {resourceDetails?.topology?.ec2Details[1]?.subnetId}
                        </Typography>
                    </div>
                </>
            )}
        </>
    );
    return (
        <div className="">
            <DbAccordion
                resourceLoading={resourceLoading}
                heading="Location"
                toggle={handleToggle}
                open={openKey === 'Location'}
                content={contentArea()}
            />
        </div>
    );
};

export default Location;
