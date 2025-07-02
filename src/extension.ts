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
import { PhpmdService } from './services/phpmd-service';
import { DdevUtils } from './shared/utils/ddev-utils';

// Global service instance
let phpmdService: PhpmdService | undefined;

// Status bar item
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Activate the extension
 *
 * @param context VS Code extension context
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('DDEV PHPMD extension is now active!');

    // Check if we're in a workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        console.log('No workspace folder found. DDEV PHPMD extension will not activate.');
        return;
    }

    // Get the first workspace folder
    const workspaceFolder = workspaceFolders[0];

    /**
     * Helper function to check DDEV and PHPMD requirements
     */
    const checkRequirements = (): boolean => {
        // Validate DDEV project and PHPMD installation
        const validationResult = DdevUtils.validateDdevTool('phpmd', workspaceFolder.uri.fsPath);

        if (!validationResult.isValid) {
            // Show appropriate error message based on the validation result
            if (validationResult.userMessage && validationResult.userDetail) {
                vscode.window.showErrorMessage(
                    validationResult.userMessage,
                    {
                        modal: false,
                        detail: validationResult.userDetail
                    }
                );
            }
            return false;
        }

        return true;
    };

    // Check requirements before activating the extension
    if (!checkRequirements()) {
        return;
    }

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(check) PHPMD";
    statusBarItem.tooltip = "PHPMD is active";
    statusBarItem.command = "ddev-phpmd.analyzeCurrentFile";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Initialize the PHPMD service
    phpmdService = new PhpmdService(context);
}

/**
 * Deactivate the extension
 */
export function deactivate() {
    // Clean up resources
    if (phpmdService) {
        phpmdService.dispose();
        phpmdService = undefined;
    }

    // Dispose of status bar item
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = undefined;
    }
}
