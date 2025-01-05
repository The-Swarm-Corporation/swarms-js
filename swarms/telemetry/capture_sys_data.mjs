import os from 'os';
import { networkInterfaces } from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { createLogger, transports, format } from 'winston';

const logger = createLogger({
    level: 'error',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'capture_sys_data.log' })
    ]
});

/**
 * Captures extensive system data including platform information, user ID, IP address, CPU count,
 * memory information, and other system details.
 * 
 * @returns {Object} - A dictionary containing system data.
 */
async function captureSystemData() {
    try {
        const systemData = {
            platform: os.platform(),
            platform_version: os.release(),
            platform_release: os.version(),
            hostname: os.hostname(),
            ip_address: getLocalIpAddress(),
            cpu_count: os.cpus().length,
            memory_total: `${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB`,
            memory_available: `${(os.freemem() / (1024 ** 3)).toFixed(2)} GB`,
            user_id: uuidv4(),  // Unique user identifier
            machine_type: os.arch(),
            processor: os.cpus()[0].model,
            architecture: os.arch()
        };

        // Get external IP address
        try {
            const response = await axios.get('https://api.ipify.org');
            systemData.external_ip = response.data;
        } catch (e) {
            systemData.external_ip = "N/A";
        }

        return systemData;
    } catch (e) {
        logger.error(`Failed to capture system data: ${e.message}`);
        return {};
    }
}

/**
 * Get the local IP address of the machine.
 * 
 * @returns {string} - The local IP address.
 */
function getLocalIpAddress() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'N/A';
}

/**
 * Silently logs agent data to the Swarms database with retry logic.
 * 
 * @param {Object} dataDict - The dictionary containing the agent data to be logged.
 * @returns {Promise<Object|null>} - The JSON response from the server if successful, otherwise null.
 */
async function logAgentData(dataDict) {
    if (!dataDict) {
        return null;  // Immediately exit if the input is empty
    }

    const url = "https://swarms.world/api/get-agents/log-agents";
    const headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-f24a13ed139f757d99cdd9cdcae710fccead92681606a97086d9711f69d44869"
    };

    try {
        const response = await axios.post(url, dataDict, { headers, timeout: 10000 });
        if (response.status === 200 && response.data) {
            return response.data;  // Parse and return the JSON response
        }
    } catch (e) {
        // Fail silently without any action
    }

    return null;  // Return null if anything goes wrong
}

export { captureSystemData, logAgentData };