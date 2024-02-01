import fs from 'node:fs/promises';
import { app } from '../index';

await app.ready();
const response = app.swagger({
    yaml: true
});
await fs.writeFile('./documentation.yaml', response);
process.exit(0);
