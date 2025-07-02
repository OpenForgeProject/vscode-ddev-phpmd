/*
 * This file is part of the @openforgeproject/vscode-ddev-utils package.
 * Will be extracted to a shared NPM package in the future.
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
import { execSync } from 'child_process';

/**
 * DDEV project validation result
 */
export interface DdevValidationResult {
    isValid: boolean;
    errorType?: 'no-workspace' | 'no-ddev-project' | 'ddev-not-running' | 'tool-not-found' | 'unknown';
    errorMessage?: string;
    userMessage?: string;
    userDetail?: string;
}

/**
 * Utilities for working with DDEV projects and tools
 *
 * This class will be part of the @openforgeproject/vscode-ddev-utils package
 * and provides common functionality for all DDEV-based VS Code extensions.
 */
export class DdevUtils {
    /**
     * Check if the given workspace folder has a DDEV project
     *
     * @param workspacePath Path to the workspace folder
     * @returns true if workspace has a DDEV project, false otherwise
     */
    public static hasDdevProject(workspacePath: string): boolean {
        try {
            const ddevConfig = execSync('test -f .ddev/config.yaml && echo "exists"', {
                cwd: workspacePath,
                encoding: 'utf-8'
            });
            return ddevConfig.includes('exists');
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if DDEV is running in the given workspace
     *
     * @param workspacePath Path to the workspace folder
     * @returns true if DDEV is running, false otherwise
     */
    public static isDdevRunning(workspacePath: string): boolean {
        try {
            execSync('ddev exec echo "test"', {
                cwd: workspacePath,
                stdio: 'ignore'
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if a specific tool is installed in the DDEV container
     *
     * @param toolName Name of the tool (e.g., 'phpmd', 'phpcs', 'phpstan')
     * @param workspacePath Path to the workspace folder
     * @returns true if tool is installed, false otherwise
     */
    public static isToolInstalled(toolName: string, workspacePath: string): boolean {
        try {
            execSync(`ddev exec ${toolName} --version`, {
                cwd: workspacePath,
                stdio: 'ignore'
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Comprehensive validation of DDEV project and tool availability
     *
     * @param toolName Name of the tool to validate (e.g., 'phpmd', 'phpcs', 'phpstan')
     * @param workspacePath Path to the workspace folder
     * @returns Validation result with detailed information
     */
    public static validateDdevTool(toolName: string, workspacePath: string): DdevValidationResult {
        // Check if DDEV project exists
        if (!this.hasDdevProject(workspacePath)) {
            return {
                isValid: false,
                errorType: 'no-ddev-project',
                userMessage: 'No DDEV project found',
                userDetail: 'This extension requires a DDEV project. ' +
                           'Please make sure you are in a DDEV project directory with a .ddev/config.yaml file.'
            };
        }

        // Check DDEV and tool in one step by trying to run the tool
        try {
            execSync(`ddev exec ${toolName} --version`, {
                cwd: workspacePath,
                stdio: 'ignore'
            });

            return {
                isValid: true
            };
        } catch (error: any) {
            // Get the actual error message
            let errorMessage = '';
            try {
                execSync(`ddev exec ${toolName} --version`, {
                    cwd: workspacePath,
                    encoding: 'utf-8'
                });
            } catch (execError: any) {
                errorMessage = execError.message || execError.stderr || '';
            }

            // Check if error indicates DDEV is not running
            if (errorMessage.includes('Project is not currently running') ||
                errorMessage.includes('ddev start')) {
                return {
                    isValid: false,
                    errorType: 'ddev-not-running',
                    errorMessage: errorMessage,
                    userMessage: 'DDEV is not running',
                    userDetail: 'This extension requires DDEV to be running. ' +
                               'Please start DDEV by running:\n\n' +
                               'ddev start'
                };
            }

            // Check if error indicates tool is not installed
            if (errorMessage.includes(`${toolName}: not found`) ||
                errorMessage.includes('command not found')) {
                return {
                    isValid: false,
                    errorType: 'tool-not-found',
                    errorMessage: errorMessage,
                    userMessage: `${toolName.toUpperCase()} is not installed`,
                    userDetail: `This extension requires ${toolName.toUpperCase()} to be installed in your DDEV container. ` +
                               'Please install it by running:\n\n' +
                               `ddev exec composer require --dev ${this.getComposerPackageName(toolName)}\n\n` +
                               'The extension will be disabled until the tool is installed.'
                };
            }

            // For any other error, return generic message
            return {
                isValid: false,
                errorType: 'unknown',
                errorMessage: errorMessage,
                userMessage: `Unable to verify ${toolName.toUpperCase()} installation`,
                userDetail: 'Error: ' + errorMessage.split('\n\n')[0]
            };
        }
    }

    /**
     * Get the composer package name for a given tool
     *
     * @param toolName Name of the tool
     * @returns Composer package name
     */
    private static getComposerPackageName(toolName: string): string {
        const packageMap: { [key: string]: string } = {
            'phpmd': 'phpmd/phpmd',
            'phpcs': 'squizlabs/php_codesniffer',
            'phpstan': 'phpstan/phpstan'
        };

        return packageMap[toolName] || `${toolName}/${toolName}`;
    }

    /**
     * Check if the given document is part of a DDEV project
     *
     * @param document The document to check
     * @returns true if the document is part of a DDEV project, false otherwise
     */
    public static isDdevProject(document: vscode.TextDocument): boolean {
        try {
            // Get workspace folder containing the current file
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                return false;
            }

            return this.hasDdevProject(workspaceFolder.uri.fsPath) &&
                   this.isDdevRunning(workspaceFolder.uri.fsPath);
        } catch (error) {
            return false;
        }
    }

    /**
     * Execute a command in the DDEV container
     *
     * @param command Command to execute
     * @param workspacePath Path to the workspace
     * @returns Output of the command
     * @throws Error if the command fails
     */
    public static execDdev(command: string, workspacePath: string): string {
        try {
            return execSync(`ddev exec ${command}`, {
                cwd: workspacePath,
                encoding: 'utf-8'
            });
        } catch (execError: any) {
            // Some tools like PHPMD return exit code 1 or 2 when they find violations, which is not an error for us
            if (execError.stdout) {
                return execError.stdout;
            }
            throw execError;
        }
    }
}
