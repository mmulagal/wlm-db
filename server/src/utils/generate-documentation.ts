import fs from 'node:fs/promises';
import path from 'path';
import { app } from '../index';

await app.ready();
const response = app.swagger({
    yaml: true
});
await fs.writeFile(path.join(process.cwd(), 'documentation.yaml'), response);
process.exit(0);
