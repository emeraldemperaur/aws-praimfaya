import axios from 'axios';
import * as xlsx from "xlsx";
import * as jwt from "jsonwebtoken";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ToolExecutionContext } from './types';


export const executeAirtable = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const AIRTABLE_API_KEY = ephemeralSecrets.airtableApiKey;
    if (!AIRTABLE_API_KEY) {
        return { error: "Missing Airtable API Key. You MUST call 'request_secure_credentials' with serviceName 'airtable'." };
    }

    try {
        const headers = { 
            Authorization: `Bearer ${AIRTABLE_API_KEY}`, 
            'Content-Type': 'application/json' 
        };
        const { action, baseId, tableIdOrName, fileUrl, queryParams, recordsData } = toolInput;
        const baseUrl = `https://api.airtable.com/v0`;

        if (action === 'INSPECT_SCHEMA' && baseId) {
            const res = await axios.get(`${baseUrl}/meta/bases/${baseId}/tables`, { headers });
            return { status: "Success", tables: res.data.tables.map((t: any) => ({ name: t.name, id: t.id, fields: t.fields.map((f:any) => f.name) })) };
        } 
        else if (action === 'QUERY_RECORDS' && baseId && tableIdOrName) {
            const query = queryParams ? `?${queryParams}` : '';
            const res = await axios.get(`${baseUrl}/${baseId}/${encodeURIComponent(tableIdOrName)}${query}`, { headers });
            return { status: "Success", records: res.data.records };
        }
        else if (action === 'CREATE_RECORDS' && baseId && tableIdOrName && recordsData) {
            const payload = { records: JSON.parse(recordsData), typecast: true };
            const res = await axios.post(`${baseUrl}/${baseId}/${encodeURIComponent(tableIdOrName)}`, payload, { headers });
            return { status: "Success", createdRecords: res.data.records.length };
        }
        else if (action === 'INGEST_SPREADSHEET' && fileUrl && baseId && tableIdOrName) {
            const fileRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const workbook = xlsx.read(fileRes.data, { type: 'buffer' });
            const firstSheetName = workbook.SheetNames[0];
            const rawJson = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
            
            const mappedRecords = rawJson.slice(0, 10).map(row => ({ fields: row }));
            
            const payload = { records: mappedRecords, typecast: true };
            const res = await axios.post(`${baseUrl}/${baseId}/${encodeURIComponent(tableIdOrName)}`, payload, { headers });
            
            return { 
                status: "Success", 
                message: `Parsed ${workbook.SheetNames.length} sheets. Ingested ${mappedRecords.length} rows into ${tableIdOrName}.`,
                totalRowsInFile: rawJson.length
            };
        }

        return { error: `Missing required parameters or unsupported Airtable action: ${action}` };
    } catch (err: any) { 
        return { error: `Airtable Error: ${err.response?.data?.error?.message || err.message}` }; 
    }
};


export function generateSnowflakeJWT(account: string, user: string, key: string): string { 
    return jwt.sign(
        { iss: `${account.toUpperCase()}.${user.toUpperCase()}`, sub: `${account.toUpperCase()}.${user.toUpperCase()}` }, 
        key, 
        { algorithm: 'RS256', expiresIn: '1h' }
    ); 
}

export const executeSnowflake = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const sfAccount = ephemeralSecrets.snowflakeAccount;
    const sfUser = ephemeralSecrets.snowflakeUser;
    const sfPrivateKey = ephemeralSecrets.snowflakePrivateKey;

    if (!sfAccount || !sfUser || !sfPrivateKey) {
        return { error: "Missing Snowflake credentials. Call 'request_secure_credentials' with serviceName 'snowflake'." };
    }

    try {
        const token = generateSnowflakeJWT(sfAccount, sfUser, sfPrivateKey);
        const headers = { 
            Authorization: `Bearer ${token}`, 
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT' 
        };
        const { sqlQuery, database, schemaName, warehouse, role } = toolInput;
        
        const payload: any = { 
            statement: sqlQuery, 
            database: database, 
            schema: schemaName 
        };
        if (warehouse) payload.warehouse = warehouse;
        if (role) payload.role = role;

        const res = await axios.post(`https://${sfAccount}.snowflakecomputing.com/api/v2/statements`, payload, { headers });
        
        if (res.data?.code === '333334') {
            return { status: "Processing", message: "Query is running asynchronously.", statementHandle: res.data.statementHandle };
        }
        
        return { status: "Success", data: res.data };
    } catch (err: any) { 
        return { error: `Snowflake Error: ${err.response?.data?.message || err.message}` }; 
    }
};


export const executeAirflow = async ({ toolInput, ephemeralSecrets, env, clients }: ToolExecutionContext) => {
    const airflowUrl = ephemeralSecrets.airflowBaseUrl;
    const airflowAuth = ephemeralSecrets.airflowAuthHeader; 

    if (!airflowUrl) {
        return { error: "Missing Airflow credentials. Call 'request_secure_credentials' with serviceName 'airflow'." };
    }

    try {
        const headers: any = { 'Content-Type': 'application/json' };
        if (airflowAuth) headers['Authorization'] = airflowAuth;

        const { action, dagId, dagRunId, logicalDate, dagPythonCode, dagFilename } = toolInput;
        const baseUrl = `${airflowUrl.replace(/\/$/, "")}/api/v1`;

        if (action === 'GENERATE_AND_DEPLOY_DAG' && dagPythonCode) {
            const lambdaArn = env.PYTHON_VALIDATOR_LAMBDA_ARN;
            const dagsBucket = env.AIRFLOW_DAGS_BUCKET;
            
            if (!lambdaArn || !dagsBucket) {
                return { error: "Backend Configuration Error: Airflow DAG deployment requires PYTHON_VALIDATOR_LAMBDA_ARN and AIRFLOW_DAGS_BUCKET environment variables to be set in the infrastructure." };
            }

            const validationRes = await clients.lambda.send(new InvokeCommand({ 
                FunctionName: lambdaArn, 
                Payload: Buffer.from(JSON.stringify({ dagPythonCode })) 
            }));
            
            const validationResult = JSON.parse(Buffer.from(validationRes.Payload!).toString());
            if (!validationResult.valid) {
                return { error: `DAG Code Validation Failed. Syntax or dependency error: ${validationResult.error}` };
            }

            const targetFilename = dagFilename || `generated_dag_${Date.now()}.py`;
            await clients.s3.send(new PutObjectCommand({
                Bucket: dagsBucket,
                Key: `dags/${targetFilename}`,
                Body: Buffer.from(dagPythonCode),
                ContentType: "text/x-python"
            }));
            
            return { status: "Success", message: `DAG validated and successfully deployed to s3://${dagsBucket}/dags/${targetFilename}.` };
        }
        else if (action === 'TRIGGER_DAG' && dagId) {
            const payload = logicalDate ? { logical_date: logicalDate } : {};
            const res = await axios.post(`${baseUrl}/dags/${dagId}/dagRuns`, payload, { headers });
            return { status: "Success", dagRunId: res.data.dag_run_id, state: res.data.state };
        }
        else if (action === 'GET_DAG_RUNS' && dagId) {
            const res = await axios.get(`${baseUrl}/dags/${dagId}/dagRuns?limit=10&order_by=-start_date`, { headers });
            return { status: "Success", runs: res.data.dag_runs };
        }
        else if (action === 'GET_FAILED_TASKS' && dagId && dagRunId) {
            const res = await axios.get(`${baseUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances?state=failed`, { headers });
            return { status: "Success", failedTasks: res.data.task_instances };
        }

        return { error: `Missing required parameters or unsupported Airflow action: ${action}` };
    } catch (err: any) { 
        return { error: `Airflow API Error: ${err.response?.data?.detail || err.message}` }; 
    }
};