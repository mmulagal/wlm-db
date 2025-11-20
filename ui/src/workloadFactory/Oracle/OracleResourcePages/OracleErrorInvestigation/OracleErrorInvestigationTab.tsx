import { useAppSelector } from '../../../../store/storeHooks';
import { DBType, ERROR_ANALYZER_STATUS } from '../../../../utils/consts';
import ErrorInvestigation from '../../../GetWell/WellArchitectDashboard/ErrorInvestigation/ErrorInvestigation';
import ActivatingScreen from '../../../GetWell/WellArchitectDashboard/ErrorInvestigation/LogAnalyzerOnboarding/ActivatingScreen/ActivatingScreen';
import LogAnalyzerOnboarding from '../../../GetWell/WellArchitectDashboard/ErrorInvestigation/LogAnalyzerOnboarding/LogAnalyzerOnboarding';

const OracleErrorInvestigationTab = () => {
    const { logAnalyzerState } = useAppSelector(state => state?.agenticAI);
    return (
        <>
            {logAnalyzerState === ERROR_ANALYZER_STATUS.ACTIVE && <ErrorInvestigation dbType={DBType.ORACLE} />}
            {logAnalyzerState === ERROR_ANALYZER_STATUS.NOT_ACTIVE && <LogAnalyzerOnboarding dbType={DBType.ORACLE} />}
            {logAnalyzerState === ERROR_ANALYZER_STATUS.RUNNING && <ActivatingScreen dbType={DBType.ORACLE} />}
        </>
    );
};

export default OracleErrorInvestigationTab;
