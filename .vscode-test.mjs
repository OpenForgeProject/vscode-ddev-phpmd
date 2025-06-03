import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'dist/test/**/*.test.js',
	workspaceFolder: '.',
	mocha: {
		ui: 'tdd',
		timeout: 20000
	}
});
