// The command module will be required dynamically inside the tests.
describe('listApps.js - Integration Test', () => {

    let listApps;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'table').mockImplementation(() => {});
    });

    it('should fetch the app list and display it in a table on success', async () => {
        // --- MOCK DEPENDENCIES ---
        const mockAxiosInstance = { get: jest.fn() };
        jest.mock('../../commands/apiClient', () => ({
            getAuthenticatedClient: jest.fn().mockResolvedValue({
                client: mockAxiosInstance,
                serverUrl: 'http://test.server:7070'
            })
        }));
        const apiClient = require('../../commands/apiClient');

        // Mock the successful API response from Glade
        const mockApiResponse = {
            data: {
                status: 'success',
                apps: [
                    { name: 'glade', version: '1.0.0' },
                    { name: 'my-blog', version: '1.2.0' }
                ]
            }
        };
        mockAxiosInstance.get.mockResolvedValue(mockApiResponse);

        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        listApps = require('../../commands/listApps').listApps;
        await listApps({ serverUrl: 'http://test.server:7070' });

        // --- ASSERTIONS ---
        // Verify we got an authenticated client
        expect(apiClient.getAuthenticatedClient).toHaveBeenCalledWith('http://test.server:7070');
        
        // Verify the correct API endpoint was called
        expect(mockAxiosInstance.get).toHaveBeenCalledWith('http://test.server:7070/glade/api/apps');
        
        // Verify the data was displayed in a table
        expect(console.table).toHaveBeenCalledWith([
            { name: 'glade', version: '1.0.0' },
            { name: 'my-blog', version: '1.2.0' }
        ]);
    });

    it('should fail gracefully if not logged in', async () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit: ${code}`);
        });

        const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        // --- MOCK DEPENDENCIES ---
        jest.mock('../../commands/apiClient', () => ({
            getAuthenticatedClient: jest.fn().mockRejectedValue(new Error('You are not logged in.'))
        }));
        
        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        listApps = require('../../commands/listApps').listApps;
        
        // --- ASSERTIONS ---
        await expect(listApps({ serverUrl: 'http://test.server:7070' })).rejects.toThrow('process.exit: 1');
        expect(process.exit).toHaveBeenCalledWith(1);
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Error"), expect.stringContaining("You are not logged in."));
        mockExit.mockRestore();
        mockConsoleError.mockRestore();
    });
});
