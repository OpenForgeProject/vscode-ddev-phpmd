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
import { PhpmdViolation } from '../models/phpmd-result';

/**
 * Utilities for handling diagnostics
 */
export class DiagnosticUtils {
    /**
     * Convert a PHPMD priority to a VS Code diagnostic severity
     *
     * @param priority PHPMD priority (1-5)
     * @returns VS Code diagnostic severity
     */
    public static getSeverity(priority: number): vscode.DiagnosticSeverity {
        // PHPMD priorities: 1 = high, 2 = medium-high, 3 = medium-low, 4 = low, 5 = information
        switch (priority) {
            case 1:
                return vscode.DiagnosticSeverity.Error;
            case 2:
            case 3:
                return vscode.DiagnosticSeverity.Warning;
            case 4:
            case 5:
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Warning;
        }
    }

    /**
     * Check if a severity should be reported based on the minimum severity setting
     *
     * @param severity VS Code diagnostic severity
     * @param minSeverity Minimum severity setting ('error', 'warning', 'info')
     * @returns true if the severity should be reported, false otherwise
     */
    public static shouldReportSeverity(severity: vscode.DiagnosticSeverity, minSeverity: string): boolean {
        switch (minSeverity) {
            case 'error':
                return severity === vscode.DiagnosticSeverity.Error;
            case 'warning':
                return severity <= vscode.DiagnosticSeverity.Warning;
            case 'info':
                return true;
            default:
                return true;
        }
    }

    /**
     * Create a VS Code diagnostic from a PHPMD violation
     *
     * @param violation PHPMD violation
     * @returns VS Code diagnostic
     */
    public static createDiagnostic(violation: PhpmdViolation): vscode.Diagnostic {
        const lineNum = violation.beginLine - 1; // Convert to 0-based
        const range = new vscode.Range(
            new vscode.Position(lineNum, 0),
            new vscode.Position(lineNum, Number.MAX_VALUE)
        );

        const severity = DiagnosticUtils.getSeverity(violation.priority);
        const diagnostic = new vscode.Diagnostic(
            range,
            `${violation.description} (${violation.rule})`,
            severity
        );
        diagnostic.source = 'phpmd';

        // Add code and additional info if available
        if (violation.externalInfoUrl) {
            // Use DiagnosticRelatedInformation to include a link to documentation
            diagnostic.code = {
                value: violation.rule,
                target: vscode.Uri.parse(violation.externalInfoUrl)
            };
        } else {
            diagnostic.code = violation.rule;
        }

        return diagnostic;
    }
}
