import type { ConstructorDeclaration, FunctionLikeDeclaration, Identifier, Node, PropertyAssignment } from "typescript";

import { type IRange, Range } from "@vencord-companion/shared/Range";

import { WebpackAstParser } from "./WebpackAstParser";

export type ExportMap<T> = {
    [WebpackAstParser.SYM_CJS_DEFAULT]?: T[] | ExportMap<T>;
    [WebpackAstParser.SYM_HOVER]?: string;
    [exportedName: string]: T[] | ExportMap<T>;
};

export type RawExportRange = Node[];

export type RawExportMap = ExportMap<Node>;

export type AnyExportKey = string | typeof WebpackAstParser.SYM_CJS_DEFAULT;

export type ExportRange = Range[];

// ranges of code that will count as references to this export
/**
 * the name of the export => array of ranges where it is defined, with the last one being the most specific
 */
export type RangeExportMap = ExportMap<Range>;

/**
 * {@link RangeExportMap}, but only has the first level of exports, and they are stored as nodes(most of the time)
 */
export type OLD_RawExportMap<T> = {
    [exposedName: string | symbol]: T;
};

export interface ModuleDep {
    /**
     * the modules that require this module synchronously
     */
    syncUses: string[];
    /**
     * the modules that require this module lazily
     */
    lazyUses: string[];
}

export interface IModuleDepManager {
    getModDeps(moduleId: string): ModuleDep;
}

export interface IModuleCache {
    getModuleFilepath(id: string): string | undefined;
    /**
     * throw if not found
     * 
     * @param requestor the parser that started this request
     * @param id the module id to get the parser for
     * @param latest if true, perfer a newer version over one that matches the same build as the current module
     */
    getModuleParser(requestor: WebpackAstParser, id: string, latest?: boolean): Promise<WebpackAstParser>;
}

/**
 * not to be confused with {@link ModuleDep}
 */
export interface ModuleDeps {
    lazy: string[];
    sync: string[];
}

export type Location = {
    locationType: "file_path";
    filePath: string;
    moduleId: string;
} | {
    locationType: "inline";
    content: string;
    moduleId: string;
};

export type MainDeps = Record<string, ModuleDep>;

export type Definition = Location & {
    range: IRange;
};

export type Reference = Location & {
    range: IRange;
};

export interface Store {
    fluxEvents: {
        [name: string]: Node[];
    };
    /**
     * the store itself
     * starts with the foo from `new foo(a, {b})`
     * 
     * then has the class name itself (most likely foo again)
     * 
     * ends with the constructor/initialize function (if any)
     */
    store: (Identifier | ConstructorDeclaration)[];
    methods: {
        [name: string]: FunctionLikeDeclaration;
    };
    props: {
        [name: string]: PropertyAssignment["initializer"];
    };
    [WebpackAstParser.SYM_HOVER]: string | undefined;
}
