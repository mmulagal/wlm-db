import ThemeProvider from '../../../common/ThemeProvider/ThemeProvider';
import SyntaxHighlighter from '../../../common/hooks/SyntaxHighlighter';
import { useAppSelector } from '../../../store/storeHooks';
import styles from './Terraform.module.scss';
import { code } from './mockData';

type TerraformTypes = {
    data: {
        url?: string;
        template?: string;
    };
};

const TerraformColor = ({ data }: TerraformTypes) => {
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    return (
        <div className={styles.tfContainer}>
            <ThemeProvider theme={'dark'} isRoot={false}>
                {/* @ts-ignore */}
                <SyntaxHighlighter wordbreak={'break-all'} wrapLongLines={true} language="hcl">
                    {isDemoMode ? code : data?.template}
                </SyntaxHighlighter>
            </ThemeProvider>
        </div>
    );
};

export default TerraformColor;
