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
import { execSync } from 'child_process';

/**
 * Utilities for working with DDEV
 */
export class DdevUtils {
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

            // Check if .ddev/config.yaml exists
            const ddevConfig = execSync('test -f .ddev/config.yaml && echo "exists"', {
                cwd: workspaceFolder.uri.fsPath,
                encoding: 'utf-8'
            });

            if (!ddevConfig.includes('exists')) {
                return false;
            }

            // Check if DDEV is running
            execSync('ddev status', {
                cwd: workspaceFolder.uri.fsPath,
                stdio: 'ignore'
            });
            return true;
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
            // PHPMD returns exit code 1 or 2 when it finds violations, which is not an error for us
            if (execError.stdout) {
                return execError.stdout;
            }
            throw execError;
        }
    }
}
