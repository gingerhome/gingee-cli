const os = require('os');
const path = require('path');

// Dynamically and safely require the correct service library based on the OS.
let Service;
const platform = os.platform();
let platformName = '';

try {
    if (platform === 'win32') {
        Service = require('node-windows').Service;
        platformName = 'Windows';
    } else if (platform === 'linux') {
        Service = require('node-linux').Service;
        platformName = 'Linux (systemd)';
    } else if (platform === 'darwin') {
        Service = require('node-mac').Service;
        platformName = 'macOS (launchd)';
    }
} catch (e) {
    // This will catch the error if the optional dependency was not installed.
    Service = null;
}


/**
 * Creates a configured Service instance.
 * @returns {Service|null}
 */
function getService() {
    if (!Service) {
        return null;
    }
    const { getProjectRoot } = require('./utils');
    const projectRoot = getProjectRoot();
    const scriptPath = path.join(projectRoot, 'start.js');

    return new Service({
        name: 'Gingee Server',
        description: `Gingee server instance running at ${projectRoot}`,
        script: scriptPath
    });
}

async function install() {
    const { default: chalk } = await import('chalk');
    const svc = getService();

    if (!svc) {
        console.error(chalk.bgRed('Error:'), chalk.blueBright('Service installation is not supported on this operating system.'));
        console.log(chalk.yellow('For other systems, we recommend using a process manager like PM2.'));
        return;
    }

    svc.on('install', () => {
        console.log(chalk.bgGreen('✅ Success!'), chalk.blueBright(`Service installed for ${platformName}.`));
        console.log('Starting the service...');
        svc.start();
        console.log(chalk.blueBright('Service started. Your Gingee server is now running in the background.'));
    });

    svc.on('alreadyinstalled', () => {
        console.log(chalk.yellow('This service is already installed.'));
    });

    svc.on('invalidinstallation', () => {
        console.error(chalk.bgRed('Error: Invalid service installation. Do you have the necessary permissions?'));
        console.log(chalk.yellow('On Linux/macOS, you may need to run this command with `sudo`.'));
        console.log(chalk.yellow('On Windows, you may need to run from an Administrator terminal.'));
    });

    console.log(chalk.blue(`Attempting to install the Gingee service for ${platformName}...`));
    svc.install();
}

// --- We can now implement the other service commands ---

async function uninstall() {
    const { default: chalk } = await import('chalk');
    const svc = getService();
    if (!svc) {
        console.error(chalk.bgRed('Error:'), chalk.blueBright('Service installation is not supported on this operating system.'));
        console.log(chalk.yellow('For other systems, we recommend using a process manager like PM2.'));
        return;
    }

    svc.on('uninstall', () => {
        console.log(chalk.bgGreen('✅ Success!'), chalk.blueBright('Service uninstalled.'));
    });
    
    console.log(chalk.blue('Attempting to uninstall the service...'));
    svc.uninstall();
}

async function start() {
    const { default: chalk } = await import('chalk');
    const svc = getService();
    if (!svc) {
        console.error(chalk.bgRed('Error:'), chalk.blueBright('Service installation is not supported on this operating system.'));
        console.log(chalk.yellow('For other systems, we recommend using a process manager like PM2.'));
        return;
    }

    svc.on('start', () => console.log(chalk.bgGreen('Service started.')));
    console.log(chalk.blue('Attempting to start the service...'));
    svc.start();
}

async function stop() {
    const { default: chalk } = await import('chalk');
    const svc = getService();
    if (!svc) { 
        console.error(chalk.bgRed('Error:'), chalk.blueBright('Service installation is not supported on this operating system.'));
        console.log(chalk.yellow('For other systems, we recommend using a process manager like PM2.'));
        return;
    }
    
    svc.on('stop', () => console.log(chalk.yellow('Service stopped.')));
    console.log(chalk.blue('Attempting to stop the service...'));
    svc.stop();
}

module.exports = { install, uninstall, start, stop };
