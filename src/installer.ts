import { exec } from "child_process";
import { TypeScriptVersion } from "definitelytyped-header-parser";
import * as fsp from "fs-promise";
import * as path from "path";

const installsDir = path.join(__dirname, "..", "typescript-installs");

export async function installAll() {
	for (const v of TypeScriptVersion.all) {
		await install(v);
	}
	await install("next");
}

async function install(version: TypeScriptVersion | "next"): Promise<void> {
	const dir = installDir(version);
	if (!await fsp.existsSync(dir)) {
		console.log(`Installing to ${dir}...`);
		await fsp.mkdirp(dir);
		await fsp.writeJson(path.join(dir, "package.json"), packageJson(version));
		await execAndThrowErrors("npm install --ignore-scripts --no-shrinkwrap --no-package-lock --no-bin-links", dir);
		console.log("Installed!");
	}
}

export function cleanInstalls(): Promise<void> {
	return fsp.remove(installsDir);
}

export function typeScriptPath(version: TypeScriptVersion | "next"): string {
	return path.join(installDir(version), "node_modules", "typescript");
}

function installDir(version: TypeScriptVersion | "next"): string {
	return path.join(installsDir, version);
}

/** Run a command and return the stdout, or if there was an error, throw. */
async function execAndThrowErrors(cmd: string, cwd?: string): Promise<void> {
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

function packageJson(version: TypeScriptVersion | "next"): {} {
	return {
		description: `Installs typescript@${version}`,
		repository: "N/A",
		license: "MIT",
		dependencies: {
			typescript: version,
		},
	};
}
