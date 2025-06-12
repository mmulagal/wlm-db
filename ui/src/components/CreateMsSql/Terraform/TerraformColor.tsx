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

const formatText = (text: any) => {
    const tabWidth = 4;
    const inputWithSpaces = text?.replace(/\t/g, ' '.repeat(tabWidth));
    const textLines = inputWithSpaces?.split('\n');
    const maxEqualDist = 32;
    const formattedLines = textLines?.map((line: string) => {
        if (line.includes('=')) {
            const equalDist = line.indexOf('=');
            if (equalDist < maxEqualDist) {
                const padding = ' '.repeat(maxEqualDist - equalDist);
                return line.slice(0, equalDist) + padding + line.slice(equalDist);
            }
            return line;
        }
        return line;
    });
    return formattedLines?.join('\n');
};

const TerraformColor = ({ data }: TerraformTypes) => {
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    return (
        <div className={styles.tfContainer}>
            <ThemeProvider theme="dark" isRoot={false}>
                {/* @ts-ignore */}
                <SyntaxHighlighter language="hcl">
                    {isDemoMode ? formatText(code) : formatText(data?.template)}
                </SyntaxHighlighter>
            </ThemeProvider>
        </div>
    );
};

export default TerraformColor;
