describe('deleteApp.js - Integration Test', () => {

    let deleteApp;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should call the delete API after the user provides correct confirmation text', async () => {
        // --- MOCK DEPENDENCIES ---
        const promptMock = jest.fn().mockResolvedValue({ confirmDelete: 'app-to-delete' });
        jest.unstable_mockModule('inquirer', () => ({ default: { prompt: promptMock } }));

        jest.mock('../../commands/apiClient', () => ({
            ensureAuthenticated: jest.fn().mockResolvedValue(true),
            deleteApp: jest.fn().mockResolvedValue({ status: 'success' })
        }));
        const apiClient = require('../../commands/apiClient');

        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        deleteApp = require('../../commands/deleteApp').deleteApp;
        const options = {
            serverUrl: 'http://test.server',
            appName: 'app-to-delete'
        };
        await deleteApp(options);

        // --- ASSERTIONS ---
        expect(promptMock).toHaveBeenCalledTimes(1);
        expect(apiClient.deleteApp).toHaveBeenCalledWith(options.serverUrl, options.appName);
    });

    it('should NOT call the delete API if confirmation text is incorrect', async () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit: ${code}`);
        });

        const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        // --- MOCK DEPENDENCIES ---
        const promptMock = jest.fn().mockResolvedValue({ confirmDelete: 'wrong-text' });
        jest.unstable_mockModule('inquirer', () => ({ default: { prompt: promptMock } }));
        
        jest.mock('../../commands/apiClient', () => ({
            ensureAuthenticated: jest.fn().mockResolvedValue(true),
            deleteApp: jest.fn()
        }));
        const apiClient = require('../../commands/apiClient');

        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        deleteApp = require('../../commands/deleteApp').deleteApp;
        
        // --- ASSERTIONS ---
        const options = { appName: 'app-to-delete' };
        await expect(deleteApp(options)).rejects.toThrow('process.exit: 1');
        
        // Crucially, verify the API was never called
        expect(apiClient.deleteApp).not.toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Error"), expect.stringContaining("Confirmation text did not match"));
        mockExit.mockRestore();
        mockConsoleError.mockRestore();
    });
});
