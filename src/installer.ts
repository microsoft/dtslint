import { exec } from "child_process";
import { TypeScriptVersion } from "definitelytyped-header-parser";
import * as fsp from "fs-promise";
import * as path from "path";
import * as TsLintType from "tslint";

const installsDir = path.join(__dirname, "..", "typescript-installs");

export async function getLinter(version: TypeScriptVersion): Promise<typeof TsLintType> {
	const dir = installDir(version);

	if (!await fsp.existsSync(dir)) {
		console.log(`Installing to ${dir}...`);
		await fsp.mkdirp(dir);
		await fsp.writeJson(path.join(dir, "package.json"), packageJson(version));
		await execAndThrowErrors("npm install", dir);
		// Copy rules so they use the local typescript/tslint
		await fsp.copy(path.join(__dirname, "rules"), path.join(dir, "rules"));
		console.log("Installed!");
	}

	const tslintPath = path.join(dir, "node_modules", "tslint");
	return require(tslintPath);
}

export function rulesDirectory(version: TypeScriptVersion): string {
	return path.join(installDir(version), "rules");
}

export function cleanInstalls(): Promise<void> {
	return fsp.remove(installsDir);
}

export function tscPath(version: TypeScriptVersion) {
	return path.join(installDir(version), "node_modules", "typescript", "lib", "tsc.js");
}

function installDir(version: TypeScriptVersion) {
	return path.join(installsDir, version);
}

/** Run a command and return the stdout, or if there was an error, throw. */
export async function execAndThrowErrors(cmd: string, cwd?: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		exec(cmd, { encoding: "utf8", cwd }, (err, _stdout, stderr) => {
			console.error(stderr);
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

const tslintVersion: string = require("../package.json").devDependencies.tslint; // tslint:disable-line:no-var-requires
if (!tslintVersion) {
	throw new Error("Missing tslint version.");
}

function packageJson(version: TypeScriptVersion): {} {
	return {
		description: "",
		repository: "",
		license: "",
		dependencies: {
			typescript: `${version}.x`,
			tslint: tslintVersion,
		},
	};
}
