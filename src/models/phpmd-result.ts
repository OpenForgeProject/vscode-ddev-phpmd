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
 * Interface representing the PHPMD violation from the output
 */
export interface PhpmdViolation {
    /** Line number where the violation begins */
    beginLine: number;

    /** Line number where the violation ends */
    endLine: number;

    /** Column number where the violation begins */
    beginColumn: number;

    /** Column number where the violation ends */
    endColumn: number;

    /** Description of the violation */
    description: string;

    /** PHPMD rule that was violated */
    rule: string;

    /** Rule set that contains the rule */
    ruleSet: string;

    /** Priority of the violation (1-5) */
    priority: number;

    /** URL with more information about the rule */
    externalInfoUrl?: string;
}

/**
 * Interface representing a file with violations in PHPMD output
 */
export interface PhpmdFileResult {
    /** Path to the file */
    file: string;

    /** List of violations in the file */
    violations: PhpmdViolation[];
}

/**
 * Interface representing the PHPMD analysis result
 */
export interface PhpmdResult {
    /** List of files with violations */
    files: PhpmdFileResult[];
}
