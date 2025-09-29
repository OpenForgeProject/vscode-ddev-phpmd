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
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { afterEach, beforeEach } from 'mocha';
import { ConfigurationService } from '../services/configuration-service';
import { DEFAULT_CONFIG } from '../models/configuration';

suite('ConfigurationService Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let getConfigurationStub: sinon.SinonStub;
    let mockConfiguration: any;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Mock configuration object
        mockConfiguration = {
            get: sandbox.stub(),
            update: sandbox.stub().resolves()
        };

        // Mock workspace.getConfiguration
        getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockConfiguration);
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('getConfig returns default configuration when no settings are found', () => {
        // Setup mocks to return undefined (no user settings)
        mockConfiguration.get.withArgs('enable', DEFAULT_CONFIG.enable).returns(DEFAULT_CONFIG.enable);
        mockConfiguration.get.withArgs('validateOn', DEFAULT_CONFIG.validateOn).returns(DEFAULT_CONFIG.validateOn);
        mockConfiguration.get.withArgs('rulesets', DEFAULT_CONFIG.rulesets).returns(DEFAULT_CONFIG.rulesets);
        mockConfiguration.get.withArgs('minSeverity', DEFAULT_CONFIG.minSeverity).returns(DEFAULT_CONFIG.minSeverity);
        mockConfiguration.get.withArgs('configPath', DEFAULT_CONFIG.configPath).returns(DEFAULT_CONFIG.configPath);

        const config = ConfigurationService.getConfig();

        assert.deepStrictEqual(config, DEFAULT_CONFIG);
        assert.strictEqual(getConfigurationStub.calledWith('ddev-phpmd'), true);
    });

    test('getConfig returns custom configuration when settings are overridden', () => {
        const customConfig = {
            enable: false,
            validateOn: 'type',
            rulesets: ['naming', 'codesize'],
            minSeverity: 'error',
            configPath: 'custom/phpmd.xml'
        };

        // Setup mocks to return custom values
        mockConfiguration.get.withArgs('enable', DEFAULT_CONFIG.enable).returns(customConfig.enable);
        mockConfiguration.get.withArgs('validateOn', DEFAULT_CONFIG.validateOn).returns(customConfig.validateOn);
        mockConfiguration.get.withArgs('rulesets', DEFAULT_CONFIG.rulesets).returns(customConfig.rulesets);
        mockConfiguration.get.withArgs('minSeverity', DEFAULT_CONFIG.minSeverity).returns(customConfig.minSeverity);
        mockConfiguration.get.withArgs('configPath', DEFAULT_CONFIG.configPath).returns(customConfig.configPath);

        const config = ConfigurationService.getConfig();

        assert.deepStrictEqual(config, customConfig);
    });

    test('updateConfig calls workspace configuration update with correct parameters', async () => {
        await ConfigurationService.updateConfig('enable', false);

        assert.strictEqual(getConfigurationStub.calledWith('ddev-phpmd'), true);
        assert.strictEqual(mockConfiguration.update.calledWith('enable', false, vscode.ConfigurationTarget.Workspace), true);
    });

    test('updateConfig accepts custom configuration target', async () => {
        await ConfigurationService.updateConfig('minSeverity', 'info', vscode.ConfigurationTarget.Global);

        assert.strictEqual(mockConfiguration.update.calledWith('minSeverity', 'info', vscode.ConfigurationTarget.Global), true);
    });

    test('affectsConfiguration returns true for matching section', () => {
        const mockEvent = {
            affectsConfiguration: sandbox.stub().returns(true)
        } as any;

        const result = ConfigurationService.affectsConfiguration(mockEvent);

        assert.strictEqual(result, true);
        assert.strictEqual(mockEvent.affectsConfiguration.calledWith('ddev-phpmd'), true);
    });

    test('affectsConfiguration returns true for matching subsection', () => {
        const mockEvent = {
            affectsConfiguration: sandbox.stub().returns(true)
        } as any;

        const result = ConfigurationService.affectsConfiguration(mockEvent, 'enable');

        assert.strictEqual(result, true);
        assert.strictEqual(mockEvent.affectsConfiguration.calledWith('ddev-phpmd.enable'), true);
    });

    test('affectsConfiguration returns false for non-matching section', () => {
        const mockEvent = {
            affectsConfiguration: sandbox.stub().returns(false)
        } as any;

        const result = ConfigurationService.affectsConfiguration(mockEvent);

        assert.strictEqual(result, false);
    });
});
