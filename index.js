#!/usr/bin/env node

const { Command } = require('commander');
const { init } = require('./commands/init');
const { addApp } = require('./commands/addApp');
const { addScript } = require('./commands/addScript');

const { resetPwd } = require('./commands/resetPwd');
const { resetGlade } = require('./commands/resetGlade');

const serviceCommands = require('./commands/service');

const { login } = require('./commands/login');
const { logout } = require('./commands/logout');
const { listApps } = require('./commands/listApps');
const { installApp } = require('./commands/installApp');
const { upgradeApp } = require('./commands/upgradeApp');
const { deleteApp } = require('./commands/deleteApp');
const { rollbackApp } = require('./commands/rollbackApp');
const { packageApp } = require('./commands/packageApp');
const { listBackups } = require('./commands/listBackups');

const { listStoreApps } = require('./commands/listStoreApps');
const { installStoreApp } = require('./commands/installStoreApp');
const { upgradeStoreApp } = require('./commands/upgradeStoreApp');

const packageJson = require('./package.json'); // For version number
const program = new Command();

program
    .name('gingerjs-cli')
    .description('The official command-line interface for the GingerJS platform.')
    .version(packageJson.version);

// Local scaffolding commands
program
    .command('init <project-name>')
    .description('Scaffold a new GingerJS project in a new directory.')
    .action(init);

program
    .command('add-app <app-name>')
    .description('Scaffold a new, interactive app inside the current project.')
    .action(addApp);

program
    .command('add-script <app-name> <script-path>')
    .description("Create a new server script with boilerplate. Path format: '<app-name>/box/<script-path>'")
    .action(addScript);


// Utility and recovery commands
program
    .command('reset-pwd')
    .description("Reset the GingerJS - Glade admin password by directly updating its config file.")
    .action(resetPwd);

program
    .command('reset-glade')
    .description("Reset the GingerJS - Glade admin app to a clean, default installation.")
    .action(resetGlade);

// Service management commands

const serviceCmd = program.command('service')
    .description('Manage the GingerJS server as a native background service (requires admin/sudo).');

serviceCmd.command('install').description('Install and start GingerJS as a background service.').action(serviceCommands.install);
serviceCmd.command('uninstall').description('Stop and remove the GingerJS background service.').action(serviceCommands.uninstall);
serviceCmd.command('start').description('Start the GingerJS background service.').action(serviceCommands.start);
serviceCmd.command('stop').description('Stop the GingerJS background service.').action(serviceCommands.stop);


// Server Administration Commands
program.command('login').description('Authenticate with a GingerJS Glade instance. Defaults to http://localhost:7070')
    .requiredOption('-s, --serverUrl <server-url>', 'GingerJS server URL', 'http://localhost:7070')
    .requiredOption('-u, --username <username>', 'Username for authentication', 'admin')
    .option('-p, --password <password>', 'Password for authentication')
    .action(login);

program.command('logout').description('Log out of the current GingerJS Glade session. Defaults to http://localhost:7070')
    .requiredOption('-s, --serverUrl <server-url>', 'GingerJS server URL', 'http://localhost:7070')
    .action(logout);

program.command('list-apps').description('List all applications on the running GingerJS server. Defaults to http://localhost:7070')
    .requiredOption('-s, --serverUrl <server-url>', 'GingerJS server URL', 'http://localhost:7070')
    .action(listApps);

program.command('install-app')
    .description('Interactively install a new application from a local .gin package.')
    .requiredOption('-s, --serverUrl <server-url>', 'GingerJS server URL', 'http://localhost:7070')
    .requiredOption('-a, --appName <app-name>', 'The name for the application to be installed.')
    .requiredOption('-p, --ginPath <path-to-gin-file>', 'The path to the local app package (.gin) file.')
    .option('-f, --file <path-to-preset-file>', 'Use a preset file for non-interactive installation.')
    .action(installApp);

program.command('upgrade-app')
    .description('Upgrade an existing application from a .gin package.')
    .requiredOption('-s, --serverUrl <server-url>', 'GingerJS server URL', 'http://localhost:7070')
    .requiredOption('-a, --appName <app-name>', 'The name of the application to upgrade.')
    .requiredOption('-p, --ginPath <path-to-gin-file>', 'The path to the app package (.gin) file.')
    .option('-f, --file <path-to-preset-file>', 'Use a preset file for non-interactive upgrade.')
    .action(upgradeApp);

program.command('delete-app')
    .description('Permanently delete an application from the server.')
    .requiredOption('-s, --serverUrl <server-url>', 'GingerJS server URL', 'http://localhost:7070')
    .requiredOption('-a, --appName <app-name>', 'The name of the application to delete.')
    .option('-f, --file <path-to-preset-file>', 'Use a preset file for non-interactive delete.')
    .action(deleteApp);

program.command('rollback-app')
    .description('Roll back an application to its most recent backup.')
    .requiredOption('-s, --serverUrl <server-url>', 'GingerJS server URL', 'http://localhost:7070')
    .requiredOption('-a, --appName <app-name>', 'The name of the application to roll back.')
    .option('-f, --file <path-to-preset-file>', 'Use a preset file for non-interactive rollback.')
    .action(rollbackApp);

program.command('package-app')
    .description('Package a live application into a downloadable .gin file.')
    .requiredOption('-s, --serverUrl <server-url>', 'The base URL of the target GingerJS server', 'http://localhost:7070')
    .requiredOption('-a, --appName <app-name>', 'The name of the application to package.')
    .option('-d, --dest <path>', 'The destination folder for the .gin app package file.')
    .action(packageApp);

program.command('list-app-backups')
    .description('List all available backups for an application.')
    .requiredOption('-s, --serverUrl <server-url>', 'The base URL of the target GingerJS server', 'http://localhost:7070')
    .requiredOption('-a, --appName <app-name>', 'The name of the application to list backups for.')
    .action(listBackups);


// --- App Store Commands ---
program.command('list-store-apps')
    .description('List available applications from a store manifest URL.')
    .requiredOption('-g, --gStoreUrl <gstore-url>', 'GingerJS app store URL')
    .action(listStoreApps);

program.command('install-store-app <app-name>')
    .description('Interactively install an application from a store onto a target GingerJS server.')
    .requiredOption('-g, --gStoreUrl <gstore-url>', 'GingerJS app store URL')
    .requiredOption('-s, --serverUrl <server-url>', 'GingerJS server URL', 'http://localhost:7070')
    .action(installStoreApp);

program.command('upgrade-store-app <app-name>')
    .description('Interactively upgrade an application from a store onto a target GingerJS server.')
    .requiredOption('-g, --gStoreUrl <gstore-url>', 'GingerJS app store URL')
    .requiredOption('-s, --serverUrl <server-url>', 'GingerJS server URL', 'http://localhost:7070')
    .action(upgradeStoreApp);


//TODO: We will add more commands here later.

program.parse(process.argv);
