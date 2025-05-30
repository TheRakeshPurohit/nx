import { AggregateCreateNodesError, workspaceRoot } from '@nx/devkit';
import { ExecFileOptions, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LARGE_BUFFER } from 'nx/src/executors/run-commands/run-commands.impl';

export const fileSeparator = process.platform.startsWith('win')
  ? 'file:///'
  : 'file://';

export const newLineSeparator = process.platform.startsWith('win')
  ? '\r\n'
  : '\n';

/**
 * For gradle command, it needs to be run from the directory of the gradle binary
 * @returns gradle binary file name
 */
export function getGradleExecFile(): string {
  return process.platform.startsWith('win') ? '.\\gradlew.bat' : './gradlew';
}

/**
 * This function executes gradle with the given arguments
 * @param gradleBinaryPath absolute path to gradle binary
 * @param args args passed to gradle
 * @param execOptions exec options
 * @returns promise with the stdout buffer
 */
export function execGradleAsync(
  gradleBinaryPath: string,
  args: ReadonlyArray<string>,
  execOptions: ExecFileOptions = {}
): Promise<Buffer> {
  return new Promise<Buffer>((res, rej: (stdout: Buffer) => void) => {
    const cp = execFile(gradleBinaryPath, args, {
      cwd: dirname(gradleBinaryPath),
      shell: true,
      windowsHide: true,
      env: process.env,
      maxBuffer: LARGE_BUFFER,
      ...execOptions,
    });

    let stdout = Buffer.from('');
    cp.stdout?.on('data', (data) => {
      stdout += data;
    });
    cp.stderr?.on('data', (data) => {
      stdout += data;
    });

    cp.on('exit', (code) => {
      if (code === 0) {
        res(stdout);
      } else {
        rej(stdout);
      }
    });
  });
}

/**
 * This function recursively finds the nearest gradlew file in the workspace
 * @param originalFileToSearch the original file to search for, relative to workspace root, file path not directory path
 * @param wr workspace root
 * @param currentSearchPath the path to start searching for gradlew file
 * @returns the relative path of the gradlew file to workspace root, throws an error if gradlew file is not found
 * It will return relative path to workspace root of gradlew.bat file on windows and gradlew file on other platforms
 */
export function findGradlewFile(
  originalFileToSearch: string,
  wr: string = workspaceRoot,
  currentSearchPath?: string
): string {
  currentSearchPath ??= originalFileToSearch;
  const parent = dirname(currentSearchPath);
  if (currentSearchPath === parent) {
    throw new AggregateCreateNodesError(
      [
        [
          originalFileToSearch,
          new Error('No Gradlew file found. Run "gradle init"'),
        ],
      ],
      []
    );
  }

  const gradlewPath = join(parent, 'gradlew');
  const gradlewBatPath = join(parent, 'gradlew.bat');

  if (process.platform.startsWith('win')) {
    if (existsSync(join(wr, gradlewBatPath))) {
      return gradlewBatPath;
    }
  } else {
    if (existsSync(join(wr, gradlewPath))) {
      return gradlewPath;
    }
  }

  return findGradlewFile(originalFileToSearch, wr, parent);
}
