describe('listBackups.js - Integration Test', () => {

    let listBackups;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'table').mockImplementation(() => {});
    });

    it('should fetch the backup list and display it in a table', async () => {
        // --- MOCK DEPENDENCIES ---
        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));

        jest.mock('../../commands/apiClient', () => ({
            listBackups: jest.fn().mockResolvedValue({
                status: 'success',
                backups: [
                    'my-app_v1.1.0_2025-08-28T12-00-00Z.gin',
                    'my-app_v1.0.0_2025-08-27T10-00-00Z.gin'
                ]
            })
        }));
        const apiClient = require('../../commands/apiClient');
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        listBackups = require('../../commands/listBackups').listBackups;
        const options = {
            serverUrl: 'http://test.server',
            appName: 'my-app'
        };
        await listBackups(options);

        // --- ASSERTIONS ---
        // Verify the correct API was called
        expect(apiClient.listBackups).toHaveBeenCalledWith(options.serverUrl, options.appName);
        
        // Verify the data was displayed in a table with the correct format
        expect(console.table).toHaveBeenCalledWith([
            { 'Backup Filename': 'my-app_v1.1.0_2025-08-28T12-00-00Z.gin' },
            { 'Backup Filename': 'my-app_v1.0.0_2025-08-27T10-00-00Z.gin' }
        ]);
    });

    it('should display a message if no backups are found', async () => {
        // --- MOCK DEPENDENCIES ---
        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));

        jest.mock('../../commands/apiClient', () => ({
            listBackups: jest.fn().mockResolvedValue({
                status: 'success',
                backups: [] // Simulate empty list
            })
        }));
        const apiClient = require('../../commands/apiClient');

        // --- DYNAMICALLY REQUIRE AND RUN ---
        listBackups = require('../../commands/listBackups').listBackups;
        const options = {
            serverUrl: 'http://test.server',
            appName: 'my-app'
        };
        await listBackups(options);
        
        // --- ASSERTIONS ---
        expect(apiClient.listBackups).toHaveBeenCalledWith(options.serverUrl, options.appName);
        expect(console.table).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No backups found"));
    });
});
