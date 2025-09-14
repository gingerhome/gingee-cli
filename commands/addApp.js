const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto'); // Use Node's built-in crypto for the JWT
const { getProjectRoot, getWebRoot } = require('./utils');

async function addApp(appName) {
    const { default: chalk } = await import('chalk');
    const { default: inquirer } = await import('inquirer');

    try {
        const projectRoot = getProjectRoot();
        const webRoot = getWebRoot(projectRoot);
        const appPath = path.join(webRoot, appName);

        if (fs.existsSync(appPath)) {
            throw new Error(`An application named '${appName}' already exists at ${appPath}`);
        }

        console.log(`Creating a new Gingee app named '${appName}'...`);

        // --- Run the interactive wizard ---
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'type',
                message: 'What type of app is this?',
                choices: [
                    { name: 'MPA (Multi-Page App, Traditional Web App)', value: 'MPA' },
                    { name: 'SPA (Single Page App, React/Vue/etc.)', value: 'SPA' }
                ],
                default: 'MPA',
            },
            {
                type: 'confirm',
                name: 'configureDb',
                message: 'Would you like to configure a database connection now?',
                default: false,
            },
            {
                type: 'list',
                name: 'dbType',
                message: 'Select Database Type:',
                choices: ['postgres', 'mysql', 'sqlite', 'mssql', 'oracle'],
                when: (ans) => ans.configureDb,
            },
            {
                type: 'input', name: 'dbName', message: 'Connection Name (e.g., main_db):', default: 'main_db',
                when: (ans) => ans.configureDb,
            },
            {
                type: 'input', name: 'dbHost', message: 'Database Host:', default: 'localhost',
                when: (ans) => ans.configureDb && ans.dbType !== 'sqlite',
            },
            {
                type: 'input', name: 'dbUser', message: 'Database User:',
                when: (ans) => ans.configureDb && ans.dbType !== 'sqlite',
            },
            {
                type: 'password', name: 'dbPass', message: 'Database Password:', mask: '*',
                when: (ans) => ans.configureDb && ans.dbType !== 'sqlite',
            },
            {
                type: 'input', name: 'dbDatabase', message: 'Database Name:',
                when: (ans) => ans.configureDb && ans.dbType !== 'sqlite',
            },
            {
                type: 'input', name: 'dbFile', message: 'Database File Path (relative to box folder):', default: 'data/app.db',
                when: (ans) => ans.dbType === 'sqlite',
            },
            {
                type: 'confirm',
                name: 'configureJwt',
                message: 'Generate a JWT secret for this app?',
                default: false,
            },
        ]);

        if (answers.type === 'SPA') {
            // --- Scaffolding files and folders for SPA ---
            console.log('Scaffolding SPA app structure...');
            const boxPath = path.join(appPath, 'box');
            const apiPath = path.join(boxPath, 'api');
            fs.ensureDirSync(apiPath);

            // Create sample API endpoint
            const sampleApiContent = `module.exports = async function() {\n    await gingee(async ($g) => {\n        $g.response.send({ message: 'Hello from your Gingee SPA backend!' });\n    });\n};`;
            fs.writeFileSync(path.join(apiPath, 'hello.js'), sampleApiContent);

            // Create the pre-configured app.json from template
            const templatePath = path.join(__dirname, '..', 'templates', 'spa-generic', 'app.json');
            const appConfig = fs.readJsonSync(templatePath);
            appConfig.name = appName;

            if (answers.configureDb) {
                appConfig.db = [{
                    type: answers.dbType,
                    name: answers.dbName,
                    host: answers.dbHost,
                    user: answers.dbUser,
                    password: answers.dbPass,
                    database: answers.dbType === 'sqlite' ? answers.dbFile : answers.dbDatabase,
                }];
            }
            if (answers.configureJwt) {
                appConfig.jwt_secret = crypto.randomBytes(32).toString('hex');
            }
            fs.writeJsonSync(path.join(boxPath, 'app.json'), appConfig, { spaces: 2 });

        } else {

            // --- Scaffold the files and folders for MPA ---
            console.log('Scaffolding MPA app structure...');
            const boxPath = path.join(appPath, 'box');
            fs.ensureDirSync(boxPath);
            fs.ensureDirSync(path.join(appPath, 'css'));
            fs.ensureDirSync(path.join(appPath, 'images'));
            fs.ensureDirSync(path.join(appPath, 'scripts'));

            // --- Create app.json ---
            const appConfig = { name: appName, version: '1.0.0', type: answers.type };
            if (answers.configureDb) {
                appConfig.db = [{
                    type: answers.dbType,
                    name: answers.dbName,
                    host: answers.dbHost,
                    user: answers.dbUser,
                    password: answers.dbPass,
                    database: answers.dbType === 'sqlite' ? answers.dbFile : answers.dbDatabase,
                }];
            }
            if (answers.configureJwt) {
                appConfig.jwt_secret = crypto.randomBytes(32).toString('hex');
            }
            fs.writeJsonSync(path.join(boxPath, 'app.json'), appConfig, { spaces: 2 });

            // --- Create hello.js ---
            const helloScriptContent = `module.exports = async function() {\n   await gingee(async ($g) => {\n        $g.response.send({ message: 'Hello from the ${appName} server script!' });\n    });\n};`;
            fs.writeFileSync(path.join(boxPath, 'hello.js'), helloScriptContent);

            // --- Create index.html ---
            const indexHtmlContent = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${appName}</title>\n</head>\n<body>\n  <h1>${appName}</h1>\n  <button id="helloButton">Say Hello</button>\n  <div id="response" style="margin-top: 1rem; font-family: monospace;"></div>\n  <script src="/${appName}/scripts/cl_app.js"></script>\n</body>\n</html>`;
            fs.writeFileSync(path.join(appPath, 'index.html'), indexHtmlContent);

            // --- Create cl_app.js ---
            const clAppJsContent = `document.getElementById('helloButton').addEventListener('click', async () => {\n    const responseElement = document.getElementById('response');\n    responseElement.innerText = 'Loading...';\n    try {\n        const res = await fetch('/${appName}/hello');\n        const data = await res.json();\n        responseElement.innerText = \`Server says: \${data.message}\`;\n    } catch (err) {\n        responseElement.innerText = 'Error: Could not connect to server.';\n    }\n});`;
            fs.writeFileSync(path.join(appPath, 'scripts', 'cl_app.js'), clAppJsContent);
        }

        console.log(chalk.bgGreen(`\n✅ Success!`), chalk.blueBright(`App '${appName}' created.`));
        if (answers.type === 'SPA') {
            console.log(chalk.blueBright(`\nYour Gingee app is ready. Now, set up your frontend framework:`));
            console.log(chalk.blueBright(`\n1. Navigate into your new app's folder:`));
            console.log(chalk.white(`   cd web/${appName}`));
            console.log(chalk.blueBright(`\n2. Use your favorite tool to initialize your project HERE.`));
            console.log(chalk.dim(`   (For example, to use Vite + React, run:)`));
            console.log(chalk.white(`   npm create vite@latest`));

            console.log(chalk.blueBright(`\n3. IMPORTANT After initializing, you MUST configure your frontend tool`));
            console.log(chalk.blueBright(`to use a base path. For Vite, edit 'vite.config.js' and add:`));
            console.log(chalk.white(`   base: '/${appName}/'`));

            console.log(chalk.blueBright(`\n4. Install the frontend dependencies:`));
            console.log(chalk.white(`   npm install`));
            console.log(chalk.blueBright(`\n5. Review 'box/app.json' to ensure the proxy and build paths match your tool.`));
            console.log(chalk.blueBright(`\n6. Return to the project root and start the server:`));
            console.log(chalk.white(`   cd ../..`));
            console.log(chalk.white(`   npm start`));
            console.log('\n\n');
        } else {
            console.log(`   Navigate to /${appName} in your browser to see it in action.`);
        }

    } catch (err) {
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else {
            console.error(chalk.bgRed(`\nError: `), chalk.blueBright(`${err.message}`));
        }
        process.exit(1);
    }
}

module.exports = { addApp };
