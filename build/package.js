const fs = require('fs-extra');
const path = require('path');

async function buildCliPackage() {
    try {
        console.log('Starting GingerJS CLI package build...');

        const GINGERJS_VERSION = "^1.0.0";

        // 1. Define Paths
        const projectRoot = path.resolve(__dirname, '..');
        const packageDest = path.join(projectRoot, 'build', 'dist', 'gingerjs-cli');

        // 2. Clean Destination
        console.log(`Cleaning destination: ${packageDest}`);
        fs.emptyDirSync(packageDest);

        // 3. Copy Essential Source Files and Directories
        console.log('Copying CLI source files...');
        
        const filesToCopy = [
            'index.js',
            'LICENSE',
            'README.md'
        ];
        
        const dirsToCopy = [
            'commands',
            'templates'
        ];

        filesToCopy.forEach(file => {
            fs.copySync(path.join(projectRoot, file), path.join(packageDest, file));
        });

        dirsToCopy.forEach(dir => {
            fs.copySync(path.join(projectRoot, dir), path.join(packageDest, dir));
        });

        // 4. Generate Production package.json
        console.log('Generating production package.json...');
        const sourcePackageJson = fs.readJsonSync(path.join(projectRoot, 'package.json'));

        const distPackageJson = {
            name: sourcePackageJson.name,
            version: sourcePackageJson.version,
            description: sourcePackageJson.description,
            main: sourcePackageJson.main,
            bin: sourcePackageJson.bin,
            repository: sourcePackageJson.repository,
            bugs: sourcePackageJson.bugs,
            homepage: sourcePackageJson.homepage,
            keywords: sourcePackageJson.keywords,
            author: sourcePackageJson.author,
            license: sourcePackageJson.license,
            engines: sourcePackageJson.engines,
            dependencies: sourcePackageJson.dependencies,
            optionalDependencies: sourcePackageJson.optionalDependencies
        };

        console.log(`Setting GingerJS version to "${GINGERJS_VERSION}"`);
        distPackageJson.dependencies["gingerjs-core"] = GINGERJS_VERSION;

        // 5. Write the final package.json
        fs.writeJsonSync(
            path.join(packageDest, 'package.json'),
            distPackageJson,
            { spaces: 2 }
        );

        console.log('\n\x1b[32m%s\x1b[0m', `✅ GingerJS CLI package created successfully!`);
        console.log(`   Output location: ${packageDest}`);
        console.log(`\nTo publish, run the following commands:\n`);
        console.log(`  cd ${path.relative(process.cwd(), packageDest)}`);
        console.log(`  npm publish`);

    } catch (err) {
        console.error('\x1b[31m%s\x1b[0m', 'Build failed:');
        console.error(err);
        process.exit(1);
    }
}

buildCliPackage();
