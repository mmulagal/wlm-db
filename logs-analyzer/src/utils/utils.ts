import { execa } from 'execa';
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import ms from 'ms';
import zlib from 'zlib';
import { join } from 'node:path';
import logger from './logging';

function getPowershellScript(sql: string[]) {
    return `
        # PowerShell script to run a set of SQL queries and return the output in user-readable format

        # Define the list of queries
        $queries = @(
            ${sql.map(sqlQuery =>`'${sqlQuery.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`).join(',\n  ')}
        )


        # Get all SQL Server instances on the machine
        $sqlInstances = Get-Service | Where-Object { $_.Name -like 'MSSQL$*' -or $_.Name -eq 'MSSQLSERVER' }

        # Initialize an array to store the results
        $results = @()

        # Iterate over each SQL Server instance
        foreach ($instance in $sqlInstances) {
            if ($instance.Name -eq 'MSSQLSERVER') {
                $instanceName = '$env:computername'
            } else {
                $instanceName = $instance.Name -replace 'MSSQL$', ''
            }

            # Iterate over each query and execute it on the current instance
            foreach ($query in $queries) {
            $sqlcmdCommand = "sqlcmd -Q \`"$query\`" -S \`"$instanceName\`" -y 0"
                try {
                    $result = Invoke-Expression $sqlcmdCommand
                    $results += [PSCustomObject]@{
                        Instance = $instanceName
                        Query = $query
                        Result = $result
                    }
                } catch {
                    $results += [PSCustomObject]@{
                        Instance = $instanceName
                        Query = $query
                        Error = $_.Exception.Message
                    }
                }
            }
        }

        # Convert the results to JSON format
        $jsonOutput = $results | ConvertTo-Json -Compress

        # Write the output to a file or console`;
}

function getBashScript(sql: string[]) {
    return `
        #!/bin/bash
        # Bash script to run a set of SQL queries on PostgreSQL and return the output in user-readable format

        # Define the list of queries
        queries=(
             ${sql.map(sqlQuery =>`'${sqlQuery.replace(/'/g, `'\\''`)}'`).join(',\n  ')}
        )

        # Initialize an array to store the results
        results=()

        # Iterate over each query and execute it
        for query in "\${queries[@]}"; do
            result=$(psql -U postgres -d postgres -c "$query" 2>&1)
            if [ $? -eq 0 ]; then
                results+=("{\\"Query\\": \\"$query\\", \\"Result\\": \\"$result\\"}")
            else
                results+=("{\\"Query\\": \\"$query\\", \\"Error\\": \\"$result\\"}")
            fi
        done

        # Convert the results to JSON format
        json_output=$(printf "%s\n" "\${results[@]}" | jq -s .)

        # Write the output to a file or console
        echo "$json_output"
    `;
}

async function runPowerShellScript(scriptContent: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const powershell = execa('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-']);

        let output = '';
        let errorOutput = '';

        powershell.stdout?.on('data', (data: Buffer) => {
            output += data.toString();
        });

        powershell.stderr?.on('data', (data: Buffer) => {
            errorOutput += data.toString();
        });

        powershell.on('close', (code: number) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`PowerShell script failed with code ${code}: ${errorOutput.trim()}`));
            }
        });

        powershell.on('error', (err: Error) => {
            reject(err);
        });

        powershell.stdin?.write(scriptContent);
        powershell.stdin?.end();
    });
}

async function runBashScript(scriptContent: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const bash = execa('/bin/bash', ['-c', scriptContent]);

        let output = '';
        let errorOutput = '';

        bash.stdout?.on('data', (data: Buffer) => {
            output += data.toString();
        });

        bash.stderr?.on('data', (data: Buffer) => {
            errorOutput += data.toString();
        });

        bash.on('close', (code: number) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`Bash script failed with code ${code}: ${errorOutput.trim()}`));
            }
        });

        bash.on('error', (err: Error) => {
            reject(err);
        });
    });
}

// Function to deflate a string using zlib , currently not being used. But can be used in the future when we need to compress the data before sending it to cloud watch
function deflateString(stringToCompress: string) {
    if (!stringToCompress || stringToCompress.trim() === '') {
        logger.info('The string to compress is either null or empty.');
        return null;
    }

    // Compress the string using zlib's deflate method
    const buffer = Buffer.from(stringToCompress, 'utf-8');
    const compressedBuffer = zlib.deflateSync(buffer);

    // Convert the compressed buffer to a Base64-encoded string
    const encodedString = compressedBuffer.toString('base64');

    return encodedString;
}

function deleteOlderFilesInDirectory(directory: string, days: number = 3) {
    logger.info(`Deleting files older than ${days} days in directory: ${directory}`);

    try {
        const files = readdirSync(directory);
        const now = new Date();
        for (const file of files) {
            const filePath = join(directory, file);
            const stats = statSync(filePath);
            const fileAge = now.getTime() - stats.mtimeMs;
            if (fileAge > ms(`${days}d`)) {
                // days in milliseconds
                unlinkSync(filePath);
            }
        }
    } catch (error) {
        logger.error(`Error deleting older files in directory ${directory}:`, error);
    }
}
export {
    getPowershellScript,
    getBashScript,
    runPowerShellScript,
    runBashScript,
    deflateString,
    deleteOlderFilesInDirectory
};
