import { executeOnGpu, executeOnMultipleGpus, listAvailableGpus, executeWithAllCpuCores, executeOnCpu } from 'clusterops';
import { initialize_logger } from './loguru_logger.mjs';

const logger = initialize_logger({ log_folder: "clusterops_wrapper" });

/**
 * Executes a given function on a specified device, either CPU or GPU.
 * 
 * This method attempts to execute a given function on a specified device, either CPU or GPU. It logs the device selection and the number of cores or GPU ID used. If the device is set to CPU, it can use all available cores or a specific core specified by `deviceId`. If the device is set to GPU, it uses the GPU specified by `deviceId`.
 * 
 * @param {string} [device="cpu"] - The device to use for execution.
 * @param {number} [deviceId=1] - The ID of the GPU to use if device is set to "gpu".
 * @param {boolean} [allCores=true] - If true, uses all available CPU cores.
 * @param {boolean} [allGpus=false] - If true, uses all available GPUs.
 * @param {Function} func - The function to execute.
 * @param {boolean} [enableLogging=true] - If true, enables logging.
 * @param {...any} args - Additional positional arguments to be passed to the execution method.
 * @returns {Promise<any>} - The result of the execution.
 * @throws {Error} - If an invalid device is specified or any other error occurs during execution.
 */
async function execCallableWithClusterops({
    device = "cpu",
    deviceId = 1,
    allCores = true,
    allGpus = false,
    func = null,
    enableLogging = true,
    ...args
} = {}) {
    if (typeof func !== 'function') {
        throw new Error("A callable function must be provided");
    }

    try {
        if (enableLogging) {
            logger.info(`Attempting to run on device: ${device}`);
        }
        device = device.toLowerCase();

        if (device === "cpu") {
            if (enableLogging) {
                logger.info("Device set to CPU");
            }

            if (allCores) {
                if (enableLogging) {
                    logger.info("Using all CPU cores");
                }
                return executeWithAllCpuCores(func, ...args);
            }

            if (deviceId !== null) {
                if (enableLogging) {
                    logger.info(`Using specific CPU core: ${deviceId}`);
                }
                return executeOnCpu(deviceId, func, ...args);
            }

        } else if (device === "gpu") {
            if (enableLogging) {
                logger.info("Device set to GPU");
            }

            if (allGpus) {
                if (enableLogging) {
                    logger.info("Using all available GPUs");
                }
                const gpus = listAvailableGpus().map(gpu => parseInt(gpu, 10));
                return executeOnMultipleGpus(gpus, func, ...args);
            }

            if (enableLogging) {
                logger.info(`Using GPU device ID: ${deviceId}`);
            }
            return executeOnGpu(deviceId, func, ...args);

        } else {
            throw new Error(`Invalid device specified: ${device}. Supported devices are 'cpu' and 'gpu'.`);
        }

    } catch (e) {
        if (enableLogging) {
            logger.error(`An error occurred during execution: ${e.message}`);
        }
        throw e;
    }
}

export { execCallableWithClusterops };