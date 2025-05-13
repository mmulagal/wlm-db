import { execa } from "execa";
import { readdirSync, statSync, unlinkSync } from "node:fs";
import ms from "ms";
import zlib from 'zlib';
import { join } from "node:path";

function getPowershellScript(sql: string[]) {
    return `
        # PowerShell script to run a set of SQL queries and return the output in user-readable format

        # Define the list of queries
        $queries = @(
            ${sql.map(sqlQuery => `'${sqlQuery.replace(/'/g, "''")}'`).join(",\n  ")}
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
                $instanceName = $instance.Name -replace 'MSSQL\$', ''
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
            ${sql.map(sqlQuery => `"${sqlQuery.replace(/"/g, '\\"')}"`).join(" \\\n            ")}
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
        const powershell = execa("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "-"]);

        let output = "";
        let errorOutput = "";

        powershell.stdout?.on("data", (data: Buffer) => {
            output += data.toString();
        });

        powershell.stderr?.on("data", (data: Buffer) => {
            errorOutput += data.toString();
        });

        powershell.on("close", (code: number) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`PowerShell script failed with code ${code}: ${errorOutput.trim()}`));
            }
        });

        powershell.on("error", (err: Error) => {
            reject(err);
        });

        powershell.stdin?.write(scriptContent);
        powershell.stdin?.end();
    });
}


async function runBashScript(scriptContent: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const bash = execa("/bin/bash", ["-c", scriptContent]);

        let output = "";
        let errorOutput = "";

        bash.stdout?.on("data", (data: Buffer) => {
            output += data.toString();
        });

        bash.stderr?.on("data", (data: Buffer) => {
            errorOutput += data.toString();
        });

        bash.on("close", (code: number) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`Bash script failed with code ${code}: ${errorOutput.trim()}`));
            }
        });

        bash.on("error", (err: Error) => {
            reject(err);
        });
    });
}

function deflateString(stringToCompress: string) {
    if (!stringToCompress || stringToCompress.trim() === '') {
        console.info('The string to compress is either null or empty.');
        return null;
    }

    // Compress the string using zlib's deflate method
    const buffer = Buffer.from(stringToCompress, 'utf-8');
    const compressedBuffer = zlib.deflateSync(buffer);

    // Convert the compressed buffer to a Base64-encoded string
    const encodedString = compressedBuffer.toString('base64');

    return encodedString;
}

function getLogsAnalyzerSetupScript(s3SignedUrl: string, packageName: string): string {
    return `
        # PowerShell script to set up the Logs Analyzer package on a SQL node

        # Function to check if a command exists
        function Command-Exists {
            param (
                [string]$Command
            )
            return Get-Command $Command -ErrorAction SilentlyContinue
        }

        # Retry function for network commands
        function Retry-Command {
            param (
                [scriptblock]$Command,
                [int]$Retries = 5
            )
            $Count = 0
            while ($Count -lt $Retries) {
                try {
                    & $Command
                    return
                } catch {
                    $Count++
                    if ($Count -ge $Retries) {
                        Write-Host "Command failed after $Retries attempts."
                        throw
                    }
                    Write-Host "Retrying... ($Count/$Retries)"
                    Start-Sleep -Seconds 5
                }
            }
        }

        # Step 1: Check if Node.js is installed
        Write-Host "Checking for Node.js installation..."
        if (-Not (Command-Exists node)) {
            Write-Host "Node.js is not installed. Installing Node.js..."
            Retry-Command {
                Invoke-WebRequest -Uri https://nodejs.org/dist/v18.16.0/node-v18.16.0-x64.msi -OutFile nodejs.msi
            }
            Start-Process msiexec.exe -ArgumentList '/i nodejs.msi /quiet' -Wait
            Remove-Item -Force nodejs.msi
        } else {
            Write-Host "Node.js is already installed."
        }

        # Step 2: Download the latest version of the Logs Analyzer package from a signed URL
        Write-Host "Downloading the latest version of the Logs Analyzer package..."
        Retry-Command {
            Invoke-WebRequest -Uri ${s3SignedUrl} -OutFile ./${packageName}
        }

        # Step 3: Set execution permissions for the package
        Write-Host "Setting execution permissions for the package..."
        try {
            icacls ./${packageName} /grant Everyone:F
        } catch {
            Write-Host "Failed to set execution permissions for the package."
            throw
        }

        # Step 4: Run the Logs Analyzer
        Write-Host "Running the Logs Analyzer..."
        if (Command-Exists node) {
            try {
                ./${packageName}
            } catch {
                Write-Host "Failed to run Logs Analyzer."
                throw
            }
        } else {
            Write-Host "Node.js is not available. Please ensure it is installed correctly."
            throw
        }
    `;
}

function getLogsAnalyzerSetupScriptLinux(s3SignedUrl: string, packageName: string): string {
    return `
        #!/bin/bash
        # Generic Bash script to set up the Logs Analyzer package on a Linux machine

        # Function to check if a command exists
        command_exists() {
            command -v "$1" &> /dev/null
        }

        # Retry function for network commands
        retry_command() {
            local retries=5
            local count=0
            until "$@"; do
                exit_code=$?
                count=$((count + 1))
                if [ $count -lt $retries ]; then
                    echo "Retrying... ($count/$retries)"
                    sleep 5
                else
                    echo "Command failed after $retries attempts."
                    return $exit_code
                fi
            done
            return 0
        }

        # Step 1: Check if Node.js is installed
        echo "Checking for Node.js installation..."
        if ! command_exists node; then
            echo "Node.js is not installed. Installing Node.js..."
            if command_exists apt-get; then
                retry_command curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                sudo apt-get install -y nodejs
            elif command_exists yum; then
                retry_command curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
                sudo yum install -y nodejs
            elif command_exists dnf; then
                retry_command curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
                sudo dnf install -y nodejs
            else
                echo "Unsupported package manager. Please install Node.js manually."
                exit 1
            fi
        else
            echo "Node.js is already installed."
        fi

        # Step 2: Download the latest version of the Logs Analyzer package from a signed URL
        echo "Downloading the latest version of the Logs Analyzer package..."
        if command_exists curl; then
            retry_command curl -o ${packageName} "${s3SignedUrl}" || { echo "Failed to download package."; exit 1; }
        elif command_exists wget; then
            retry_command wget -O ${packageName} "${s3SignedUrl}" || { echo "Failed to download package."; exit 1; }
        else
            echo "Neither curl nor wget is available. Please install one of them to proceed."
            exit 1
        fi

        # Step 3: Setting execution permissions for the package
        echo "Setting execution permissions for the package..."
        chmod +x ${packageName}


        # Step 4: Run the Logs Analyzer
        echo "Running the Logs Analyzer..."
        if command_exists node; then
            ./${packageName} || { echo "Failed to run Logs Analyzer."; exit 1; }
        else
            echo "Node.js is not available. Please ensure it is installed correctly."
            exit 1
        fi
    `;
}

function deleteOlderFilesInDirectory(directory: string, days: number = 3) {
    try {
        const files = readdirSync(directory);
        const now = new Date();
        for (const file of files) {
            const filePath = join(directory, file);
            const stats = statSync(filePath);
            const fileAge = now.getTime() - stats.mtimeMs;
            if (fileAge > ms(`${days}d`)) { // 7 days in milliseconds
                unlinkSync(filePath);
            }
        }

    } catch (error) {
        console.error(`Error deleting older files in directory ${directory}:`, error);
    }
}
export {
    getPowershellScript, getBashScript,
    runPowerShellScript, runBashScript,
    getLogsAnalyzerSetupScript, getLogsAnalyzerSetupScriptLinux,
    deflateString,
    deleteOlderFilesInDirectory
}