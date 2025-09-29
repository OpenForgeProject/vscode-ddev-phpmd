/*
 * This file is part of the vscode-ddev-phpmd extension.
 *
 * © OpenForgeProject
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { afterEach, beforeEach } from 'mocha';
import { DdevUtils } from '../shared/utils/ddev-utils';

suite('DdevUtils Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let execSyncStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        // Mock the entire child_process module
        const childProcess = require('child_process');
        execSyncStub = sandbox.stub(childProcess, 'execSync');
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('hasDdevProject returns true when .ddev/config.yaml exists', () => {
        execSyncStub.returns('exists\n');

        const result = DdevUtils.hasDdevProject('/test/workspace');

        assert.strictEqual(result, true);
        assert.strictEqual(execSyncStub.calledOnce, true);
    });

    test('hasDdevProject returns false when .ddev/config.yaml does not exist', () => {
        execSyncStub.throws(new Error('File not found'));

        const result = DdevUtils.hasDdevProject('/test/workspace');

        assert.strictEqual(result, false);
    });

    test('isDdevRunning returns true when DDEV container is running', () => {
        execSyncStub.returns('');

        const result = DdevUtils.isDdevRunning('/test/workspace');

        assert.strictEqual(result, true);
        assert.strictEqual(execSyncStub.calledOnce, true);
    });

    test('isDdevRunning returns false when DDEV container is not running', () => {
        execSyncStub.throws(new Error('Container not running'));

        const result = DdevUtils.isDdevRunning('/test/workspace');

        assert.strictEqual(result, false);
    });

    test('isToolInstalled returns true when tool is available', () => {
        execSyncStub.returns('PHPMD 2.13.0\n');

        const result = DdevUtils.isToolInstalled('phpmd', '/test/workspace');

        assert.strictEqual(result, true);
        assert.strictEqual(execSyncStub.calledOnce, true);
    });

    test('isToolInstalled returns false when tool is not available', () => {
        execSyncStub.throws(new Error('Command not found'));

        const result = DdevUtils.isToolInstalled('phpmd', '/test/workspace');

        assert.strictEqual(result, false);
    });

    test('validateDdevTool returns invalid result when no DDEV project found', () => {
        execSyncStub.throws(new Error('File not found'));

        const result = DdevUtils.validateDdevTool('phpmd', '/test/workspace');

        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.errorType, 'no-ddev-project');
        assert.strictEqual(result.userMessage, 'No DDEV project found');
    });

    test('validateDdevTool returns valid result when tool is available', () => {
        // First call (hasDdevProject) succeeds
        execSyncStub.onFirstCall().returns('exists\n');
        // Second call (tool version check) succeeds
        execSyncStub.onSecondCall().returns('PHPMD 2.13.0\n');

        const result = DdevUtils.validateDdevTool('phpmd', '/test/workspace');

        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.errorType, undefined);
    });

    test('validateDdevTool returns error message for DDEV issues', () => {
        // First call (hasDdevProject) succeeds
        execSyncStub.onFirstCall().returns('exists\n');
        // Second call (tool version check) fails
        execSyncStub.onSecondCall().throws(new Error('Tool not available'));
        // Third call (error details) returns error
        execSyncStub.onThirdCall().throws({
            message: 'DDEV project not currently running',
            stderr: 'not currently running'
        });

        const result = DdevUtils.validateDdevTool('phpmd', '/test/workspace');

        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.errorType, 'unknown');
        assert.ok(result.userMessage?.includes('PHPMD not available'));
    });

    test('execDdev returns output when command succeeds', () => {
        const expectedOutput = 'Command output';
        execSyncStub.returns(expectedOutput);

        const result = DdevUtils.execDdev('phpmd test.php json cleancode', '/test/workspace');

        assert.strictEqual(result, expectedOutput);
        assert.strictEqual(execSyncStub.calledOnce, true);
    });

    test('execDdev returns stdout when command fails but has output', () => {
        const error = new Error('Command failed') as any;
        error.stdout = 'PHPMD violations found';
        execSyncStub.throws(error);

        const result = DdevUtils.execDdev('phpmd test.php json cleancode', '/test/workspace');

        assert.strictEqual(result, 'PHPMD violations found');
    });

    test('execDdev throws error when command fails without stdout', () => {
        const error = new Error('Command failed');
        execSyncStub.throws(error);

        assert.throws(() => {
            DdevUtils.execDdev('phpmd test.php json cleancode', '/test/workspace');
        }, /Command failed/);
    });
});
