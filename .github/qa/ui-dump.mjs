/** Read the flat nodes emitted by Android's `uiautomator dump`. No app mocks. */
export function findControl(xml, testId, viewport) {
    for (const match of xml.matchAll(/<node\s+([^>]+)>/g)) {
        const attributes = Object.fromEntries(
            [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)]
                .map(([, key, value]) => [key, value]),
        );
        const resourceId = attributes["resource-id"] ?? "";
        if (resourceId !== testId && !resourceId.endsWith(`:id/${testId}`)) {
            continue;
        }
        if (attributes.enabled === "false" || attributes["visible-to-user"] === "false") {
            continue;
        }
        const bounds = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(attributes.bounds ?? "");
        if (!bounds) {
            continue;
        }
        const [left, top, right, bottom] = bounds.slice(1).map(Number);
        // A destination may stay mounted off-screen during native navigation.
        // Only accept a target whose actual tap center is within the display.
        const x = Math.floor((left + right) / 2);
        const y = Math.floor((top + bottom) / 2);
        if (right > left && bottom > top && x >= 0 && y >= 0 &&
            x < viewport.width && y < viewport.height) {
            return { x, y, text: attributes.text ?? "", attributes };
        }
    }
    return null;
}
