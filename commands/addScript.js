const fs = require('fs-extra');
const path = require('path');
const { getProjectRoot, getWebRoot } = require('./utils');

// The function signature now accepts two distinct arguments.
async function addScript(appName, scriptPath) {
    const { default: chalk } = await import('chalk');
    
    try {
        const projectRoot = getProjectRoot();
        const webRoot = getWebRoot(projectRoot);

        const appPath = path.join(webRoot, appName);
        if (!fs.existsSync(appPath)) {
            throw new Error(`Application '${appName}' does not exist at: ${appPath}`);
        }

        const finalPath = path.join(appPath, 'box', scriptPath + '.js');

        if (fs.existsSync(finalPath)) {
            throw new Error(`Script already exists at: ${path.relative(projectRoot, finalPath)}`);
        }

        fs.ensureDirSync(path.dirname(finalPath));

        const boilerplate = `module.exports = async function() {\n    await ginger(async ($g) => {\n        // Your script logic goes here\n        $g.response.send('Hello from ${scriptPath}');\n    });\n};`;

        fs.writeFileSync(finalPath, boilerplate);

        console.log(chalk.bgGreen(`✅ Success!`), chalk.blueBright(`Script created at:`));
        console.log(chalk.blueBright(`   ${path.relative(projectRoot, finalPath)}`));
        console.log(`\n   You can access it at the URL: /${appName}/${scriptPath}`);

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

module.exports = { addScript };
