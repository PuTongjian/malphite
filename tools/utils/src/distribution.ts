import { PackageList, type PackageName } from "./pnpm";

export const PackageToDistribution = new Map<
  PackageName,
  BUILD_CONFIG_TYPE["distribution"]
>([["@mlphite/web", "web"]]);

export const AliasToPackage = new Map<string, PackageName>([
  ["web", "@mlphite/web"],
  ...PackageList.map(
    (pkg) => [pkg.name.split("/").pop()!, pkg.name] as [string, PackageName],
  ),
]);
