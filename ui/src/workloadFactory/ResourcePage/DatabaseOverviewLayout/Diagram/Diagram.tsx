import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { ReactComponent as FCIDarkMode } from '../../../../assets/FCI_Darkmode.svg';
import { ReactComponent as FCILightMode } from '../../../../assets/FCI_lightMode.svg';
import { ReactComponent as StandaloneDarkMode } from '../../../../assets/Standalone_darkmode.svg';
import { ReactComponent as StandaloneLightMode } from '../../../../assets/Standalone_lightMode.svg';
import styles from './Diagram.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';

const Diagram = () => {
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const setDiagramForFCI = () => {
        if (isDarkTheme) {
            return <FCIDarkMode />;
        }
        return <FCILightMode />;
    };

    const setDiagramForStandAlone = () => {
        if (isDarkTheme) {
            return <StandaloneDarkMode />;
        }
        return <StandaloneLightMode />;
    };
    return (
        <div
            className={
                resourceLoading || resourceDetails?.topology?.serverInstallationMode === ''
                    ? `${styles.diagram} ${styles.hideDiagram}`
                    : `${styles.diagram}`
            }
        >
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.TOPOLOGY}
                </Typography>
                {resourceLoading && <FlashingDotsLoader />}
                {!resourceLoading && resourceDetails?.topology?.serverInstallationMode === '' && (
                    <Typography variant="Regular_16" className={styles.disabledColor}>
                        {GENERAL.NOT_AVAILABLE}
                    </Typography>
                )}
            </div>

            {!resourceLoading && (
                <div className={styles.centerContainer}>
                    {resourceDetails?.topology?.serverInstallationMode?.toLowerCase() === 'fci' && setDiagramForFCI()}
                    {resourceDetails?.topology?.serverInstallationMode?.toLowerCase() === 'standalone' &&
                        setDiagramForStandAlone()}
                </div>
            )}
        </div>
    );
};

export default Diagram;
