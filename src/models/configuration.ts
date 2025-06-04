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

/**
 * Interface for the extension configuration
 */
export interface PhpmdConfig {
    /** Whether the extension is enabled */
    enable: boolean;

    /** When to validate: 'save' or 'type' */
    validateOn: string;

    /** PHPMD ruleset IDs to use */
    rulesets: string[];

    /** Minimum severity level for reported issues */
    minSeverity: string;

    /** Path to custom PHPMD ruleset XML file (relative to workspace root) */
    configPath: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: PhpmdConfig = {
    enable: true,
    validateOn: 'save',
    rulesets: ['cleancode', 'codesize', 'controversial', 'design', 'naming', 'unusedcode'],
    minSeverity: 'warning',
    configPath: ''
};
