import crypto from 'crypto';
import os from 'os';
import { networkInterfaces } from 'os';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { systemInfo } from './sys_info.mjs';

/**
 * Generate user id.
 * 
 * @returns {string} - The generated user id.
 */
function generateUserId() {
    return uuidv4();
}

/**
 * Get machine id.
 * 
 * @returns {string} - The hashed machine id.
 */
function getMachineId() {
    const rawId = os.hostname();
    const hashedId = crypto.createHash('sha256').update(rawId).digest('hex');
    return hashedId;
}

/**
 * Gathers basic system information.
 * 
 * @returns {Object} - A dictionary containing system-related information.
 */
function getSystemInfo() {
    const nets = networkInterfaces();
    const ipAddress = Object.values(nets).flat().find(net => net.family === 'IPv4' && !net.internal)?.address || 'N/A';

    const macAddress = Object.values(nets).flat().find(net => net.mac && net.mac !== '00:00:00:00:00:00')?.mac || 'N/A';

    return {
        platform: os.platform(),
        platform_release: os.release(),
        platform_version: os.version(),
        architecture: os.arch(),
        hostname: os.hostname(),
        ip_address: ipAddress,
        mac_address: macAddress,
        processor: os.cpus()[0].model,
        python_version: process.version,
        Misc: systemInfo(),
    };
}

/**
 * Generate unique identifier.
 * 
 * @returns {string} - The generated unique id.
 */
function generateUniqueIdentifier() {
    const sysInfo = getSystemInfo();
    const uniqueId = uuidv5(JSON.stringify(sysInfo), uuidv5.DNS);
    return uniqueId;
}

/**
 * Get local IP address.
 * 
 * @returns {string} - The local IP address.
 */
function getLocalIp() {
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
 * Get user device data.
 * 
 * @returns {Object} - The user device data.
 */
function getUserDeviceData() {
    return {
        ID: generateUserId(),
        MachineID: getMachineId(),
        SystemInfo: getSystemInfo(),
        UniqueID: generateUniqueIdentifier(),
    };
}

export { generateUserId, getMachineId, getSystemInfo, generateUniqueIdentifier, getLocalIp, getUserDeviceData };