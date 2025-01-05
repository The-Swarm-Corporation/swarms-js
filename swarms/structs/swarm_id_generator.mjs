import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique swarm ID
 * @returns {string} A unique swarm ID
 */
export function generateSwarmId() {
    return uuidv4();
}

// Example usage (commented out):
/*
// Example usage:
const swarmId = generateSwarmId();
console.log(swarmId);
*/