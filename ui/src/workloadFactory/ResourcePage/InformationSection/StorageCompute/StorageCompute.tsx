import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';

type accordionType = {
    handleToggle: any;
    openKey: string;
};

const StorageCompute = ({ handleToggle, openKey }: accordionType) => {
    const contentArea = () => {
        return (
            <>
                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        DB Instance type:
                    </Typography>
                    <Typography variant="Regular_14">c4.2xlarge</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        File system name:
                    </Typography>
                    <Typography variant="Regular_14">wlmdb-fsx-1</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        File system ID:
                    </Typography>
                    <Typography variant="Regular_14">fs-0d5efc3057c4f12cb</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        File system type:
                    </Typography>
                    <Typography variant="Regular_14">FSx ONTAP</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        File system status:
                    </Typography>
                    <Typography variant="Regular_14">Available</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Storage capacity:
                    </Typography>
                    <Typography variant="Regular_14">1,025 GiB</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        File system deployment type:
                    </Typography>
                    <Typography variant="Regular_14">Multi-AZ</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        FSx Throughput capacity:
                    </Typography>
                    <Typography variant="Regular_14">128MB/s</Typography>
                </div>
            </>
        );
    };
    return (
        <div className={''}>
            <DbAccordion
                heading="Storage & Compute"
                toggle={handleToggle}
                open={openKey === 'Storage & Compute'}
                content={contentArea()}
            />
        </div>
    );
};

export default StorageCompute;
