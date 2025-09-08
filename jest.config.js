module.exports = {
  // Use 'node' as the test environment for a CLI
  testEnvironment: 'node',

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // A list of paths to directories that Jest should use to search for files in
  roots: [
    '<rootDir>/test'
  ],
  
  testMatch: [
    "**/test/**/*.test.js"
  ],
  
  "reporters": [
    "default",
    [
      "./node_modules/jest-html-reporter",
      {
        "pageTitle": "GingerJS Test Report",
        "outputPath": "./test/test-report.html"
      }
    ]
  ]
};