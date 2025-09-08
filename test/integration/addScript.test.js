// The command module will be required dynamically inside the tests.
const path = require('path');

describe('addScript.js - Integration Test', () => {

    let addScript;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should create a new script file with boilerplate at the correct path', async () => {
        const appName = 'my-blog';
        const scriptPath = 'api/posts/create';

        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            existsSync: jest.fn(p => p.includes(appName) && !p.includes('create.js')), // App exists, but script doesn't
            ensureDirSync: jest.fn(),
            writeFileSync: jest.fn(),
        }));
        const fs = require('fs-extra');

        jest.mock('../../commands/utils', () => ({
            getProjectRoot: jest.fn().mockReturnValue('/fake/project'),
            getWebRoot: jest.fn().mockReturnValue('/fake/project/web'),
        }));

        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        addScript = require('../../commands/addScript').addScript;
        await addScript(appName, scriptPath);

        // --- ASSERTIONS ---
        const finalPath = path.join('/fake/project/web', appName, 'box', scriptPath + '.js');

        // Verify the parent directory was created
        expect(fs.ensureDirSync).toHaveBeenCalledWith(path.dirname(finalPath));

        // Verify the file was written with the correct path and content
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[0]).toBe(finalPath);
        expect(writeCall[1]).toContain(`Hello from ${scriptPath}`); // Check for boilerplate content
    });
    
    it('should fail if the target application does not exist', async () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit: ${code}`);
        });

        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(false) // Simulate app does NOT exist
        }));
        
        jest.mock('../../commands/utils', () => ({
            getProjectRoot: jest.fn().mockReturnValue('/fake/project'),
            getWebRoot: jest.fn().mockReturnValue('/fake/project/web'),
        }));
        
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        addScript = require('../../commands/addScript').addScript;

        // --- ASSERTIONS ---
        await expect(addScript('non-existent-app', 'api/test')).rejects.toThrow('process.exit: 1');
        expect(process.exit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
    });
});
