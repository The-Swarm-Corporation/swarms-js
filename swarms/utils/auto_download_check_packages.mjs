/**
 * Package installation utility that checks for package existence and installs if needed.
 * Supports both npm and yarn package managers.
 */

import { execSync } from 'child_process';
import { logger } from './loguru_logger.mjs';

/**
 * Check if a package is installed and install it if not found.
 * 
 * @param {string} packageName - Name of the package to check/install.
 * @param {string} [packageManager="npm"] - Package manager to use ('npm' or 'yarn').
 * @param {string} [version=null] - Specific version to install (optional).
 * @param {boolean} [upgrade=false] - Whether to upgrade the package if it exists.
 * @returns {boolean} - True if package is available after check/install, False if installation failed.
 * @throws {Error} - If invalid package manager is specified.
 */
function checkAndInstallPackage(packageName, packageManager = "npm", version = null, upgrade = false) {
    try {
        // Check if package exists
        try {
            require.resolve(packageName);
            if (!upgrade) {
                logger.info(`Package ${packageName} is already installed`);
                return true;
            }
        } catch (e) {
            // Package not found, proceed to install
        }

        // Construct installation command
        let cmd = `${packageManager} install`;
        if (upgrade) {
            cmd += " --upgrade";
        }

        if (version) {
            cmd += ` ${packageName}@${version}`;
        } else {
            cmd += ` ${packageName}`;
        }

        // Run installation
        logger.info(`Installing ${packageName}...`);
        execSync(cmd, { stdio: 'inherit' });

        // Verify installation
        try {
            require.resolve(packageName);
            logger.info(`Successfully installed ${packageName}`);
            return true;
        } catch (e) {
            logger.error(`Package ${packageName} was installed but cannot be imported`);
            return false;
        }

    } catch (e) {
        logger.error(`Failed to install ${packageName}: ${e.message}`);
        return false;
    }
}

/**
 * Ensure multiple packages are installed.
 * 
 * @param {string|Array<string>} packages - Single package name or list of package names.
 * @param {string} [packageManager="npm"] - Package manager to use ('npm' or 'yarn').
 * @param {boolean} [upgrade=false] - Whether to upgrade existing packages.
 * @returns {boolean} - True if all packages are available, False if any installation failed.
 */
function autoCheckAndDownloadPackage(packages, packageManager = "npm", upgrade = false) {
    if (typeof packages === 'string') {
        packages = [packages];
    }

    let success = true;
    for (const packageName of packages) {
        const [name, version] = packageName.split(":");
        if (!checkAndInstallPackage(name, packageManager, version, upgrade)) {
            success = false;
        }
    }

    return success;
}

export { checkAndInstallPackage, autoCheckAndDownloadPackage };