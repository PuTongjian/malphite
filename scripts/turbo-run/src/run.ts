import { getPackages } from "@malphite/node-utils";
import { select, isCancel, cancel } from "@clack/prompts";
import { execaCommand } from "execa";

interface RunOptions {
  command?: string;
}

export async function run(options: RunOptions) {
  const { command } = options;
  if (!command) {
    console.error("Please enter the command to run");
    process.exit(1);
  }

  const { packages } = await getPackages();

  // filter packages that have the command in their package.json scripts
  const selectPackages = packages.filter(item => {
    return (item.packageJson as Record<string, any>)?.scripts?.[command];
  });

  let selectPackage: string | symbol;
  if (selectPackages.length > 0) {
    selectPackage = await select({
      message: `Select the app you want to run "${command}":`,
      options: selectPackages.map(item => ({
        label: item?.packageJson.name,
        value: item?.packageJson.name
      }))
    });

    if (isCancel(selectPackage) || !selectPackage) {
      cancel("👋 Has cancelled");
      process.exit(0);
    }
  } else {
    console.error(`No packages found with command "${command}"`);
    process.exit(1);
  }

  execaCommand(`pnpm --filter=${selectPackage} run ${command}`, {
    stdio: "inherit",
  });

}
