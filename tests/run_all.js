
const jest = require('jest');

const options = {
    projects: ['<rootDir>'],
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.jsx?$',
    moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
};

jest.runCLI(options, options.projects);