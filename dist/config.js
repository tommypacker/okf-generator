import { promises as fs } from "node:fs";
import path from "node:path";
import { exists, readJson } from "./fs-utils.js";
export const CONFIG_FILE = "okfgen.config.json";
const LEGACY_CONFIG_FILE = "repo-okf.config.json";
export async function loadRepoOkfConfig(repoPath) {
    for (const fileName of [CONFIG_FILE, LEGACY_CONFIG_FILE]) {
        const target = path.join(repoPath, fileName);
        if (await exists(target)) {
            const config = await readJson(target);
            return config ?? {};
        }
    }
    return {};
}
export async function writeDefaultConfig(repoPath, force) {
    const target = path.join(repoPath, CONFIG_FILE);
    if ((await exists(target)) && !force) {
        throw new Error(`Config already exists: ${target}. Re-run with --force to replace it.`);
    }
    const config = {
        output: "okf",
        mode: "scan",
        packageScope: "primary",
        cache: true,
        cacheDir: ".okf-cache",
        llm: {
            model: "gpt-4o-mini",
            maxFiles: 160,
            maxBytesPerFile: 7000,
            maxPackageCalls: 12,
            maxPackageFiles: 40,
            maxFilesPerRollupChunk: 40,
        },
        include: ["README*", "docs/**", "src/**", "packages/**", ".github/workflows/**"],
        exclude: ["node_modules/**", "dist/**", "build/**", "coverage/**"],
    };
    await fs.writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    return target;
}
//# sourceMappingURL=config.js.map