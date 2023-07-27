/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */

import { SQL_AMI_NAMES } from './consts';
import getLogger from './logger';

const logger = getLogger();

function filterSqlAmis(osVersion?: string, dbVersion?: string, dbEdition?: string) {
    logger.debug({ osVersion, dbEdition, dbVersion });
    return SQL_AMI_NAMES.filter(name => (osVersion ? name.includes(`Windows_Server-${osVersion}`) : true))
        .filter(name => (dbVersion ? name.includes(`SQL_${dbVersion}`) : true))
        .filter(name => (dbEdition ? name.includes(dbEdition) : true));
}

export { filterSqlAmis };
