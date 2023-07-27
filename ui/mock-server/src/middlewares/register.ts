import cors from 'cors';
import bodyParser from 'body-parser';

const register = (app: any) => {
    app.use(cors());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
};

export default register;
