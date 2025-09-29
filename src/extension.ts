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
import { ConfigurationService } from './services/configuration-service';

// Global service instance
let phpmdService: PhpmdService | undefined;

// Status bar item
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Analyze the current file if the service is available and enabled
 */
function analyzeCurrentFile() {
    const config = ConfigurationService.getConfig();
    if (!config.enable) {
        vscode.window.showWarningMessage('PHPMD is disabled. Enable it first to analyze files.');
        return;
    }

    if (!phpmdService) {
        vscode.window.showWarningMessage('PHPMD service is not available. Please check your DDEV configuration.');
        return;
    }

    phpmdService.analyzeCurrentFile();
}

/**
 * Update status bar based on current configuration
 */
function updateStatusBar() {
    if (!statusBarItem) {
        return;
    }

    const config = ConfigurationService.getConfig();
    if (config.enable) {
        statusBarItem.text = "$(check) PHPMD";
        statusBarItem.tooltip = "PHPMD is enabled. Click to analyze current file.";
        statusBarItem.command = "ddev-phpmd.analyzeCurrentFile";
        statusBarItem.color = undefined;
    } else {
        statusBarItem.text = "$(x) PHPMD";
        statusBarItem.tooltip = "PHPMD is disabled. Click to enable.";
        statusBarItem.command = "ddev-phpmd.enable";
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }
}

/**
 * Initialize or reinitialize the PHPMD service based on configuration
 */
function initializeService(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder) {
    const config = ConfigurationService.getConfig();

    if (config.enable) {
        if (!phpmdService) {
            // Validate DDEV project and PHPMD installation only when enabling
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

            phpmdService = new PhpmdService(context);
            console.log('PHPMD service initialized.');
        }
    } else {
        if (phpmdService) {
            phpmdService.dispose();
            phpmdService = undefined;
            console.log('PHPMD service disposed.');
        }
    }

    return true;
}

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

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Update status bar initially
    updateStatusBar();

    // Initialize service based on configuration
    initializeService(context, workspaceFolder);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('ddev-phpmd.analyzeCurrentFile', analyzeCurrentFile),

        vscode.commands.registerCommand('ddev-phpmd.enable', async () => {
            const config = vscode.workspace.getConfiguration('ddev-phpmd');
            await config.update('enable', true, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage('DDEV PHPMD enabled.');
        }),

        vscode.commands.registerCommand('ddev-phpmd.disable', async () => {
            const config = vscode.workspace.getConfiguration('ddev-phpmd');
            await config.update('enable', false, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage('DDEV PHPMD disabled.');
        }),

        vscode.commands.registerCommand('ddev-phpmd.toggle', async () => {
            const config = vscode.workspace.getConfiguration('ddev-phpmd');
            const currentValue = config.get('enable', true);
            await config.update('enable', !currentValue, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`DDEV PHPMD ${!currentValue ? 'enabled' : 'disabled'}.`);
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('ddev-phpmd.enable')) {
                updateStatusBar();
                initializeService(context, workspaceFolder);
            }
        })
    );
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
