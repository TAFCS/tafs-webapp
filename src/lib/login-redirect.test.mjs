// TAFSD-531: `npm run test:unit` (Node built-in runner, which strips the types of the .ts it imports).
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "./login-redirect.ts";

const ORIGIN = "https://tafs-webapp.vercel.app";

test("keeps a same-site path with its query and hash", () => {
    assert.equal(safeRedirectPath("/mcp/authorize?ticket=a.b.c", ORIGIN), "/mcp/authorize?ticket=a.b.c");
    assert.equal(safeRedirectPath("/home", ORIGIN), "/home");
    assert.equal(safeRedirectPath("/students?q=ali#top", ORIGIN), "/students?q=ali#top");
});

test("refuses everything that leaves the site", () => {
    for (const raw of [
        "//evil.com",
        "/\\evil.com",
        "/\\/evil.com",
        "/\t/evil.com", // what ?redirect=/%09/evil.com decodes to
        "/\n/evil.com",
        "/ /evil.com".replace(" ", "\r"),
        "https://evil.com",
        "javascript:alert(1)",
        "evil.com",
        "",
    ]) {
        assert.equal(safeRedirectPath(raw, ORIGIN), null, JSON.stringify(raw));
    }
    assert.equal(safeRedirectPath(null, ORIGIN), null);
    assert.equal(safeRedirectPath(undefined, ORIGIN), null);
});

test("decoded the way searchParams.get decodes it", () => {
    const params = new URLSearchParams("redirect=%2F%09%2Fevil.com");
    assert.equal(safeRedirectPath(params.get("redirect"), ORIGIN), null);
    const tab = new URLSearchParams("redirect=/%5Cevil.com");
    assert.equal(safeRedirectPath(tab.get("redirect"), ORIGIN), null);
});
