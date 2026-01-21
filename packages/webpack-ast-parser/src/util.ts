import { isIdentifier, type LeftHandSideExpression, type MemberName } from "typescript";

import { Position } from "@vencord-companion/shared/Position";
import { Range } from "@vencord-companion/shared/Range";

import type { AnyExportKey, ExportMap } from "./types";
import { WebpackAstParser } from "./WebpackAstParser";

export function allEntries<T extends object, K extends keyof T & (string | symbol)>(obj: T): (readonly [K, T[K]])[] {
    const SYM_NON_ENUMERABLE = Symbol("non-enumerable");
    const keys: (string | symbol)[] = Object.getOwnPropertyNames(obj);

    keys.push(...Object.getOwnPropertySymbols(obj));

    return keys.map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);

        if (!descriptor)
            throw new Error("Descriptor is undefined");

        if (!descriptor.enumerable)
            return SYM_NON_ENUMERABLE;

        return [key as K, (obj as any)[key] as T[K]] as const;
    })
        .filter((x) => x !== SYM_NON_ENUMERABLE);
}

export function fromEntries<T extends Object>(entries: Iterable<readonly [keyof T, T[keyof T]]>): T {
    return Object.fromEntries(entries) as any;
}

export function allValues<T extends object>(obj: T): (T[keyof T])[] {
    return allEntries(obj)
        .map(([, v]) => v);
}

export function allKeys<T extends object>(obj: T): (keyof T)[] {
    return allEntries(obj)
        .map(([k]) => k);
}

type ExportEntry<T> = ExportMap<T> | T[];

export function flattenFilteredExportMap(map: ExportMap<Range>, prefix: AnyExportKey[] = []): AnyExportKey[][] {
    return allEntries(map).flatMap(([k, v]) => {
        if (k === WebpackAstParser.SYM_HOVER) {
            return [];
        }

        // typescript is stupid and discords custom symbol types over array spread
        const currentPath: AnyExportKey[] = [...prefix, k];

        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            return flattenFilteredExportMap(v, currentPath);
        }
        return [currentPath];
    });
}

export function makeFilteredExportMap(map: ExportEntry<Range>, pos: Position): ExportEntry<Range> | null {
    if (Array.isArray(map)) {
        if (map.some((r) => r.contains(pos))) {
            return map;
        }
        return null;
    }

    const entries = allEntries(map).map(([k, v]) => {
        if (k === WebpackAstParser.SYM_HOVER) {
            return [k, v as ExportMap<Range>[typeof WebpackAstParser.SYM_HOVER]] as const;
        }

        assertNotHover(v);

        const filtered = makeFilteredExportMap(v, pos);

        if (!filtered) {
            return null;
        }

        return [k, filtered] as const;
    })
        .filter((v) => v !== null);

    return entries.length ? Object.fromEntries(entries) : null;
}

/**
 * @deprecated
 */
export function containsPosition(range: ExportMap<Range> | Range[], pos: Position): boolean {
    if (Array.isArray(range)) {
        return range.some((r) => r.contains(pos));
    }

    return allValues(range)
        .filter((r) => typeof r !== "string" && r != null)
        .some((r) => containsPosition(r, pos));
}

/**
 * @param text the module text
 * @returns if the module text is a webpack module or an extracted find
 */
export function isWebpackModule(text: string) {
    return text.startsWith("// Webpack Module ")
      || text.substring(0, 100)
          .includes("//OPEN FULL MODULE:");
}

/**
 * **does not** format the modules code see {@link format} for more code formating

 * takes the raw contents of a module and prepends a header
 * @param moduleContents the module
 * @param moduleId the module id
 * @param isFind if the module is coming from a find
    eg: is it a partial module
 * @returns a string with the formatted module
 */

export function formatModule(moduleContents: string, moduleId: string | number | undefined = "000000", isFind?: boolean): string {
    if (isWebpackModule(moduleContents)) {
        return moduleContents;
    }
    return `// Webpack Module ${moduleId} \n${isFind ? `//OPEN FULL MODULE: ${moduleId}\n` : ""}//EXTRACED WEPBACK MODULE ${moduleId}\n 0,\n${moduleContents}`;
}

export function TAssert<T>(thing: any): asserts thing is T {
}

export function assertNotHover<T>(thing: ExportMap<T>[keyof ExportMap<T>]):
    asserts thing is Exclude<ExportMap<T>[keyof ExportMap<T>], ExportMap<T>[typeof WebpackAstParser.SYM_HOVER]> {

}

export function matchExportChain(
    usageChain: readonly [LeftHandSideExpression, ...MemberName[]] | undefined | null,
    exportChain: AnyExportKey[],
): MemberName | false {
    // error || trying to match a.b.c.d against something like a.b
    // we have to add 1 to account for the identifier for the module itself
    if (!usageChain || exportChain.length + 1 > usageChain.length) {
        return false;
    }

    let cur: MemberName | undefined;

    for (let i = 0; i < exportChain.length; i++) {
        cur = usageChain[i + 1] as MemberName; // +1 to skip the module identifier

        if (!isIdentifier(cur) || cur.text !== exportChain[i]) {
            return false;
        }
    }

    return cur ?? false;
}
