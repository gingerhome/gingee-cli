const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const argon2 = require('argon2');
const { _unzipBuffer } = require('./installerUtils');


async function init(projectName) {
  const { default: ora } = await import('ora');
  const { default: chalk } = await import('chalk');
  const { default: inquirer } = await import('inquirer');

  const spinner = ora();
  try {
    console.log(chalk.blueBright('🚀 Welcome to GingerJS! Let\'s create your new project.'));
    const projectPath = path.resolve(process.cwd(), projectName);

    let currentPath = process.cwd();
    while (currentPath !== path.parse(currentPath).root) {
      if (fs.existsSync(path.join(currentPath, 'ginger.json'))) {
        throw new Error(`Command cannot be run inside an existing GingerJS project.\nDetected project root at: ${currentPath}`);
      }
      currentPath = path.dirname(currentPath);
    }

    if (fs.existsSync(projectPath)) {
      throw new Error(`Directory '${projectName}' already exists. Please choose another name.`);
    }

    const answers = await inquirer.prompt([
      { type: 'input', name: 'adminUser', message: 'Enter a username for the Glade admin panel:', default: 'admin' },
      {
        type: 'password', name: 'adminPass', message: 'Enter a password for the Glade admin:', mask: '*', validate: input => {
          if (!input || input.length < 8) {
            return 'Password must be at least 8 characters long.';
          }
          return true;
        }
      },
      {
        type: 'password',
        name: 'confirmPassword',
        message: 'Confirm the new password:',
        mask: '*'
      },
      { type: 'confirm', name: 'installDeps', message: 'Install npm dependencies automatically?', default: true },
    ]);

    if (answers.adminPass !== answers.confirmPassword) {
      throw new Error("Passwords do not match. Please try again.");
    }

    if (!answers.adminPass) {
      throw new Error("Admin password cannot be empty.");
    }

    spinner.start('Scaffolding project files...');
    fs.mkdirSync(projectPath);
    const templatePath = path.join(__dirname, '..', 'templates', 'project');
    fs.copySync(templatePath, projectPath);

    const pkgJsonPath = path.join(projectPath, 'package.json');
    const pkgJson = fs.readJsonSync(pkgJsonPath);
    pkgJson.name = projectName.toLowerCase().replace(/\s+/g, '-');
    fs.writeJsonSync(pkgJsonPath, pkgJson, { spaces: 2 });
    fs.mkdirSync(path.join(projectPath, 'settings', 'ssl'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'backups'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'logs'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'temp'), { recursive: true });

    spinner.succeed('Project files scaffolded.');
    spinner.start('Installing `glade` admin panel...');

    // Find the glade.gin file using require.resolve, which is robust.
    // It looks for the 'gingerjs' package in the CLI's own node_modules.
    const gladeGinPath = require.resolve('gingerjs/templates/glade.gin');
    const gladePackageBuffer = fs.readFileSync(gladeGinPath);
    const gladeDestPath = path.join(projectPath, 'web', 'glade');

    await _unzipBuffer(gladePackageBuffer, gladeDestPath);
    spinner.succeed('`glade` admin panel installed.');
    spinner.start('Configuring admin credentials...');

    // Use the CLI's own argon2 dependency to hash the password.
    const passwordHash = await argon2.hash(answers.adminPass);
    const gladeAppConfigPath = path.join(gladeDestPath, 'box', 'app.json');
    const gladeAppConfig = fs.readJsonSync(gladeAppConfigPath);
    gladeAppConfig.env.ADMIN_USERNAME = answers.adminUser;
    gladeAppConfig.env.ADMIN_PASSWORD_HASH = passwordHash;
    fs.writeJsonSync(gladeAppConfigPath, gladeAppConfig, { spaces: 2 });
    spinner.succeed('Admin credentials configured securely.');

    spinner.start('Granting default permissions to Glade...');
    const permissionsFilePath = path.join(projectPath, 'settings', 'permissions.json');
    const permissionsConfig = {
      "glade": {
        "granted": ["platform", "fs"]
      }
    };
    fs.writeJsonSync(permissionsFilePath, permissionsConfig, { spaces: 2 });
    spinner.succeed('Default permissions for Glade configured.');

    if (answers.installDeps) {
      spinner.start('Installing dependencies with npm (this may take a moment)...');
      // Run `npm install` in the new project's directory
      execSync('npm install', { cwd: projectPath, stdio: 'ignore' });
      spinner.succeed('Dependencies installed.');
    }

    console.log(chalk.bgGreen(`\n✅ Success!`), chalk.blueBright(`Your GingerJS project "${projectName}" is ready.`));
    console.log(`\nTo get started, run the following commands:\n`);
    console.log(chalk.blueBright(`  cd ${projectName}`));
    //console.log(chalk.blueBright(`  git init && git add . && git commit -m "Initial commit"`));
    console.log(chalk.blueBright(`  npm run start`));

    console.log(`\n\nFor production, you have two options:`);
    console.log(chalk.cyan(`  1. Native Service: sudo gingerjs-cli service install`));
    console.log(chalk.cyan(`  2. PM2:           pm2 start`));
    console.log(`     (Customize your PM2 deployment in ecosystem.config.js)`);

  } catch (err) {
    spinner.fail(chalk.bgRed('ERROR!: '));
    if (err.errors) { //for AggregateError
      const messages = err.errors.map(e => e.message).join('\n');
      console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
    } else {
      console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${err.message}`));
    }
    process.exit(1);
  }
}

module.exports = { init };
