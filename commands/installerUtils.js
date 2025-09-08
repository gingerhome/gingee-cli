const fs = require('fs-extra');
const path = require('path');
const yauzl = require('yauzl');
const archiver = require('archiver');
const { URL } = require('url'); // Using Node's built-in URL parser

const PERMISSION_DESCRIPTIONS = {
    "cache": "Allows the app to use the caching service for storing and retrieving data.",
    "db": "Allows the app to connect to and query the database(s) you configure for it.",
    "fs": "Grants full read/write access within the app's own secure directories (`box` and `web`).",
    "httpclient": "Permits the app to make outbound network requests to any external API or website.",
    "platform": "PRIVILEGED: Allows managing the lifecycle of other applications on the server. Grant with extreme caution.",
    "pdf": "Allows the app to generate and manipulate PDF documents.",
    "zip": "Allows the app to create and extract ZIP archives.",
    "image": "Allows the app to manipulate image files."
};

/**
 * Reads the application preset file from the specified path.
 * @param {string} filePath - The path to the preset file.
 * @returns {object} The contents of the preset file.
 * @throws {Error} If the preset file is not found or cannot be read.
 */
function _readAppPreset(filePath) {
    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Preset file not found at: ${absolutePath}`);
    }
    return fs.readJsonSync(absolutePath);
}

/**
 * Validates the application preset file.
 * @param {object} preset - The contents of the preset file.
 * @param {string} action - The action being performed (e.g., "install", "upgrade").
 * @throws {Error} If the preset file is invalid.
 */
function _validateAppPreset(preset, action) {
    if (!preset[action]) {
        throw new Error(`Preset file is missing the required top-level key for the "${action}" action.`);
    }

    switch (action) {
        case 'install':
        case 'upgrade':
            if (!preset[action].consent || !Array.isArray(preset[action].consent.grantPermissions)) {
                throw new Error(`Preset for "${action}" is missing the required "consent.grantPermissions" array.`);
            }
            break;
        case 'rollback':
            if (!preset[action].consent || !Array.isArray(preset[action].consent.grantPermissions)) {
                throw new Error(`Preset for "rollback" is missing the required "consent.grantPermissions" array.`);
            }
            break;
        case 'delete':
            if (preset[action].confirm !== true) {
                throw new Error(`Preset for "delete" requires the "confirm" key to be explicitly set to true.`);
            }
            break;
    }
}

/**
 * Substitutes environment variables in the database configuration.
 * @param {Array} dbConfigs - The database configuration objects.
 * @returns {Array} The updated database configuration objects with environment variables substituted.
 */
function _substituteEnvVars(dbConfigs) {
    if (!dbConfigs) return [];
    // Deep clone to avoid modifying the original object
    const configs = JSON.parse(JSON.stringify(dbConfigs));
    for (const config of configs) {
        for (const key in config) {
            const value = config[key];
            if (typeof value === 'string' && value.startsWith('$')) {
                const envVarName = value.substring(1);
                const envVarValue = process.env[envVarName];
                if (envVarValue === undefined) {
                    throw new Error(`Environment variable "${envVarName}" specified in the preset file is not set.`);
                }
                config[key] = envVarValue;
            }
        }
    }
    return configs;
}

/**
 * Resolves the user-provided URL to the final manifest URL.
 * @param {string} inputUrl The URL provided by the user.
 * @returns {string} The final, correct URL for the gstore.json file.
 * @throws {Error} If the URL is invalid or points to an incorrect filename.
 * @private
 */
function _resolveStoreUrl(inputUrl) {
    const parsedUrl = new URL(inputUrl);
    const pathname = parsedUrl.pathname;
    const pathSegments = pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];

    if (lastSegment.includes('.')) {
        if (lastSegment !== 'gstore.json') {
            throw new Error(`Invalid manifest filename. If a filename is specified, it must be 'gstore.json'.`);
        }
        return inputUrl;
    } else {
        parsedUrl.pathname = path.join(pathname, 'gstore.json');
        return parsedUrl.toString();
    }
}

/**
 * Resolves the .gin package download URL, handling both absolute and relative paths.
 * @param {string} storeUrl The absolute URL of the gstore.json manifest.
 * @param {string} downloadUrl The download_url value from the manifest.
 * @returns {string} The final, absolute URL for the .gin package.
 * @private
 */
function _resolveDownloadUrl(storeUrl, downloadUrl) {
    // Check if downloadUrl is already an absolute URL.
    if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')) {
        return downloadUrl;
    }
    // If it's relative, resolve it against the store's base URL.
    const storeBaseUrl = new URL('.', storeUrl).toString();
    return new URL(downloadUrl, storeBaseUrl).toString();
}

function _getHttpClientErrorMessage(err) {
    let message = '';
    if (err.response) {
        if(err.response.status === 401)
            message = 'Unauthorized: Please login using the login command';
        else
            message = `${err.response.status}: ${err.response.data.message || 'Server error.'}`;
    } else if (err.request) {
        message = 'Network Error: No response received. Check if server is running.';
    } else {
        message = `Error: ${err.message}`;
    }
    return message;
}

/**
 * Securely unzips a buffer to an absolute destination path.
 * This is a self-contained utility for the CLI.
 * @private
 */
async function _unzipBuffer(zipBuffer, destAbsolutePath) {
    fs.mkdirSync(destAbsolutePath, { recursive: true });
    const zipfile = await new Promise((resolve, reject) => {
        yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zf) => err ? reject(err) : resolve(zf));
    });

    await new Promise((resolve, reject) => {
        zipfile.on('error', reject);
        zipfile.on('end', resolve);
        zipfile.on('entry', (entry) => {
            const finalDestPath = path.join(destAbsolutePath, entry.fileName);
            const resolvedPath = path.resolve(finalDestPath);
            if (!resolvedPath.startsWith(destAbsolutePath)) {
                return reject(new Error(`Security Error: Zip file contains path traversal ('${entry.fileName}').`));
            }
            if (/\/$/.test(entry.fileName)) {
                fs.mkdirSync(resolvedPath, { recursive: true });
                zipfile.readEntry();
            } else {
                zipfile.openReadStream(entry, (err, readStream) => {
                    if (err) return reject(err);
                    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
                    const writeStream = fs.createWriteStream(resolvedPath);
                    readStream.pipe(writeStream).on('finish', () => zipfile.readEntry()).on('error', reject);
                });
            }
        });
        zipfile.readEntry();
    });
}

async function _repackApp(sourcePath) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const buffers = [];
    archive.on('data', buffer => buffers.push(buffer));
    const streamPromise = new Promise((resolve, reject) => {
        archive.on('end', () => resolve(Buffer.concat(buffers)));
        archive.on('error', reject);
    });
    archive.directory(sourcePath, false);
    await archive.finalize();
    return streamPromise;
}

async function _getPermissions(unpackedPath) {
    const { default: chalk } = await import('chalk');
    const { default: inquirer } = await import('inquirer');

    const pmftPath = path.join(unpackedPath, 'box', 'pmft.json');
    if (!fs.existsSync(pmftPath)) {
        throw new Error('Package is invalid: Missing permissions manifest (pmft.json).');
    }
    const pmft = await fs.readJson(pmftPath);
    const appJson = await fs.readJson(path.join(unpackedPath, 'box', 'app.json'));

    console.log(`\n--- Application Details ---`);
    console.log(chalk.blueBright(`  App:         ${appJson.name} (v${appJson.version})`));
    console.log(chalk.blueBright(`  Description: ${appJson.description}\n`));
    console.log(chalk.yellow('This application requests the following permissions:'));

    const mandatoryPerms = pmft.permissions.mandatory || [];
    const optionalPerms = pmft.permissions.optional || [];

    console.log(chalk.bgRedBright('\nMandatory Permissions:'));
    mandatoryPerms.forEach(p => console.log(`- ${chalk.bold(p)}: ${PERMISSION_DESCRIPTIONS[p]}`));

    const { consent } = await inquirer.prompt([{ type: 'confirm', name: 'consent', message: '\nDo you grant the mandatory permissions?', default: false }]);
    if (!consent) throw new Error('Installation cancelled by user.');

    console.log(chalk.bgYellow('\nOptional Permissions:'));
    optionalPerms.forEach(p => console.log(`- ${p}: ${PERMISSION_DESCRIPTIONS[p]}`));

    let grantedPermissions = [...mandatoryPerms];
    if (optionalPerms.length > 0) {
        const { chosenOptionals } = await inquirer.prompt([{ type: 'checkbox', name: 'chosenOptionals', message: '\nSelect any optional permissions to grant:', choices: optionalPerms }]);
        grantedPermissions.push(...chosenOptionals);
    }
    return grantedPermissions;
}

async function _getDbRequirements(unpackedPath) {
    const { default: chalk } = await import('chalk');
    const { default: inquirer } = await import('inquirer');

    // Step 1: Read the app.json from the unpacked package.
    const appJson = await fs.readJson(path.join(unpackedPath, 'box', 'app.json'));
    const dbConnections = appJson.db || [];
    if (dbConnections.length === 0) {
        return [];
    }

    console.log('\n--- Configuring Database Requirements ---');
    const newDbConfigs = [];

    // Step 2: Loop through each database connection defined in the app.json
    for (const dbReq of dbConnections) {
        console.log(chalk.cyan(`\nThis app's app.json requests a '${dbReq.type}' database connection named '${dbReq.name}'.`));
        console.log(chalk.cyan(`Please provide or confirm the following details:`));

        const questions = [];
        const keysToPrompt = Object.keys(dbReq);

        // Step 3: Dynamically generate prompts based on the keys in the app.json db object.
        for (const key of keysToPrompt) {
            // We don't prompt for these structural keys.
            if (key === 'type' || key === 'name') {
                continue;
            }

            const question = {
                name: key,
                message: `${key}:`,
                // Use the value from app.json as the default.
                default: dbReq[key]
            };

            // Special handling for the password key.
            if (key === 'password') {
                question.type = 'password';
                question.mask = '*';
                // CRITICAL: Never use a placeholder/default for a password prompt.
                delete question.default;
            }

            // Special handling for sqlite to provide a more descriptive message.
            if (key === 'database' && dbReq.type === 'sqlite') {
                question.message = 'Database File Path (relative to the app\'s `box` folder):';
            }

            questions.push(question);
        }

        if (questions.length > 0) {
            const answers = await inquirer.prompt(questions);
            // Merge the user's answers over the original config from app.json
            newDbConfigs.push({ ...dbReq, ...answers });
        } else {
            // If there were no keys to prompt for, pass the original config through.
            newDbConfigs.push(dbReq);
        }
    }
    return newDbConfigs;
}

async function _getUpgradePermissions(unpackedPath, currentPermissions) {
    const { default: chalk } = await import('chalk');
    const { default: inquirer } = await import('inquirer');

    const pmftPath = path.join(unpackedPath, 'box', 'pmft.json');
    if (!fs.existsSync(pmftPath)) {
        throw new Error('New package is invalid: Missing permissions manifest (pmft.json).');
    }
    const pmft = await fs.readJson(pmftPath);
    const appJson = await fs.readJson(path.join(unpackedPath, 'box', 'app.json'));

    console.log(`\n--- Upgrading Application ---`);
    console.log(chalk.blueBright(`  App:     ${appJson.name} (v${appJson.version})`));
    console.log(chalk.yellow('\nReview the following permission changes:'));

    const newMandatorySet = new Set(pmft.permissions.mandatory || []);
    const newOptionalSet = new Set(pmft.permissions.optional || []);
    const currentGrantedSet = new Set(currentPermissions);
    const allNewRequestedSet = new Set([...newMandatorySet, ...newOptionalSet]);

    const newlyRequestedMandatory = [...newMandatorySet].filter(p => !currentGrantedSet.has(p));
    const newlyRequestedOptional = [...newOptionalSet].filter(p => !currentGrantedSet.has(p));
    const permissionsToRevoke = [...currentGrantedSet].filter(p => !allNewRequestedSet.has(p));
    const unchangedPermissions = [...currentGrantedSet].filter(p => allNewRequestedSet.has(p));

    const noChanges = newlyRequestedMandatory.length === 0 && newlyRequestedOptional.length === 0 && permissionsToRevoke.length === 0;

    if (noChanges) {
        console.log(chalk.blueBright('- No permission changes are required for this upgrade.'));
        return currentPermissions; // Return the existing permissions as is.
    }

    newlyRequestedMandatory.forEach(p => console.log(chalk.blueBright(`+ GRANT (Mandatory): ${p} - ${PERMISSION_DESCRIPTIONS[p]}`)));
    newlyRequestedOptional.forEach(p => console.log(chalk.blueBright(`+ GRANT (Optional): ${p} - ${PERMISSION_DESCRIPTIONS[p]}`)));
    permissionsToRevoke.forEach(p => console.log(chalk.blueBright(`- REVOKE (No longer requested): ${p}`)));

    if (newlyRequestedMandatory.length > 0) {
        const { mandatoryConsent } = await inquirer.prompt([{
            type: 'confirm',
            name: 'mandatoryConsent',
            message: `This upgrade requires new MANDATORY permissions. Do you approve granting them?`,
            default: false
        }]);
        if (!mandatoryConsent) throw new Error('Mandatory permissions denied. Upgrade cancelled by user.');
    }

    let chosenOptionals = [];
    if (newlyRequestedOptional.length > 0) {
        const { chosen } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'chosen',
            message: 'Please select which new OPTIONAL permissions you wish to grant:',
            choices: newlyRequestedOptional
        }]);
        chosenOptionals = chosen;
    }

    const finalPermissions = new Set([
        ...unchangedPermissions,
        ...newlyRequestedMandatory,
        ...chosenOptionals
    ]);

    console.log(chalk.blueBright('\nPermissions confirmed.'));
    return Array.from(finalPermissions);
}

async function _getRollbackPermissions(backupPermissions, currentPermissions) {
    const { default: chalk } = await import('chalk');
    const { default: inquirer } = await import('inquirer');

    console.log(chalk.yellow('\nPlease review the following permission changes for the rollback:'));

    const backupMandatorySet = new Set(backupPermissions.mandatory || []);
    const backupOptionalSet = new Set(backupPermissions.optional || []);
    const currentGrantedSet = new Set(currentPermissions);
    const allBackupRequestedSet = new Set([...backupMandatorySet, ...backupOptionalSet]);

    const toRevoke = [...currentGrantedSet].filter(p => !allBackupRequestedSet.has(p));
    const toGrantMandatory = [...backupMandatorySet].filter(p => !currentGrantedSet.has(p));
    const toGrantOptional = [...backupOptionalSet].filter(p => !currentGrantedSet.has(p));

    const noChanges = toRevoke.length === 0 && toGrantMandatory.length === 0 && toGrantOptional.length === 0;

    if (noChanges) {
        console.log(chalk.bgBlueBright('- No permission changes are required for this rollback.'));
        return currentPermissions;
    }

    toGrantMandatory.forEach(p => console.log(chalk.blueBright(`+ GRANT (Mandatory): ${p} - ${PERMISSION_DESCRIPTIONS[p]}`)));
    toGrantOptional.forEach(p => console.log(chalk.blueBright(`+ GRANT (Optional): ${p} - ${PERMISSION_DESCRIPTIONS[p]}`)));
    toRevoke.forEach(p => console.log(chalk.blueBright(`- REVOKE (No longer requested): ${p}`)));

    if (toGrantMandatory.length > 0) {
        const { mandatoryConsent } = await inquirer.prompt([{
            type: 'confirm',
            name: 'mandatoryConsent',
            message: `This rollback requires granting new MANDATORY permissions. Do you approve?`,
            default: false
        }]);
        if (!mandatoryConsent) throw new Error('Mandatory permissions denied. Rollback cancelled by user.');
    }

    let chosenOptionals = [];
    if (toGrantOptional.length > 0) {
        const { chosen } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'chosen',
            message: 'Please select which new OPTIONAL permissions you wish to grant for the rolled-back version:',
            choices: toGrantOptional
        }]);
        chosenOptionals = chosen;
    }

    const finalPermissions = new Set([
        ...[...currentGrantedSet].filter(p => allBackupRequestedSet.has(p)),
        ...toGrantMandatory,
        ...chosenOptionals
    ]);

    console.log(chalk.blueBright('\nPermissions confirmed.'));
    return Array.from(finalPermissions);
}

module.exports = {
    _readAppPreset,
    _validateAppPreset,
    _substituteEnvVars,
    _unzipBuffer,
    _repackApp,
    _getPermissions,
    _getUpgradePermissions,
    _getRollbackPermissions,
    _getDbRequirements,
    _resolveStoreUrl,
    _resolveDownloadUrl,
    _getHttpClientErrorMessage
};
