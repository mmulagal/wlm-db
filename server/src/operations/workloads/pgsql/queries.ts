const DATABASES_COUNT = 'sudo -u postgres /usr/bin/psql -t -A -c "Select Count(*) from pg_database"';

export default DATABASES_COUNT;
