import { useAppSelector } from '../../../../store/storeHooks';
import { DBType, ERROR_ANALYZER_STATUS } from '../../../../utils/consts';
import ErrorInvestigation from './ErrorInvestigation';
import ActivatingScreen from './LogAnalyzerOnboarding/ActivatingScreen/ActivatingScreen';
import LogAnalyzerOnboarding from './LogAnalyzerOnboarding/LogAnalyzerOnboarding';

const ErrorInvestigationTab = () => {
    const { logAnalyzerState } = useAppSelector(state => state?.agenticAI);
    return (
        <>
            {logAnalyzerState === ERROR_ANALYZER_STATUS.ACTIVE && <ErrorInvestigation dbType={DBType.MSSQL} />}
            {logAnalyzerState === ERROR_ANALYZER_STATUS.NOT_ACTIVE && <LogAnalyzerOnboarding dbType={DBType.MSSQL} />}
            {logAnalyzerState === ERROR_ANALYZER_STATUS.RUNNING && <ActivatingScreen dbType={DBType.MSSQL} />}
        </>
    );
};

export default ErrorInvestigationTab;
