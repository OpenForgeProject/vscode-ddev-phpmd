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

import * as vscode from 'vscode';
import { DEFAULT_CONFIG, PhpmdConfig } from '../models/configuration';

/**
 * Service for managing the extension configuration
 */
export class ConfigurationService {
    /**
     * Get the current configuration
     *
     * @returns The current configuration
     */
    public static getConfig(): PhpmdConfig {
        const config = vscode.workspace.getConfiguration('ddev-phpmd');
        return {
            enable: config.get('enable', DEFAULT_CONFIG.enable),
            validateOn: config.get('validateOn', DEFAULT_CONFIG.validateOn),
            rulesets: config.get('rulesets', DEFAULT_CONFIG.rulesets),
            minSeverity: config.get('minSeverity', DEFAULT_CONFIG.minSeverity),
            configPath: config.get('configPath', DEFAULT_CONFIG.configPath)
        };
    }
}
