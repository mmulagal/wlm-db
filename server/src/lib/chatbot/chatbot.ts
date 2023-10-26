import fs from 'fs';
import path from 'path';
import { createLanguageModel } from '../typechat/model';
import { createJsonTranslator, JsonTranslator } from '../typechat/translator';
import { Intent } from './schemas/mssql-schema';

class Chatbot {
    input!: string;

    translator!: JsonTranslator<Intent>;

    context!: string;

    static instance: Chatbot;

    constructor() {
        if (Chatbot.instance) {
            // eslint-disable-next-line no-constructor-return
            return Chatbot.instance;
        }

        const model = createLanguageModel();

        // open schema file containing ts definitions
        let filePath = path.join(process.cwd(), 'src', 'lib', 'chatbot', 'schemas', 'mssql-schema.ts');

        if (process.env.ENV_WLMDB_BUILD_MODE) {
            filePath = path.join(process.cwd(), 'lib', 'chatbot', 'schemas', 'mssql-schema.ts');
        }
        const schemaText = fs.readFileSync(filePath, 'utf8');

        this.translator = createJsonTranslator<Intent>(model, schemaText, 'Intent');
        this.context = `\n\nHuman: ${this.translator.createRequestPrompt()} \n\nAssistant: Sure!`;

        Chatbot.instance = this;
    }

    query(queryString: string) {
        return this.translator.translate(`${this.context} ${queryString}`);
    }
}

export default Chatbot;
