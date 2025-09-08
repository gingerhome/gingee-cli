const path = require('path');

describe('installApp.js - Integration Test (Local Install)', () => {

    let installApp;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should perform a full interactive installation from a local .gin file', async () => {
        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(true),
            readFileSync: jest.fn().mockReturnValue(Buffer.from('fake-gin-buffer')),
            readJson: jest.fn().mockResolvedValue({ db: [] }), // Mock for app.json read
            writeJson: jest.fn().mockResolvedValue(true),
            remove: jest.fn().mockResolvedValue(true),
            ensureDir: jest.fn().mockResolvedValue(true)
        }));
        const fs = require('fs-extra');

        jest.mock('../../commands/apiClient', () => ({
            installApp: jest.fn().mockResolvedValue({ status: 'success' })
        }));
        const apiClient = require('../../commands/apiClient');

        // Mock the entire installerUtils module to control the interactive flow
        jest.mock('../../commands/installerUtils', () => ({
            _getHttpClientErrorMessage: jest.fn(err => err.message), // Simple mock for error messages
            _unzipBuffer: jest.fn().mockResolvedValue(true),
            _repackApp: jest.fn().mockResolvedValue(Buffer.from('repacked-gin-buffer')),
            _getPermissions: jest.fn().mockResolvedValue(['db', 'fs']),
            _getDbRequirements: jest.fn().mockResolvedValue([{ host: 'db.local' }])
        }));
        const installerUtils = require('../../commands/installerUtils');

        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        installApp = require('../../commands/installApp').installApp;
        const options = {
            serverUrl: 'http://test.server',
            appName: 'local-app',
            ginPath: '/path/to/local-app.gin'
        };
        await installApp(options);

        // --- ASSERTIONS ---
        
        // Verify the local .gin was read
        expect(fs.readFileSync).toHaveBeenCalledWith(options.ginPath);
        
        // Verify the interactive prompts were called
        expect(installerUtils._getPermissions).toHaveBeenCalledTimes(1);
        expect(installerUtils._getDbRequirements).toHaveBeenCalledTimes(1);

        // Verify the package was repacked
        expect(installerUtils._repackApp).toHaveBeenCalledTimes(1);
        
        // Verify the final API call was made with the correct, user-approved data
        expect(apiClient.installApp).toHaveBeenCalledTimes(1);
        expect(apiClient.installApp).toHaveBeenCalledWith(
            options.serverUrl,
            options.appName,
            path.basename(options.ginPath),
            Buffer.from('repacked-gin-buffer'),
            ['db', 'fs']
        );
    });

    it('should fail if the provided .gin path does not exist', async () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit: ${code}`);
        });

        const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(false) // Simulate file does not exist
        }));
        
        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        installApp = require('../../commands/installApp').installApp;
        
        // --- ASSERTIONS ---
        const options = { ginPath: '/bad/path.gin' };
        await expect(installApp(options)).rejects.toThrow('process.exit: 1');
        expect(process.exit).toHaveBeenCalledWith(1);
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Error"), expect.stringContaining("Package file not found"));
        mockExit.mockRestore();
        mockConsoleError.mockRestore();
    });
});
