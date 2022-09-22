module.exports = {
    readme: 'README.md',
    tsconfig: 'tsconfig.json',
    exclude: [
        '**/node_modules/**',
        '**/test/**',
        '**/*.test.*'
    ],
    out: './docs',
    entryPoints: 'lib/createWatcher.ts',
};
