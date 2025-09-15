const path = require('path');

describe('upgradeApp.js - Integration Test', () => {
    let upgradeApp;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should perform a full interactive upgrade with permission changes', async () => {
        // --- MOCK DEPENDENCIES ---
        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(true),
            readFileSync: jest.fn().mockReturnValue(Buffer.from('new-gin-buffer')),
            readJson: jest.fn().mockResolvedValue({ db: [] }),
            writeJson: jest.fn().mockResolvedValue(true),
            remove: jest.fn().mockResolvedValue(true),
            ensureDir: jest.fn().mockResolvedValue(true)
        }));
        const fs = require('fs-extra');

        jest.mock('../../commands/apiClient', () => ({
            ensureAuthenticated: jest.fn().mockResolvedValue(true),
            getAppPermissions: jest.fn().mockResolvedValue({
                status: 'success',
                grantedPermissions: ['db'] // The app currently only has 'db' permission
            }),
            upgradeApp: jest.fn().mockResolvedValue({ status: 'success' })
        }));
        const apiClient = require('../../commands/apiClient');

        jest.mock('../../commands/installerUtils', () => ({
            _getHttpClientErrorMessage: jest.fn(err => err.message), // Simple mock for error messages
            _unzipBuffer: jest.fn().mockResolvedValue(true),
            _repackApp: jest.fn().mockResolvedValue(Buffer.from('repacked-gin-buffer')),
            _getUpgradePermissions: jest.fn().mockResolvedValue(['db', 'fs']), // User approves adding 'fs'
            _getDbRequirements: jest.fn().mockResolvedValue([{ host: 'db.upgraded' }])
        }));
        const installerUtils = require('../../commands/installerUtils');
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        upgradeApp = require('../../commands/upgradeApp').upgradeApp;
        const options = {
            serverUrl: 'http://test.server',
            appName: 'my-app',
            ginPath: '/path/to/new-version.gin'
        };
        await upgradeApp(options);

        // --- ASSERTIONS ---

        // Verify it fetched the current permissions to perform a diff
        expect(apiClient.getAppPermissions).toHaveBeenCalledWith(options.serverUrl, options.appName);
        
        // Verify the interactive permission prompt for upgrades was called
        expect(installerUtils._getUpgradePermissions).toHaveBeenCalledWith(
            expect.any(String), // unpackedPath
            ['db'] // The current permissions
        );
        
        // Verify the final API call was made with the new, user-approved data
        expect(apiClient.upgradeApp).toHaveBeenCalledTimes(1);
        expect(apiClient.upgradeApp).toHaveBeenCalledWith(
            options.serverUrl,
            options.appName,
            expect.any(String), // gin filename
            Buffer.from('repacked-gin-buffer'),
            ['db', 'fs'] // The final, combined permission set
        );

        // Verify app.json was updated with the new DB config
        const writtenAppJson = fs.writeJson.mock.calls[0][1];
        expect(writtenAppJson.db[0].host).toBe('db.upgraded');
    });
});
