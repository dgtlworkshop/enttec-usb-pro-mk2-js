import fs from "node:fs/promises";

/** @type {import("../package.json")} */
const package_json = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url)));

if (process.argv.length < 3) {
	console.error(`Pass the argument for the version to compare against (ex: 1.0.1)`);
	console.debug(process.argv);
	process.exitCode = 1;
}

let comparison_version = new String(process.argv.at(-1));

if (comparison_version.startsWith("v")) {
	comparison_version = comparison_version.slice(1);
}

if (!package_json.version) {
	console.error(`package.json version is undefined`);
	process.exitCode = 1;
} else if (!comparison_version) {
	console.error(`No argument for comparison version`);
	console.debug(process.argv);
	process.exitCode = 1;
} else if (package_json.version === comparison_version) {
	console.info(`package.json version '${package_json.version}' === '${comparison_version}'`);
} else {
	console.error(`package.json version '${package_json.version}' !== '${comparison_version}'`);
	process.exitCode = 1;
}
