import os from 'os';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import toml from 'toml';

const require = createRequire(import.meta.url);
const psutil = require('psutil');
const pkg_resources = require('pkg_resources');

/**
 * Get Python version.
 * 
 * @returns {string} - The version of Python installed.
 */
function getPythonVersion() {
    return process.version;
}

/**
 * Get pip version.
 * 
 * @returns {string} - The version of pip installed.
 */
function getPipVersion() {
    try {
        const pipVersion = execSync('pip --version').toString().split(' ')[1];
        return pipVersion;
    } catch (e) {
        return e.message;
    }
}

/**
 * Get swarms version from both command line and package.
 * 
 * @returns {Array<string>} - A tuple containing (command line version, package version).
 */
function getSwarmsVersion() {
    let swarmsVersionCmd;
    try {
        swarmsVersionCmd = execSync('swarms --version').toString().split(' ')[1];
    } catch (e) {
        swarmsVersionCmd = e.message;
    }
    const swarmsVersionPkg = pkg_resources.get_distribution('swarms').version;
    return [swarmsVersionCmd, swarmsVersionPkg];
}

/**
 * Get operating system version.
 * 
 * @returns {string} - The operating system version and platform details.
 */
function getOsVersion() {
    return `${os.type()} ${os.release()} ${os.arch()}`;
}

/**
 * Get CPU information.
 * 
 * @returns {string} - The processor information.
 */
function getCpuInfo() {
    return os.cpus()[0].model;
}

/**
 * Get RAM information.
 * 
 * @returns {string} - A formatted string containing total, used and free RAM in GB.
 */
function getRamInfo() {
    const totalRamGb = os.totalmem() / (1024 ** 3);
    const freeRamGb = os.freemem() / (1024 ** 3);
    const usedRamGb = totalRamGb - freeRamGb;
    return `${totalRamGb.toFixed(2)} GB, used: ${usedRamGb.toFixed(2)}, free: ${freeRamGb.toFixed(2)}`;
}

/**
 * Get package version mismatches between pyproject.toml and installed packages.
 * 
 * @param {string} [filePath="pyproject.toml"] - Path to pyproject.toml file.
 * @returns {string} - A formatted string containing package version mismatches.
 */
function getPackageMismatches(filePath = "pyproject.toml") {
    const pyproject = toml.parse(readFileSync(filePath, 'utf8'));
    const dependencies = { ...pyproject.tool.poetry.dependencies, ...pyproject.tool.poetry.group.dev.dependencies };

    const installedPackages = Object.fromEntries(pkg_resources.working_set.map(pkg => [pkg.key, pkg.version]));

    const mismatches = [];
    for (const [pkg, versionInfo] of Object.entries(dependencies)) {
        const version = typeof versionInfo === 'object' ? versionInfo.version : versionInfo;
        const installedVersion = installedPackages[pkg];
        if (installedVersion && version.startsWith("^")) {
            const expectedVersion = version.slice(1);
            if (!installedVersion.startsWith(expectedVersion)) {
                mismatches.push(`\t  ${pkg}: Mismatch, pyproject.toml=${expectedVersion}, pip=${installedVersion}`);
            }
        } else {
            mismatches.push(`\t  ${pkg}: Not found in pip list`);
        }
    }

    return "\n" + mismatches.join("\n");
}

/**
 * Get system information including Python, pip, OS, CPU and RAM details.
 * 
 * @returns {Object<string, string>} - A dictionary containing system information.
 */
function systemInfo() {
    return {
        "Python Version": getPythonVersion(),
        "Pip Version": getPipVersion(),
        // "Swarms Version": getSwarmsVersion(),
        "OS Version and Architecture": getOsVersion(),
        "CPU Info": getCpuInfo(),
        "RAM Info": getRamInfo(),
    };
}

export {
    getPythonVersion,
    getPipVersion,
    getSwarmsVersion,
    getOsVersion,
    getCpuInfo,
    getRamInfo,
    getPackageMismatches,
    systemInfo
};