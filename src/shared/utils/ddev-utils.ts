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
        // First check if this is a DDEV project
        if (!this.hasDdevProject(workspacePath)) {
            return {
                isValid: false,
                errorType: 'no-ddev-project',
                userMessage: 'No DDEV project found'
            };
        }

        // Try to run the tool
        try {
            execSync(`ddev exec ${toolName} --version`, {
                cwd: workspacePath,
                stdio: 'ignore'
            });

            return {
                isValid: true
            };
        } catch (error: any) {
            // Try to get more specific error information
            let errorDetails = '';
            try {
                execSync(`ddev exec ${toolName} --version`, {
                    cwd: workspacePath,
                    encoding: 'utf-8'
                });
            } catch (execError: any) {
                errorDetails = execError.message || execError.stderr || '';
            }

            // Build concise but informative error message
            let userMessage = `${toolName.toUpperCase()} not available`;

            // Add specific hints based on error content
            if (errorDetails.includes('not currently running') ||
                errorDetails.includes('ddev start') ||
                errorDetails.includes('No such container')) {
                userMessage = `${toolName.toUpperCase()} not available - DDEV appears to be stopped`;
            } else if (errorDetails.includes('not found') ||
                       errorDetails.includes('command not found')) {
                userMessage = `${toolName.toUpperCase()} not available - not installed in container`;
            } else {
                userMessage = `${toolName.toUpperCase()} not available - check DDEV status`;
            }

            return {
                isValid: false,
                errorType: 'unknown',
                userMessage: userMessage
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
