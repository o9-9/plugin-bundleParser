import {
    type Expression,
    isArrayLiteralExpression,
    isBigIntLiteral,
    isBinaryExpression,
    isNumericLiteral,
    isObjectLiteralExpression,
    isPropertyAssignment,
    isStringLiteralLike,
    type LiteralToken,
    type ObjectLiteralExpression,
    SyntaxKind,
} from "typescript";

import { AstParser } from "@vencord-companion/ast-parser/AstParser";
import { isLiteralish } from "@vencord-companion/ast-parser/util";
import { Cache, CacheGetter } from "@vencord-companion/shared/decorators";

import type { EnvBuildVars, JsonType, MaybeLiteralJsonType, NonLiteral } from "./types";

export class GlobalEnvParser extends AstParser {
    static readonly SYM_UNSERIALIZABLE = Symbol("GlobalEnvParser.unserializable");
    static readonly SYM_UNREADABLE_KEYS = Symbol("GlobalEnvParser.unreadableKeys");

    public static isLiteral(value: MaybeLiteralJsonType): value is Exclude<JsonType, NonLiteral> {
        if (value === null || typeof value !== "object") {
            return true;
        }
        return !(GlobalEnvParser.SYM_UNSERIALIZABLE in value);
    }

    public static isObject(value: MaybeLiteralJsonType): value is { [key: string]: MaybeLiteralJsonType; } {
        if (!GlobalEnvParser.isLiteral(value)) {
            return false;
        }
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    public static isSingleValue(value: MaybeLiteralJsonType): value is string | number | boolean | null {
        if (!GlobalEnvParser.isLiteral(value)) {
            return false;
        }
        if (Array.isArray(value)) {
            return false;
        }
        if (typeof value === "object" && value !== null) {
            return false;
        }
        return true;
    }

    @CacheGetter()
    public get buildId(): string | undefined {
        const { SENTRY_TAGS } = this.getGlobalEnvObject() ?? {} as EnvBuildVars;

        if (typeof SENTRY_TAGS !== "object" || !GlobalEnvParser.isObject(SENTRY_TAGS)) {
            return;
        }

        const maybeBuildId = SENTRY_TAGS?.buildId;

        if (typeof maybeBuildId !== "string") {
            return;
        }
        return maybeBuildId;
    }

    @Cache()
    public getGlobalEnvObject(): EnvBuildVars | undefined {
        if (!this.text.includes("window.GLOBAL_ENV")) {
            return undefined;
        }

        const expr = this.sourceFile.getChildAt(0)?.getChildAt(0)
            ?.getChildAt(0);

        if (
            !isBinaryExpression(expr)
            || expr.operatorToken.kind !== SyntaxKind.EqualsToken
            || !isObjectLiteralExpression(expr.right)
        ) {
            return;
        }

        return this.parseObjectLiteral(expr.right);
    }

    private parseLiteral(node: LiteralToken) {
        if (isStringLiteralLike(node) || isBigIntLiteral(node)) {
            return node.text;
        } else if (isNumericLiteral(node)) {
            return Number(node.text);
        }
        throw new Error("weird unsupported literal token in globalEnv");
    }

    private parseValue(node: Expression): [JsonType, string[]] {
        if (isLiteralish(node)) {
            return [this.parseLiteral(node), []];
        } else if (isObjectLiteralExpression(node)) {
            const parsed: Omit<EnvBuildVars, typeof GlobalEnvParser.SYM_UNREADABLE_KEYS>
                = this.parseObjectLiteral(node);

            const keys = [...(parsed as any)[GlobalEnvParser.SYM_UNREADABLE_KEYS]];

            delete (parsed as any)[GlobalEnvParser.SYM_UNREADABLE_KEYS];

            return [parsed, keys];
        } else if (isArrayLiteralExpression(node)) {
            const parsed = node
                .elements
                .map(this.parseValue.bind(this))
                .reduce((acc, [jsonValue, badKeys]) => {
                    // @ts-expect-error loses the [] from JsonType[] for some reason
                    acc[0].push(jsonValue);
                    acc[1].push(...badKeys);
                    return acc;
                }, [[], []] as [JsonType[], string[]]);

            return parsed;
        }
        return [
            {
                [GlobalEnvParser.SYM_UNSERIALIZABLE]: true,
                expression: node.getText(),
            },
            [],
        ];
    }

    private parseObjectLiteral(expr: ObjectLiteralExpression): EnvBuildVars {
        const ret: EnvBuildVars = { [GlobalEnvParser.SYM_UNREADABLE_KEYS]: [] };

        for (const prop of expr.properties) {
            if (!prop.name || !isStringLiteralLike(prop.name) || !isPropertyAssignment(prop)) {
                ret[GlobalEnvParser.SYM_UNREADABLE_KEYS].push(prop.name?.getText() ?? "<unknown>");
                continue;
            }

            const [value, badkeys] = this.parseValue(prop.initializer);

            ret[prop.name.text] = value;
            ret[GlobalEnvParser.SYM_UNREADABLE_KEYS].push(...badkeys);
        }
        return ret;
    }
}
