describe('rollbackApp.js - Integration Test', () => {
    let rollbackApp;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it.only('should perform a full interactive rollback with permission changes', async () => {
        // --- MOCK DEPENDENCIES ---
        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));

        jest.mock('../../commands/apiClient', () => ({
            analyzeBackup: jest.fn().mockResolvedValue({
                status: 'success',
                version: '1.0.0',
                permissions: { mandatory: ['db'] } // Backup only required 'db'
            }),
            getAppPermissions: jest.fn().mockResolvedValue({
                status: 'success',
                grantedPermissions: ['db', 'fs'] // Current version has 'db' and 'fs'
            }),
            rollbackApp: jest.fn().mockResolvedValue({ status: 'success' })
        }));
        const apiClient = require('../../commands/apiClient');

        jest.mock('../../commands/installerUtils', () => ({
            // We only need to mock the interactive part
            _getRollbackPermissions: jest.fn().mockResolvedValue(['db']) // User approves the rollback, resulting in only 'db'
        }));
        const installerUtils = require('../../commands/installerUtils');

        const promptMock = jest.fn().mockResolvedValue({ proceed: 'Yes' });
        jest.unstable_mockModule('inquirer', () => ({ default: { prompt: promptMock } }));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        rollbackApp = require('../../commands/rollbackApp').rollbackApp;
        const options = {
            serverUrl: 'http://test.server',
            appName: 'my-app'
        };
        await rollbackApp(options);

        // --- ASSERTIONS ---
        // Verify the analysis and current permissions were fetched
        expect(apiClient.analyzeBackup).toHaveBeenCalledWith(options.serverUrl, options.appName);
        expect(apiClient.getAppPermissions).toHaveBeenCalledWith(options.serverUrl, options.appName);

        // Verify the interactive diff/consent prompt was shown
        expect(installerUtils._getRollbackPermissions).toHaveBeenCalledWith(
            { mandatory: ['db'] }, // Permissions from backup
            ['db', 'fs'] // Current permissions
        );

        // Verify the final API call was made with the correct, user-approved permission set
        expect(apiClient.rollbackApp).toHaveBeenCalledTimes(1);
        expect(apiClient.rollbackApp).toHaveBeenCalledWith(
            options.serverUrl,
            options.appName,
            ['db'] // The final, approved permission set
        );
    });
});
