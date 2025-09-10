const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { error } = require('console');

function getProjectRoot() {
    const projectRoot = process.cwd();
    if (!fs.existsSync(path.join(projectRoot, 'gingee.json'))) {
        throw new Error('This command must be run from the root of a Gingee project.');
    }
    return projectRoot;
}

/**
 * Reads the gingee.json file and resolves the correct, absolute web_root path.
 * Correctly handles both relative and absolute paths from the config.
 * @param {string} projectRoot - The absolute path to the project root.
 * @returns {string} The absolute path to the web root directory.
 */
function getWebRoot(projectRoot) {
    const configPath = path.join(projectRoot, 'gingee.json');
    const config = fs.readJsonSync(configPath);
    const configWebPath = config.web_root || './web';

    // --- THIS IS THE EXPLICIT AND CORRECT LOGIC ---
    if (path.isAbsolute(configWebPath)) {
        // If the path is already absolute, use it directly.
        return configWebPath;
    } else {
        // If it's relative, resolve it from the project's root.
        return path.resolve(projectRoot, configWebPath);
    }
}

module.exports = { getProjectRoot, getWebRoot };
