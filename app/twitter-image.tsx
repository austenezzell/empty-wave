/**
 * Twitter shares the same generated poster as OpenGraph.
 *
 * `dynamic` is declared here rather than re-exported: Next parses these route
 * config fields statically and rejects a re-export.
 */

export { default, alt, size, contentType } from "./opengraph-image";

export const dynamic = "force-dynamic";
