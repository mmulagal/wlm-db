const TOOLS = [
    {
        toolSpec: {
            name: "analyze_db_logs",
            description: "Scan and analyze the logs folder to identify the database type, version, and cause of the error.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        logsFolderPath: {
                            type: "string",
                            description: "Path to the folder containing database logs to be scanned.",
                        }
                    },
                    required: ["logsFolderPath"]
                }
            },
        },
    }
]

export {
    TOOLS
};