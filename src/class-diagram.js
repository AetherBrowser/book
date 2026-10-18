// Draws class_diagram.xmi on the architecture page.
// Same reading as the standalone demo: packages, associations, realizations,
// dependencies, then an orthogonal ELK layout.
(() => {
    const root = document.querySelector(".class-diagram");
    if (!root) return;

    const status = root.querySelector(".class-diagram-status");
    const canvas = root.querySelector(".class-diagram-canvas");
    const packageSelect = root.querySelector("#class-diagram-package");
    const drawButton = root.querySelector("#class-diagram-draw");
    const measureCanvas = document.createElement("canvas").getContext("2d");

    let elk = null;
    let model = null;
    let rendering = false;
    let scale = 1;
    let naturalSize = { width: 0, height: 0 };

    const FLAT_LAYOUT = {
        "elk.algorithm": "layered",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.direction": "DOWN",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.unnecessaryBendpoints": "true",
        "elk.spacing.nodeNode": "36",
        "elk.layered.spacing.nodeNodeBetweenLayers": "48",
        "elk.spacing.edgeNode": "18",
        "elk.spacing.edgeEdge": "12",
        "elk.padding.top": "4",
        "elk.padding.left": "4",
        "elk.padding.bottom": "4",
        "elk.padding.right": "4",
    };

    function setStatus(text) {
        status.textContent = text;
    }

    function textWidth(text, font) {
        measureCanvas.font = font;
        return Math.ceil(measureCanvas.measureText(text).width);
    }

    function clip(text, max) {
        if (text.length <= max) return text;
        return text.slice(0, max - 1) + "…";
    }

    function multiplicity(lower, upper) {
        const lo = lower || "1";
        const hi = upper || "1";
        if (lo === hi) return lo;
        return `${lo}..${hi}`;
    }

    function visibility(value) {
        if (value === "public") return "+";
        if (value === "private") return "-";
        if (value === "protected") return "#";
        return "~";
    }

    function typeName(id) {
        if (!id) return "";
        return model.byId.get(id)?.name || id;
    }

    function parseXmi(xmlText) {
        const doc = new DOMParser().parseFromString(xmlText, "application/xml");
        const failure = doc.querySelector("parsererror");
        if (failure) throw new Error("Unreadable XMI");
        const byId = new Map();
        const associations = [];
        const dependencies = [];
        const packages = new Set();

        function commentOf(el) {
            const comment = [...el.children].find((child) => child.localName === "ownedComment");
            return comment?.querySelector("body")?.textContent || "";
        }

        function bounds(end) {
            const lower = [...end.children].find((child) => child.localName === "lowerValue");
            const upper = [...end.children].find((child) => child.localName === "upperValue");
            return [lower?.getAttribute("value") || "1", upper?.getAttribute("value") || "1"];
        }

        function walk(el, path) {
            for (const child of el.children) {
                if (child.localName !== "packagedElement") continue;
                const kind = child.getAttribute("xmi:type");
                const name = child.getAttribute("name") || "";
                const id = child.getAttribute("xmi:id");
                if (kind === "uml:Package") {
                    walk(child, path.concat(name));
                    continue;
                }
                if (kind === "uml:Association") {
                    const ends = [...child.children].filter((node) => node.localName === "ownedEnd");
                    const named = ends.find((end) => end.getAttribute("name"));
                    const other = ends.find((end) => end !== named) || ends[0];
                    if (!named || !other) continue;
                    const [partLo, partHi] = bounds(named);
                    const [ownerLo, ownerHi] = bounds(other);
                    associations.push({
                        name,
                        owner: other.getAttribute("type"),
                        part: named.getAttribute("type"),
                        aggregation: named.getAttribute("aggregation") || "none",
                        ownerLo, ownerHi, partLo, partHi,
                    });
                    continue;
                }
                if (kind === "uml:Dependency") {
                    dependencies.push({
                        name,
                        client: child.getAttribute("client"),
                        supplier: child.getAttribute("supplier"),
                    });
                    continue;
                }
                if (!["uml:Class", "uml:Interface", "uml:Enumeration", "uml:DataType"].includes(kind)) continue;
                const note = commentOf(child);
                const element = {
                    id,
                    name,
                    path,
                    kind: kind === "uml:Interface" ? "interface" : kind === "uml:Enumeration" ? "enum" : kind === "uml:DataType" ? "datatype" : "class",
                    utility: note.startsWith("Rust module of free functions."),
                    attrs: [],
                    ops: [],
                    literals: [],
                    realizes: [],
                };
                for (const node of child.children) {
                    if (node.localName === "ownedAttribute") {
                        element.attrs.push({
                            name: node.getAttribute("name") || "",
                            type: node.getAttribute("type") || "",
                            vis: node.getAttribute("visibility") || "private",
                        });
                    } else if (node.localName === "ownedLiteral") {
                        element.literals.push(node.getAttribute("name") || "");
                    } else if (node.localName === "interfaceRealization") {
                        element.realizes.push(node.getAttribute("supplier"));
                    } else if (node.localName === "ownedOperation") {
                        const params = [];
                        let ret = "";
                        for (const param of node.children) {
                            if (param.localName !== "ownedParameter") continue;
                            if (param.getAttribute("direction") === "return") ret = param.getAttribute("type") || "";
                            else params.push({ name: param.getAttribute("name") || "", type: param.getAttribute("type") || "" });
                        }
                        element.ops.push({
                            name: node.getAttribute("name") || "",
                            vis: node.getAttribute("visibility") || "public",
                            params,
                            ret,
                        });
                    }
                }
                byId.set(id, element);
                packages.add(path.join("/"));
            }
        }

        const umlModel = [...doc.documentElement.children].find((el) => el.localName === "Model");
        walk(umlModel, []);
        return { byId, associations, dependencies, packages };
    }

    function selectedOptions() {
        return {
            packagePath: packageSelect.value,
            neighbors: root.querySelector("#class-diagram-neighbors").checked,
            members: root.querySelector("#class-diagram-members").checked,
            deps: root.querySelector("#class-diagram-deps").checked,
            external: root.querySelector("#class-diagram-external").checked,
            rustTypes: root.querySelector("#class-diagram-rust-types").checked,
        };
    }

    function allowed(element, options) {
        const packageRoot = element.path[0] || "";
        if (packageRoot === "types_rust" && !options.rustTypes) return false;
        if (packageRoot === "external" && !options.external) return false;
        return true;
    }

    function inPackage(element, packagePath) {
        if (packagePath === "*") return true;
        const path = element.path.join("/");
        return path === packagePath || path.startsWith(packagePath + "/");
    }

    function visibleIds(options) {
        const seed = new Set();
        for (const element of model.byId.values()) {
            if (allowed(element, options) && inPackage(element, options.packagePath)) seed.add(element.id);
        }
        if (!options.neighbors) return seed;
        const ids = new Set(seed);
        const pull = (left, right) => {
            if (!left || !right) return;
            if (seed.has(left) && model.byId.has(right) && allowed(model.byId.get(right), options)) ids.add(right);
            if (seed.has(right) && model.byId.has(left) && allowed(model.byId.get(left), options)) ids.add(left);
        };
        for (const link of model.associations) pull(link.owner, link.part);
        for (const element of model.byId.values()) {
            for (const supplier of element.realizes) pull(element.id, supplier);
        }
        if (options.deps) {
            for (const link of model.dependencies) pull(link.client, link.supplier);
        }
        return ids;
    }

    const NAME_FONT = "600 14px ui-sans-serif, 'Segoe UI', 'Liberation Sans', sans-serif";
    const STEREO_FONT = "italic 11px ui-sans-serif, 'Segoe UI', 'Liberation Sans', sans-serif";
    const BODY_FONT = "12px ui-sans-serif, 'Segoe UI', 'Liberation Sans', sans-serif";
    const LABEL_FONT = "11px ui-sans-serif, 'Segoe UI', 'Liberation Sans', sans-serif";

    function stereotypeOf(element) {
        if (element.utility) return "«utility»";
        if (element.kind === "interface") return "«interface»";
        if (element.kind === "enum") return "«enumeration»";
        if (element.kind === "datatype") return "«datatype»";
        return "";
    }

    function memberLines(element, options) {
        const lines = [];
        if (element.kind === "enum") {
            for (const literal of element.literals) lines.push(clip(literal, 56));
        }
        if (!options.members) return lines;
        for (const attr of element.attrs) {
            const typed = attr.type ? `: ${typeName(attr.type)}` : "";
            lines.push(clip(`${visibility(attr.vis)} ${attr.name}${typed}`, 56));
        }
        for (const op of element.ops) {
            const params = op.params.map((param) => `${param.name}: ${typeName(param.type)}`).join(", ");
            const ret = op.ret ? `: ${typeName(op.ret)}` : "";
            lines.push(clip(`${visibility(op.vis)} ${op.name}(${params})${ret}`, 56));
        }
        return lines;
    }

    function measureElement(element, options) {
        const stereo = stereotypeOf(element);
        const lines = memberLines(element, options);
        let width = Math.max(textWidth(element.name, NAME_FONT), stereo ? textWidth(stereo, STEREO_FONT) : 0);
        for (const line of lines) width = Math.max(width, textWidth(line, BODY_FONT));
        width = Math.max(150, width + 28);
        const header = (stereo ? 16 : 0) + 26;
        const height = lines.length ? header + 8 + lines.length * 17 + 8 : header + 6;
        return { width, height, header, lines, stereo };
    }

    function collectLinks(ids, options) {
        const links = [];
        for (const link of model.associations) {
            if (!ids.has(link.owner) || !ids.has(link.part) || link.owner === link.part) continue;
            links.push({
                source: link.owner,
                target: link.part,
                kind: link.aggregation === "composite" ? "composite" : link.aggregation === "shared" ? "shared" : "association",
                label: link.name || "",
                sourceMult: multiplicity(link.ownerLo, link.ownerHi),
                targetMult: multiplicity(link.partLo, link.partHi),
            });
        }
        for (const element of model.byId.values()) {
            if (!ids.has(element.id)) continue;
            for (const supplier of element.realizes) {
                if (!ids.has(supplier) || supplier === element.id) continue;
                links.push({ source: element.id, target: supplier, kind: "realization", label: "", sourceMult: "", targetMult: "" });
            }
        }
        if (options.deps) {
            for (const link of model.dependencies) {
                if (!ids.has(link.client) || !ids.has(link.supplier) || link.client === link.supplier) continue;
                links.push({
                    source: link.client,
                    target: link.supplier,
                    kind: "dependency",
                    label: clip(link.name || "", 36),
                    sourceMult: "",
                    targetMult: "",
                });
            }
        }
        return links;
    }

    function packageKey(element) {
        return element.path.join("/") || "(root)";
    }

    async function layoutPackages(ids, options) {
        const links = collectLinks(ids, options);
        const groups = new Map();
        const metrics = new Map();
        for (const id of ids) {
            const element = model.byId.get(id);
            const key = packageKey(element);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(element);
            metrics.set(id, measureElement(element, options));
        }
        for (const [key, list] of groups) {
            const seen = new Set();
            groups.set(key, list.filter((element) => {
                if (seen.has(element.id)) return false;
                seen.add(element.id);
                return true;
            }));
        }

        const packages = [];
        for (const key of [...groups.keys()].sort((a, b) => a.localeCompare(b, "en"))) {
            const elements = groups.get(key);
            const memberIds = new Set(elements.map((element) => element.id));
            const internal = links.filter((link) => memberIds.has(link.source) && memberIds.has(link.target));
            const graph = {
                id: key,
                layoutOptions: FLAT_LAYOUT,
                children: elements.map((element) => {
                    const size = metrics.get(element.id);
                    return { id: element.id, width: size.width, height: size.height };
                }),
                edges: internal.map((link, index) => ({ id: `i${index}`, sources: [link.source], targets: [link.target] })),
            };
            const laid = await elk.layout(graph);
            const edgeById = new Map(internal.map((link, index) => [`i${index}`, link]));
            packages.push({
                key,
                name: key.split("/").pop(),
                laid,
                edgeById,
                width: Math.ceil(laid.width + 36),
                height: Math.ceil(laid.height + 48),
            });
        }

        const gapX = 88;
        const gapY = 76;
        const rowWidth = 1500;
        let cursorX = 20;
        let cursorY = 20;
        let rowHeight = 0;
        let canvasWidth = 0;
        for (const folder of packages) {
            if (cursorX > 20 && cursorX + folder.width > rowWidth) {
                cursorX = 20;
                cursorY += rowHeight + gapY;
                rowHeight = 0;
            }
            folder.x = cursorX;
            folder.y = cursorY;
            cursorX += folder.width + gapX;
            rowHeight = Math.max(rowHeight, folder.height);
            canvasWidth = Math.max(canvasWidth, cursorX);
        }
        const canvasHeight = cursorY + rowHeight + 20;

        const boxes = new Map();
        const contentOffset = { x: 18, y: 32 };
        for (const folder of packages) {
            for (const node of folder.laid.children || []) {
                boxes.set(node.id, {
                    x: folder.x + contentOffset.x + node.x,
                    y: folder.y + contentOffset.y + node.y,
                    w: node.width,
                    h: node.height,
                    packageKey: folder.key,
                });
            }
        }

        const routed = [];
        const pairLane = new Map();
        for (const folder of packages) {
            for (const edge of folder.laid.edges || []) {
                const section = edge.sections?.[0];
                if (!section) continue;
                const link = folder.edgeById.get(edge.id);
                const points = orthogonalPoints([section.startPoint, ...(section.bendPoints || []), section.endPoint]).map((point) => ({
                    x: point.x + folder.x + contentOffset.x,
                    y: point.y + folder.y + contentOffset.y,
                }));
                if (points.length >= 2) routed.push({ points, link });
            }
        }
        for (const link of links) {
            const source = boxes.get(link.source);
            const target = boxes.get(link.target);
            if (!source || !target || source.packageKey === target.packageKey) continue;
            const sourceFolder = packages.find((folder) => folder.key === source.packageKey);
            const targetFolder = packages.find((folder) => folder.key === target.packageKey);
            const pair = [source.packageKey, target.packageKey].sort().join(">");
            const lane = pairLane.get(pair) || 0;
            pairLane.set(pair, lane + 1);
            routed.push({
                points: routeExternal(source, sourceFolder, target, targetFolder, lane),
                link,
            });
        }
        return { packages, boxes, metrics, routed, canvasWidth, canvasHeight };
    }

    function orthogonalPoints(raw) {
        const points = [];
        for (const point of raw.filter(Boolean)) {
            const next = { x: Math.round(point.x), y: Math.round(point.y) };
            const prev = points[points.length - 1];
            if (!prev) {
                points.push(next);
                continue;
            }
            if (prev.x !== next.x && prev.y !== next.y) points.push({ x: next.x, y: prev.y });
            const last = points[points.length - 1];
            if (last.x === next.x && last.y === next.y) continue;
            if (points.length >= 2) {
                const before = points[points.length - 2];
                if ((before.x === last.x && last.x === next.x) || (before.y === last.y && last.y === next.y)) {
                    points[points.length - 1] = next;
                    continue;
                }
            }
            points.push(next);
        }
        return points;
    }

    function sidePoint(box, side, fraction) {
        const t = Math.min(0.85, Math.max(0.15, fraction));
        if (side === "e") return { x: box.x + box.w, y: box.y + box.h * t };
        if (side === "w") return { x: box.x, y: box.y + box.h * t };
        if (side === "s") return { x: box.x + box.w * t, y: box.y + box.h };
        return { x: box.x + box.w * t, y: box.y };
    }

    function routeExternal(source, sourceFolder, target, targetFolder, lane) {
        const sourceCenter = { x: source.x + source.w / 2, y: source.y + source.h / 2 };
        const targetCenter = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
        const dx = targetCenter.x - sourceCenter.x;
        const dy = targetCenter.y - sourceCenter.y;
        const shift = (lane - 1) * 14;
        const fraction = 0.35 + (lane % 5) * 0.1;
        if (Math.abs(dx) >= Math.abs(dy)) {
            const forward = dx >= 0;
            const start = sidePoint(source, forward ? "e" : "w", fraction);
            const end = sidePoint(target, forward ? "w" : "e", fraction);
            let mid = forward
                ? (sourceFolder.x + sourceFolder.width < targetFolder.x
                    ? (sourceFolder.x + sourceFolder.width + targetFolder.x) / 2
                    : sourceFolder.x + sourceFolder.width + 30)
                : (targetFolder.x + targetFolder.width < sourceFolder.x
                    ? (targetFolder.x + targetFolder.width + sourceFolder.x) / 2
                    : sourceFolder.x - 30);
            mid += shift;
            return orthogonalPoints([start, { x: mid, y: start.y }, { x: mid, y: end.y }, end]);
        }
        const forward = dy >= 0;
        const start = sidePoint(source, forward ? "s" : "n", fraction);
        const end = sidePoint(target, forward ? "n" : "s", fraction);
        let mid = forward
            ? (sourceFolder.y + sourceFolder.height < targetFolder.y
                ? (sourceFolder.y + sourceFolder.height + targetFolder.y) / 2
                : sourceFolder.y + sourceFolder.height + 30)
            : (targetFolder.y + targetFolder.height < sourceFolder.y
                ? (targetFolder.y + targetFolder.height + sourceFolder.y) / 2
                : sourceFolder.y - 30);
        mid += shift;
        return orthogonalPoints([start, { x: start.x, y: mid }, { x: end.x, y: mid }, end]);
    }

    function svgEl(name, attrs, text) {
        const el = document.createElementNS("http://www.w3.org/2000/svg", name);
        for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
        if (text !== undefined) el.textContent = text;
        return el;
    }

    function unitVector(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy) || 1;
        return { x: dx / length, y: dy / length };
    }

    function outgoing(points) {
        for (let index = 1; index < points.length; index++) {
            if (Math.hypot(points[index].x - points[0].x, points[index].y - points[0].y) > 6) {
                return unitVector(points[0], points[index]);
            }
        }
        return { x: 0, y: 1 };
    }

    function incoming(points) {
        const last = points.length - 1;
        for (let index = last - 1; index >= 0; index--) {
            if (Math.hypot(points[last].x - points[index].x, points[last].y - points[index].y) > 6) {
                return unitVector(points[index], points[last]);
            }
        }
        return { x: 0, y: 1 };
    }

    function diamondPoints(tip, direction) {
        const length = 16;
        const width = 6;
        const far = { x: tip.x + direction.x * length, y: tip.y + direction.y * length };
        const mid = { x: tip.x + direction.x * length / 2, y: tip.y + direction.y * length / 2 };
        const left = { x: mid.x - direction.y * width, y: mid.y + direction.x * width };
        const right = { x: mid.x + direction.y * width, y: mid.y - direction.x * width };
        return { far, points: [tip, left, far, right] };
    }

    function arrowPoints(tip, direction, open) {
        const length = open ? 11 : 13;
        const width = 5.5;
        const base = { x: tip.x - direction.x * length, y: tip.y - direction.y * length };
        const left = { x: base.x - direction.y * width, y: base.y + direction.x * width };
        const right = { x: base.x + direction.y * width, y: base.y - direction.x * width };
        return { base, left, right, tip };
    }

    function drawLabel(svg, points, text) {
        if (!text || points.length < 2) return;
        let best = 0;
        let segment = [points[0], points[1]];
        for (let index = 0; index < points.length - 1; index++) {
            const length = Math.hypot(points[index + 1].x - points[index].x, points[index + 1].y - points[index].y);
            if (length > best) {
                best = length;
                segment = [points[index], points[index + 1]];
            }
        }
        const x = (segment[0].x + segment[1].x) / 2;
        const y = (segment[0].y + segment[1].y) / 2;
        const width = textWidth(text, LABEL_FONT) + 8;
        svg.append(svgEl("rect", {
            x: x - width / 2, y: y - 12, width, height: 15, fill: "var(--cd-label-bg)",
        }));
        svg.append(svgEl("text", {
            x, y: y - 1, "text-anchor": "middle", "font-size": 11, fill: "var(--cd-muted)",
        }, text));
    }

    function drawScene(scene) {
        const { packages, boxes, metrics, routed, canvasWidth, canvasHeight } = scene;
        naturalSize = { width: canvasWidth, height: canvasHeight };
        const svg = svgEl("svg", {
            viewBox: `0 0 ${canvasWidth} ${canvasHeight}`,
            width: Math.ceil(canvasWidth * scale),
            height: Math.ceil(canvasHeight * scale),
            role: "img",
            "aria-label": "UML class diagram",
        });
        svg.setAttribute("font-family", "ui-sans-serif, 'Segoe UI', 'Liberation Sans', sans-serif");
        svg.append(svgEl("rect", { x: 0, y: 0, width: canvasWidth, height: canvasHeight, fill: "var(--cd-paper)" }));

        for (const folder of packages) {
            const tab = Math.min(folder.width - 12, textWidth(folder.name, LABEL_FONT) + 20);
            const path = [
                `M${folder.x},${folder.y + 18}`,
                `L${folder.x},${folder.y + folder.height}`,
                `L${folder.x + folder.width},${folder.y + folder.height}`,
                `L${folder.x + folder.width},${folder.y + 18}`,
                `L${folder.x + tab},${folder.y + 18}`,
                `L${folder.x + tab},${folder.y}`,
                `L${folder.x},${folder.y} Z`,
            ].join(" ");
            svg.append(svgEl("path", { d: path, fill: "var(--cd-folder)", stroke: "var(--cd-folder-stroke)" }));
            svg.append(svgEl("text", { x: folder.x + 8, y: folder.y + 13, "font-size": 11, fill: "var(--cd-muted)" }, folder.name));
        }

        const prepared = [];
        for (const route of routed) {
            let points = route.points.slice();
            const kind = route.link.kind;
            let marker = null;
            if (kind === "composite" || kind === "shared") {
                const shape = diamondPoints(points[0], outgoing(points));
                points = [shape.far, ...points.slice(1)];
                marker = { type: "diamond", filled: kind === "composite", points: shape.points };
            }
            if (kind === "realization" || kind === "dependency") {
                const shape = arrowPoints(points[points.length - 1], incoming(points), kind === "dependency");
                points = [...points.slice(0, -1), shape.base];
                marker = { ...(marker || {}), arrow: shape, open: kind === "dependency" };
            }
            prepared.push({ points: orthogonalPoints(points), link: route.link, marker });
        }

        const edgeGroups = [];
        for (const item of prepared) {
            const edge = svgEl("g", { class: "edge" });
            edge.dataset.source = item.link.source;
            edge.dataset.target = item.link.target;
            const pts = item.points.map((point) => `${point.x},${point.y}`).join(" ");
            edge.append(svgEl("polyline", {
                points: pts, fill: "none", stroke: "transparent", "stroke-width": 14, "pointer-events": "stroke",
            }));
            edge.append(svgEl("polyline", {
                class: "wire",
                points: pts,
                fill: "none",
                stroke: "var(--cd-edge)",
                "stroke-width": 1.15,
                "stroke-linejoin": "miter",
                "pointer-events": "none",
                "stroke-dasharray": item.link.kind === "dependency" ? "2 3" : item.link.kind === "realization" ? "7 4" : "none",
            }));
            edgeGroups.push({ edge, item });
            svg.append(edge);
        }

        for (const [id, box] of boxes) {
            const element = model.byId.get(id);
            const measured = metrics.get(id);
            const fill = element.kind === "interface" ? "var(--cd-interface)" : element.kind === "enum" ? "var(--cd-enum)" : element.kind === "datatype" ? "var(--cd-datatype)" : "var(--cd-class)";
            const group = svgEl("g", { class: "node" });
            group.dataset.id = id;
            group.append(svgEl("rect", {
                x: box.x, y: box.y, width: box.w, height: box.h, fill, stroke: "var(--cd-edge)", "stroke-width": 1.2,
            }));
            if (measured.lines.length) {
                group.append(svgEl("line", {
                    x1: box.x, y1: box.y + measured.header, x2: box.x + box.w, y2: box.y + measured.header, stroke: "var(--cd-edge)",
                }));
            }
            let textY = box.y + 16;
            if (measured.stereo) {
                group.append(svgEl("text", {
                    x: box.x + box.w / 2, y: textY, "text-anchor": "middle", "font-size": 11, "font-style": "italic", fill: "var(--cd-muted)",
                }, measured.stereo));
                textY += 16;
            }
            group.append(svgEl("text", {
                x: box.x + box.w / 2, y: textY + 2, "text-anchor": "middle", "font-size": 14, "font-weight": 600, fill: "var(--cd-ink)",
            }, element.name));
            measured.lines.forEach((line, index) => {
                group.append(svgEl("text", {
                    x: box.x + 12, y: box.y + measured.header + 16 + index * 17, "font-size": 12, fill: "var(--cd-ink)",
                }, line));
            });
            svg.append(group);
        }

        for (const { edge, item } of edgeGroups) {
            const marker = item.marker;
            if (marker?.points) {
                edge.append(svgEl("polygon", {
                    class: marker.filled ? "mark filled" : "mark",
                    points: marker.points.map((point) => `${point.x},${point.y}`).join(" "),
                    fill: marker.filled ? "var(--cd-edge)" : "var(--cd-paper)",
                    stroke: "var(--cd-edge)",
                }));
            }
            if (marker?.arrow) {
                const { left, right, tip } = marker.arrow;
                if (marker.open) {
                    edge.append(svgEl("polyline", {
                        class: "mark",
                        points: `${left.x},${left.y} ${tip.x},${tip.y} ${right.x},${right.y}`,
                        fill: "none", stroke: "var(--cd-edge)", "stroke-width": 1.15,
                    }));
                } else {
                    edge.append(svgEl("polygon", {
                        class: "mark",
                        points: `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`,
                        fill: "var(--cd-paper)", stroke: "var(--cd-edge)",
                    }));
                }
            }
            if (item.link.sourceMult && item.link.sourceMult !== "1") {
                const at = item.points[0];
                edge.append(svgEl("text", { x: at.x + 6, y: at.y - 4, "font-size": 11, fill: "var(--cd-muted)" }, item.link.sourceMult));
            }
            if (item.link.targetMult && item.link.targetMult !== "1") {
                const at = item.points[item.points.length - 1];
                edge.append(svgEl("text", { x: at.x + 6, y: at.y - 4, "font-size": 11, fill: "var(--cd-muted)" }, item.link.targetMult));
            }
            drawLabel(edge, item.points, item.link.label);
        }

        function clearHighlight() {
            svg.classList.remove("dim");
            for (const el of svg.querySelectorAll(".hot")) el.classList.remove("hot");
        }

        function focusNode(id) {
            clearHighlight();
            svg.classList.add("dim");
            const touched = new Set([id]);
            for (const { edge } of edgeGroups) {
                if (edge.dataset.source === id || edge.dataset.target === id) {
                    edge.classList.add("hot");
                    touched.add(edge.dataset.source);
                    touched.add(edge.dataset.target);
                }
            }
            for (const node of svg.querySelectorAll(".node")) {
                if (touched.has(node.dataset.id)) node.classList.add("hot");
            }
        }

        function focusEdge(edge) {
            clearHighlight();
            svg.classList.add("dim");
            edge.classList.add("hot");
            for (const node of svg.querySelectorAll(".node")) {
                if (node.dataset.id === edge.dataset.source || node.dataset.id === edge.dataset.target) {
                    node.classList.add("hot");
                }
            }
        }

        for (const node of svg.querySelectorAll(".node")) {
            node.addEventListener("pointerenter", () => focusNode(node.dataset.id));
            node.addEventListener("pointerleave", clearHighlight);
        }
        for (const { edge } of edgeGroups) {
            edge.addEventListener("pointerenter", () => focusEdge(edge));
            edge.addEventListener("pointerleave", clearHighlight);
        }

        canvas.replaceChildren(svg);
    }

    function applyScale() {
        const svg = canvas.querySelector("svg");
        if (!svg || !naturalSize.width) return;
        svg.setAttribute("width", Math.ceil(naturalSize.width * scale));
        svg.setAttribute("height", Math.ceil(naturalSize.height * scale));
    }

    function fillPackages() {
        const previous = packageSelect.value || "*";
        const paths = [...model.packages].filter(Boolean).sort((a, b) => a.localeCompare(b, "en"));
        packageSelect.replaceChildren();
        const whole = document.createElement("option");
        whole.value = "*";
        whole.textContent = "Whole model";
        packageSelect.append(whole);
        for (const path of paths) {
            const option = document.createElement("option");
            option.value = path;
            option.textContent = path;
            packageSelect.append(option);
        }
        packageSelect.value = [...packageSelect.options].some((option) => option.value === previous) ? previous : "*";
    }

    async function renderDiagram() {
        if (!model || !elk || rendering) return;
        rendering = true;
        drawButton.disabled = true;
        const options = selectedOptions();
        const ids = visibleIds(options);
        setStatus(`Laying out ${ids.size} classifiers, one package at a time…`);
        try {
            const scene = await layoutPackages(ids, options);
            drawScene(scene);
            setStatus(`${ids.size} classifiers. Links inside a package stay inside it.`);
        } catch (error) {
            setStatus(`Layout failed: ${error.message || error}`);
        } finally {
            rendering = false;
            drawButton.disabled = false;
        }
    }

    function useXml(xmlText) {
        model = parseXmi(xmlText);
        fillPackages();
        setStatus(`${model.byId.size} classifiers. Drawing…`);
        renderDiagram();
    }

    function loadElk() {
        if (window.ELK) return Promise.resolve();
        const rootPath = typeof path_to_root === "string" ? path_to_root : "";
        const src = new URL(rootPath + "elk.bundled.js", window.location.href).href;
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Could not load ELK"));
            document.head.append(script);
        });
    }

    root.querySelector("#class-diagram-controls").addEventListener("submit", (event) => {
        event.preventDefault();
        renderDiagram();
    });
    root.querySelector("#class-diagram-zoom-out").addEventListener("click", () => {
        scale = Math.max(0.25, scale / 1.25);
        applyScale();
    });
    root.querySelector("#class-diagram-zoom-in").addEventListener("click", () => {
        scale = Math.min(2.5, scale * 1.25);
        applyScale();
    });

    setStatus("Reading the model…");
    const xmiUrl = new URL(root.dataset.xmi, window.location.href);
    Promise.all([
        loadElk(),
        fetch(xmiUrl).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        }),
    ]).then(([, xmlText]) => {
        elk = new ELK();
        useXml(xmlText);
    }).catch((error) => {
        setStatus(`Could not read the class diagram (${error.message}).`);
    });
})();
