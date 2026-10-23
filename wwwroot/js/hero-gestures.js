(function () {
    const root = document.querySelector("[data-ghero]");
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) root.classList.add("is-reduced");

    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const panels = Array.from(root.querySelectorAll("[data-gesture]"));
    let pointerUsed = false;

    window.addEventListener("pointerdown", function () {
        pointerUsed = true;
    }, { capture: true, once: true });

    function pathLength(pts) {
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
            total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        return total;
    }

    function resample(pts, count) {
        if (!pts.length) return Array.from({ length: count }, function () { return { x: 0, y: 0 }; });
        if (pts.length === 1 || pathLength(pts) < 1) {
            return Array.from({ length: count }, function () { return { x: pts[0].x, y: pts[0].y }; });
        }
        const seg = [];
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
            const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            seg.push(len);
            total += len;
        }
        const out = [];
        for (let i = 0; i < count; i++) {
            const target = (total * i) / (count - 1);
            let acc = 0;
            let idx = 0;
            while (idx < seg.length - 1 && acc + seg[idx] < target) {
                acc += seg[idx];
                idx++;
            }
            const span = seg[idx] || 1;
            const local = (target - acc) / span;
            const a = pts[idx];
            const b = pts[Math.min(idx + 1, pts.length - 1)];
            out.push({
                x: a.x + (b.x - a.x) * local,
                y: a.y + (b.y - a.y) * local
            });
        }
        return out;
    }

    function toPath(pts) {
        return pts.map(function (p, i) {
            return (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1);
        }).join(" ");
    }

    function tidyPortrait(pts) {
        if (pts.length < 4) return pts;
        const sparse = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
            const prev = sparse[sparse.length - 1];
            if (Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) >= 2.6) sparse.push(pts[i]);
        }
        if (sparse.length < 4) return sparse;
        return sparse.map(function (p, i) {
            if (i === 0 || i === sparse.length - 1) return p;
            const a = sparse[i - 1];
            const b = sparse[i + 1];
            return {
                x: p.x * 0.64 + (a.x + b.x) * 0.18,
                y: p.y * 0.64 + (a.y + b.y) * 0.18
            };
        });
    }

    function curvePath(pts) {
        if (pts.length < 3) return toPath(pts);
        let d = "M" + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
        for (let i = 1; i < pts.length - 1; i++) {
            const mx = (pts[i].x + pts[i + 1].x) / 2;
            const my = (pts[i].y + pts[i + 1].y) / 2;
            d += "Q" + pts[i].x.toFixed(1) + " " + pts[i].y.toFixed(1) + " " + mx.toFixed(1) + " " + my.toFixed(1);
        }
        const last = pts[pts.length - 1];
        return d + "L" + last.x.toFixed(1) + " " + last.y.toFixed(1);
    }

    function mix(amount) {
        const from = [252, 243, 238];
        const to = [232, 183, 183];
        const rgb = from.map(function (value, index) {
            return Math.round(value + (to[index] - value) * amount);
        });
        return "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    }

    function straightPoints(y, start, end) {
        return Array.from({ length: 32 }, function (_, index) {
            return { x: start + (end - start) * (index / 31), y: y };
        });
    }

    function portraitPoints(width, height) {
        const src = [[286,460],[291,460],[296,460],[301,460],[306,460],[311,460],[316,460],[321,460],[326,460],[331,460],[336,459],[341,459],[346,459],[351,458],[356,458],[361,457],[366,457],[371,456],[376,455],[381,453],[386,451],[391,449],[396,446],[400,443],[404,440],[407,436],[410,432],[412,427],[415,422],[417,417],[419,412],[420,406],[422,400],[424,395],[425,390],[427,385],[429,380],[431,375],[434,370],[437,366],[440,362],[443,357],[447,354],[452,351],[456,348],[458,343],[459,341],[461,336],[463,331],[466,325],[469,321],[473,318],[477,315],[482,312],[487,310],[491,307],[495,303],[495,298],[494,293],[493,288],[493,283],[494,278],[499,277],[503,278],[498,276],[494,272],[489,270],[484,268],[480,265],[476,261],[472,257],[468,253],[464,249],[466,251],[468,253],[464,249],[467,245],[471,241],[475,240],[480,241],[482,246],[481,244],[485,242],[490,242],[495,242],[500,241],[499,241],[494,242],[489,242],[484,242],[482,245],[482,245],[479,241],[474,239],[470,242],[466,246],[465,250],[469,254],[465,250],[465,250],[469,254],[473,258],[477,262],[477,262],[473,258],[469,254],[465,250],[462,246],[459,242],[457,237],[455,231],[454,226],[453,221],[452,216],[452,211],[451,206],[451,201],[452,195],[452,189],[456,186],[460,182],[459,178],[460,174],[465,174],[469,177],[473,180],[475,181],[479,184],[481,189],[481,194],[482,199],[481,204],[481,209],[480,214],[478,219],[477,222],[479,227],[478,231],[474,235],[477,239],[482,238],[485,239],[480,238],[475,238],[476,233],[479,229],[478,225],[478,220],[479,218],[480,213],[481,208],[481,203],[482,198],[481,193],[481,188],[478,183],[474,180],[471,180],[468,176],[463,174],[458,177],[461,181],[457,185],[453,188],[452,187],[451,182],[451,177],[451,171],[452,166],[452,161],[452,156],[453,151],[455,146],[457,141],[460,136],[463,132],[468,129],[473,127],[478,126],[483,125],[488,124],[492,121],[495,121],[499,125],[504,125],[510,126],[515,128],[521,130],[526,133],[530,136],[534,139],[537,144],[541,148],[544,152],[547,157],[549,163],[551,168],[551,173],[547,177],[543,181],[541,182],[541,187],[537,191],[532,193],[528,196],[523,198],[517,198],[512,198],[507,196],[502,195],[498,192],[497,188],[498,183],[501,179],[506,177],[511,176],[516,176],[521,177],[526,177],[532,178],[530,178],[525,177],[520,177],[515,176],[510,176],[505,177],[500,180],[497,186],[497,191],[501,194],[506,196],[511,197],[516,198],[521,198],[526,197],[530,194],[535,192],[539,189],[541,184],[542,182],[546,178],[550,174],[551,170],[552,169],[553,174],[554,179],[554,184],[554,189],[554,194],[553,199],[553,204],[552,209],[551,214],[550,219],[549,224],[548,229],[547,234],[547,239],[546,244],[547,249],[547,255],[548,260],[549,265],[552,270],[555,276],[558,281],[560,286],[563,291],[565,297],[565,302],[563,307],[560,313],[558,318],[557,323],[559,328],[562,332],[564,337],[561,342],[560,347],[564,350],[568,354],[568,358],[564,361],[559,364],[554,367],[550,370],[546,373],[542,376],[538,379],[534,382],[530,386],[526,389],[521,389],[516,390],[511,390],[506,390],[501,389],[496,388],[490,387],[484,386],[479,385],[473,384],[468,382],[463,380],[458,378],[453,375],[449,372],[445,368],[442,363],[442,358],[442,353],[444,348],[447,343],[451,339],[447,343],[444,348],[442,353],[442,358],[442,363],[445,368],[449,372],[453,375],[457,378],[462,380],[467,382],[472,383],[477,385],[482,386],[487,387],[492,388],[497,389],[502,389],[507,390],[513,390],[518,390],[523,389],[528,388],[532,384],[536,381],[540,377],[544,374],[548,371],[552,368],[556,365],[561,362],[566,359],[570,356],[566,352],[562,349],[563,349],[565,351],[569,355],[574,354],[580,351],[585,349],[590,347],[595,345],[600,343],[605,342],[610,341],[615,339],[620,339],[625,339],[631,339],[636,339],[641,340],[646,341],[651,342],[655,345],[659,348],[664,352],[667,356],[670,361],[672,366],[673,371],[674,376],[674,381],[674,386],[674,392],[678,395],[678,389],[675,384],[671,380],[667,377],[662,374],[656,372],[651,370],[646,369],[641,368],[636,367],[630,368],[625,368],[620,368],[615,369],[610,370],[605,371],[600,372],[595,374],[590,376],[585,378],[580,381],[575,384],[571,387],[567,390],[563,393],[559,397],[554,401],[551,405],[547,409],[543,414],[539,418],[536,423],[533,427],[530,431],[527,435],[524,439],[521,444],[518,448],[515,452],[512,456],[509,460],[506,464],[502,468],[498,472],[494,476],[490,479],[486,482],[481,485],[476,486],[472,483],[473,477],[475,472],[476,467],[478,462],[480,457],[482,452],[484,447],[487,442],[490,436],[492,431],[495,427],[498,422],[501,418],[504,413],[508,409],[511,404],[515,400],[519,396],[522,392],[526,388],[530,385],[534,381],[538,378],[542,375],[546,372],[550,369],[554,366],[558,363],[563,360],[563,361],[559,364],[554,366],[552,370],[556,372],[561,370],[565,367],[570,365],[575,363],[580,360],[585,359],[590,357],[595,356],[600,355],[605,353],[610,352],[615,352],[620,351],[625,350],[630,350],[635,350],[640,349],[645,348],[647,343],[646,338],[642,335],[638,332],[634,328],[630,324],[627,320],[624,316],[621,312],[618,307],[615,303],[612,299],[610,294],[608,288],[607,282],[607,277],[608,272],[608,267],[609,262],[609,256],[609,251],[608,246],[608,241],[607,236],[606,231],[605,226],[604,221],[603,216],[602,211],[602,205],[601,200],[601,195],[600,190],[600,185],[599,180],[599,175],[598,170],[597,165],[596,160],[595,155],[594,150],[592,145],[590,139],[587,135],[584,130],[581,125],[578,121],[574,117],[571,113],[567,110],[562,106],[557,103],[552,101],[547,99],[542,97],[537,96],[532,95],[528,99],[524,103],[520,107],[524,103],[528,99],[530,95],[525,95],[520,94],[515,94],[510,95],[505,95],[500,96],[498,99],[498,104],[496,109],[497,110],[495,115],[495,120],[498,124],[503,125],[508,126],[513,127],[518,128],[523,131],[524,136],[519,137],[514,136],[509,135],[504,135],[503,135],[508,135],[513,136],[518,136],[523,137],[524,132],[520,129],[515,128],[510,126],[505,125],[500,125],[495,122],[495,117],[496,112],[497,111],[498,106],[499,101],[498,97],[503,96],[508,95],[513,94],[518,94],[523,94],[528,95],[529,98],[525,102],[521,106],[523,104],[527,100],[531,96],[534,96],[529,95],[524,94],[519,94],[514,94],[509,95],[504,95],[499,96],[494,98],[489,99],[484,101],[479,104],[475,107],[471,110],[467,114],[463,118],[460,122],[457,127],[455,133],[452,138],[449,143],[446,147],[443,151],[439,156],[435,161],[433,166],[434,164],[437,162],[435,167],[434,172],[434,177],[434,182],[436,187],[433,187],[431,182],[432,185],[435,189],[435,184],[435,189],[438,193],[440,198],[441,204],[441,209],[438,214],[435,218],[432,222],[429,227],[426,231],[425,236],[424,241],[424,246],[424,251],[427,256],[430,260],[429,265],[430,270],[432,275],[435,280],[438,285],[441,289],[442,294],[442,299],[441,304],[439,309],[436,314],[434,319],[432,325],[431,331],[428,336],[425,341],[422,345],[418,349],[414,353],[410,356],[406,359],[402,363],[398,367],[394,372],[392,377],[390,382],[388,387],[387,392],[386,397],[386,402],[386,407],[387,412],[388,417],[389,422],[391,427],[394,432],[395,433]];
        const sx = width / 1024;
        const sy = height / 576;
        return src.slice().reverse().map(function (p) {
            return { x: p[0] * sx, y: p[1] * sy };
        });
    }

    const draw = (function () {
        const panel = root.querySelector('[data-gesture="1"]');
        if (!panel) return { onShow: function () {}, onHide: function () {} };
        const svg = panel.querySelector(".g1__svg");
        const prompt = panel.querySelector(".g1__prompt");
        const again = panel.querySelector("[data-again]");
        const straighten = panel.querySelector("[data-straighten]");
        const lock = panel.querySelector("[data-lock]");
        const heading = lock.querySelector("h1");
        const ns = "http://www.w3.org/2000/svg";
        const ghost = document.createElementNS(ns, "path");
        const ink = document.createElementNS(ns, "path");
        const portrait = document.createElementNS(ns, "path");
        const path = document.createElementNS(ns, "path");
        const tip = document.createElementNS(ns, "circle");
        ghost.setAttribute("class", "g1__ghost");
        ink.setAttribute("class", "g1__ink");
        portrait.setAttribute("class", "g1__portrait");
        portrait.setAttribute("fill", "none");
        portrait.setAttribute("stroke", "#FCF3EE");
        portrait.setAttribute("stroke-width", "1.8");
        portrait.setAttribute("stroke-linecap", "round");
        portrait.setAttribute("stroke-linejoin", "round");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        tip.setAttribute("class", "g1__tip");
        tip.setAttribute("r", "0");
        svg.append(ghost, ink, portrait, path, tip);
        const nib = document.createElement("div");
        nib.className = "g1__nib";
        nib.hidden = true;
        nib.innerHTML = "<svg viewBox=\"0 0 18 36\" width=\"20\" height=\"40\" aria-hidden=\"true\"><path d=\"M9 35C7.2 32 5.6 28 6.4 23C7.3 16 8.2 8 9 1.5C9.8 8 10.7 16 11.6 23C12.4 28 10.8 32 9 35\"/><path d=\"M9 30.2V20\"/></svg>";
        panel.appendChild(nib);
        const nibRest = 0.55;
        let nibAngle = nibRest;
        heading.tabIndex = -1;

        let pts = [];
        let drawing = false;
        let locked = false;
        let access = reduced;
        let generation = 0;
        let autoTimer = 0;
        function size() {
            const rect = panel.getBoundingClientRect();
            svg.setAttribute("viewBox", "0 0 " + rect.width + " " + rect.height);
            return rect;
        }

        function paint(points, width, color) {
            ghost.setAttribute("d", "");
            ink.setAttribute("d", "");
            tip.setAttribute("r", "0");
            path.setAttribute("d", points.length ? toPath(points) : "");
            path.setAttribute("stroke-width", String(width));
            path.setAttribute("stroke", color);
        }

        function ribbon(points) {
            if (points.length < 2) return "";
            const left = [];
            const right = [];
            for (let i = 0; i < points.length; i++) {
                const prev = points[Math.max(0, i - 1)];
                const next = points[Math.min(points.length - 1, i + 1)];
                let dx = next.x - prev.x;
                let dy = next.y - prev.y;
                const len = Math.hypot(dx, dy) || 1;
                dx /= len;
                dy /= len;
                const speed = i === 0 ? 0 : Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
                const taper = i / (points.length - 1);
                const belly = Math.sin(Math.PI * taper);
                const width = (2.2 + belly * 7.5) * (1 - Math.min(1, speed / 34) * 0.55);
                left.push({ x: points[i].x - dy * width, y: points[i].y + dx * width });
                right.push({ x: points[i].x + dy * width, y: points[i].y - dx * width });
            }
            const side = function (ring, move) {
                let d = move + ring[0].x.toFixed(1) + " " + ring[0].y.toFixed(1);
                for (let i = 1; i < ring.length - 1; i++) {
                    const a = ring[i];
                    const b = ring[i + 1];
                    d += " Q " + a.x.toFixed(1) + " " + a.y.toFixed(1) + " " + ((a.x + b.x) / 2).toFixed(1) + " " + ((a.y + b.y) / 2).toFixed(1);
                }
                const last = ring[ring.length - 1];
                return d + " L " + last.x.toFixed(1) + " " + last.y.toFixed(1);
            };
            return side(left, "M ") + side(right.reverse(), " L ") + " Z";
        }

        function paintInk(points) {
            const d = ribbon(points);
            const last = points[points.length - 1];
            path.setAttribute("d", "");
            ghost.setAttribute("d", d);
            ink.setAttribute("d", d);
            if (last) {
                tip.setAttribute("cx", last.x.toFixed(1));
                tip.setAttribute("cy", last.y.toFixed(1));
                tip.setAttribute("r", "1.4");
            }
        }

        function aimNib(x, y, target) {
            let delta = target - nibAngle;
            delta = Math.atan2(Math.sin(delta), Math.cos(delta));
            nibAngle += delta * 0.38;
            nib.hidden = false;
            nib.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + nibAngle.toFixed(3) + "rad)";
        }

        function placeNib(event) {
            if (locked || event.pointerType === "touch" || panel.classList.contains("is-portrait")) {
                if (event.pointerType === "touch") nib.hidden = true;
                return;
            }
            const rect = panel.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            let target = nibRest;
            if (drawing && pts.length) {
                const last = pts[pts.length - 1];
                const dx = x - last.x;
                const dy = y - last.y;
                if (Math.hypot(dx, dy) > 0.4) target = Math.atan2(dy, dx) - Math.PI / 2;
            }
            aimNib(x, y, target);
        }

        function lockedLine(keepView) {
            const rect = keepView ? panel.getBoundingClientRect() : size();
            const lane = panel.querySelector("[data-lane]");
            const stage = panel.querySelector(".gframe__stage");
            const laneRect = lane.getBoundingClientRect();
            const y = laneRect.height > 2
                ? laneRect.top - rect.top + laneRect.height / 2
                : rect.height * 0.34;
            let start = laneRect.left - rect.left;
            let end = laneRect.right - rect.left;
            if (stage) {
                const stageRect = stage.getBoundingClientRect();
                const stageBeside = stageRect.left > laneRect.right - 12 && stageRect.top < laneRect.bottom;
                if (stageBeside) end = stageRect.left - rect.left - 22;
            }
            if (end - start < 48) {
                start = rect.width * 0.08;
                end = rect.width * 0.92;
            }
            return straightPoints(y, start, end);
        }

        function showLocked() {
            locked = true;
            panel.classList.add("is-staged", "is-locked", "is-arrived");
            panel.classList.remove("is-drawing", "is-inking", "is-portrait");
            nib.hidden = true;
            prompt.hidden = true;
            again.hidden = access;
            straighten.hidden = !access;
        }

        function placePortrait(rect) {
            const curve = tidyPortrait(portraitPoints(rect.width, rect.height));
            portrait.setAttribute("d", curvePath(curve));
            portrait.setAttribute("stroke", "#FCF3EE");
            portrait.setAttribute("stroke-width", "1.8");
            return curve;
        }

        function clearPortrait() {
            portrait.setAttribute("d", "");
            portrait.removeAttribute("transform");
            portrait.style.transition = "";
            portrait.style.opacity = "";
            portrait.style.filter = "";
            portrait.style.strokeDasharray = "none";
            portrait.style.strokeDashoffset = "0";
        }

        function settle() {
            showLocked();
            clearPortrait();
            const rect = size();
            if (rect.width < 20 || rect.height < 20) return;
            paint(lockedLine(true), 3, "#E8B7B7");
            path.style.opacity = "";
            path.style.strokeDasharray = "none";
        }

        function lockNow() {
            window.clearTimeout(autoTimer);
            generation += 1;
            settle();
        }

        function foldIntoLine(from, to) {
            const gen = generation;
            const lineY = to[Math.floor(to.length / 2)].y;
            const lineStart = to[0].x;
            const lineEnd = to[to.length - 1].x;
            let minX = from[0].x;
            let maxX = from[0].x;
            from.forEach(function (point) {
                if (point.x < minX) minX = point.x;
                if (point.x > maxX) maxX = point.x;
            });
            const span = maxX - minX || 1;
            const began = performance.now();
            const ms = 2400;
            portrait.removeAttribute("transform");
            portrait.style.strokeDasharray = "";
            portrait.style.strokeDashoffset = "";
            nib.hidden = true;
            tip.setAttribute("r", "0");
            paint(to, 3, "#E8B7B7");
            path.style.opacity = "0";
            path.style.strokeDasharray = "none";
            path.style.strokeDashoffset = "0";
            return new Promise(function (resolve) {
                const step = function (now) {
                    if (gen !== generation) {
                        resolve(false);
                        return;
                    }
                    const t = Math.min(1, (now - began) / ms);
                    const eased = t * t * (3 - 2 * t);
                    const melt = Math.max(0, (eased - 0.05) / 0.95);
                    const meltE = melt * melt * (3 - 2 * melt);
                    const faded = from.map(function (point) {
                        const along = (point.x - minX) / span;
                        const targetX = lineStart + (lineEnd - lineStart) * along;
                        return {
                            x: point.x + (targetX - point.x) * meltE,
                            y: point.y + (lineY - point.y) * meltE
                        };
                    });
                    portrait.setAttribute("d", curvePath(faded));
                    portrait.style.opacity = String(Math.max(0, 1 - Math.pow(eased, 0.85)));
                    portrait.style.filter = "blur(" + (Math.pow(eased, 1.2) * 8).toFixed(2) + "px)";
                    const lineT = Math.max(0, (eased - 0.35) / 0.65);
                    const lineE = lineT * lineT * (3 - 2 * lineT);
                    path.style.opacity = String(Math.min(1, lineE));
                    if (t < 1) requestAnimationFrame(step);
                    else {
                        path.style.opacity = "";
                        clearPortrait();
                        resolve(true);
                    }
                };
                requestAnimationFrame(step);
            });
        }

        function morph(from, to, ms, widthFrom, widthTo, samples) {
            const gen = generation;
            const count = samples || 32;
            const start = resample(from, count);
            const end = resample(to, count);
            const began = performance.now();
            return new Promise(function (resolve) {
                const step = function (now) {
                    if (gen !== generation) {
                        resolve(false);
                        return;
                    }
                    const t = Math.min(1, (now - began) / ms);
                    const eased = 1 - Math.pow(1 - t, 4);
                    const current = start.map(function (point, index) {
                        return {
                            x: point.x + (end[index].x - point.x) * eased,
                            y: point.y + (end[index].y - point.y) * eased
                        };
                    });
                    paint(current, widthFrom + (widthTo - widthFrom) * eased, mix(eased));
                    if (t < 1) requestAnimationFrame(step);
                    else resolve(true);
                };
                requestAnimationFrame(step);
            });
        }

        function pointAlong(pts, dist) {
            let left = dist;
            for (let i = 1; i < pts.length; i++) {
                const step = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
                if (left <= step) {
                    const t = step ? left / step : 0;
                    return {
                        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
                        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t
                    };
                }
                left -= step;
            }
            return pts[pts.length - 1];
        }

        async function runAuto(userStroke) {
            if (locked || access || reduced || drawing || panel.hidden) return;
            if (!userStroke || userStroke.length < 2) return;
            const rect = size();
            if (rect.width < 20) return;
            const curve = placePortrait(rect);
            const length = portrait.getTotalLength();
            const gen = generation;
            path.setAttribute("d", "");
            panel.classList.add("is-inking", "is-portrait");
            portrait.style.strokeDasharray = String(length);
            portrait.style.strokeDashoffset = String(length);
            const began = performance.now();
            await new Promise(function (resolve) {
                const step = function (now) {
                    if (gen !== generation) {
                        resolve();
                        return;
                    }
                    const t = Math.min(1, (now - began) / 5200);
                    const eased = 1 - Math.pow(1 - t, 2);
                    portrait.style.strokeDashoffset = String(length * (1 - eased));
                    const tipPt = pointAlong(curve, length * eased);
                    tip.setAttribute("cx", tipPt.x.toFixed(1));
                    tip.setAttribute("cy", tipPt.y.toFixed(1));
                    tip.setAttribute("r", "1.5");
                    const ahead = pointAlong(curve, Math.min(length, length * eased + 12));
                    const behind = pointAlong(curve, Math.max(0, length * eased - 8));
                    aimNib(tipPt.x, tipPt.y, Math.atan2(ahead.y - behind.y, ahead.x - behind.x) - Math.PI / 2);
                    if (t < 1) requestAnimationFrame(step);
                    else {
                        nib.hidden = true;
                        resolve();
                    }
                };
                requestAnimationFrame(step);
            });
            tip.setAttribute("r", "0");
            portrait.style.strokeDasharray = "";
            portrait.style.strokeDashoffset = "";
            nib.hidden = true;
            if (gen !== generation || locked || drawing) return;
            await new Promise(function (resolve) {
                autoTimer = window.setTimeout(resolve, 900);
            });
            if (gen !== generation || locked || drawing || panel.hidden) return;
            clearPortrait();
            panel.classList.remove("is-inking", "is-portrait");
            nib.hidden = true;
            tip.setAttribute("r", "0");
            panel.classList.add("is-staged");
            await new Promise(function (resolve) {
                requestAnimationFrame(function () { requestAnimationFrame(resolve); });
            });
            if (gen !== generation || locked || drawing || panel.hidden) return;
            showLocked();
            await new Promise(function (resolve) {
                requestAnimationFrame(function () { requestAnimationFrame(resolve); });
            });
            const drawn = await straightFromMark(1500);
            if (!drawn || gen !== generation || drawing || panel.hidden) return;
            paint(lockedLine(true), 3, "#E8B7B7");
            path.style.opacity = "";
            path.style.strokeDasharray = "none";
        }

        function straightFromMark(ms) {
            const gen = generation;
            const rule = lockedLine(true);
            const lineY = rule[0].y;
            const left = rule[0];
            const right = rule[rule.length - 1];
            clearPortrait();
            panel.classList.remove("is-portrait");
            tip.setAttribute("r", "0");
            path.setAttribute("d", "M" + left.x.toFixed(1) + " " + lineY.toFixed(1) + " L" + right.x.toFixed(1) + " " + lineY.toFixed(1));
            path.setAttribute("stroke", "#FCF3EE");
            path.setAttribute("stroke-width", "1.8");
            path.style.opacity = "1";
            path.style.filter = "";
            const span = Math.max(1, path.getTotalLength());
            path.style.strokeDasharray = String(span);
            path.style.strokeDashoffset = String(span);
            return new Promise(function (resolve) {
                const started = performance.now();
                const step = function (now) {
                    if (gen !== generation) {
                        resolve(false);
                        return;
                    }
                    const t = Math.min(1, (now - started) / ms);
                    const eased = 1 - Math.pow(1 - t, 2);
                    path.style.strokeDashoffset = String(span * (1 - eased));
                    const tipPt = path.getPointAtLength(span * eased);
                    const behind = path.getPointAtLength(Math.max(0, span * eased - 14));
                    tip.setAttribute("cx", tipPt.x.toFixed(1));
                    tip.setAttribute("cy", tipPt.y.toFixed(1));
                    tip.setAttribute("r", t < 1 ? "1.5" : "0");
                    if (t < 1) {
                        aimNib(tipPt.x, tipPt.y, Math.atan2(tipPt.y - behind.y, tipPt.x - behind.x) - Math.PI / 2);
                        requestAnimationFrame(step);
                        return;
                    }
                    nib.hidden = true;
                    path.style.strokeDasharray = "none";
                    path.style.strokeDashoffset = "0";
                    window.setTimeout(function () {
                        resolve(gen === generation);
                    }, 120);
                };
                requestAnimationFrame(step);
            });
        }

        function traceStroke(stroke, ms, color, width) {
            const gen = generation;
            paint(stroke, width, color);
            const length = Math.max(1, path.getTotalLength());
            path.style.opacity = "1";
            path.style.strokeDasharray = String(length);
            path.style.strokeDashoffset = String(length);
            const began = performance.now();
            return new Promise(function (resolve) {
                const step = function (now) {
                    if (gen !== generation) {
                        resolve(false);
                        return;
                    }
                    const t = Math.min(1, (now - began) / ms);
                    const eased = 1 - Math.pow(1 - t, 2);
                    path.style.strokeDashoffset = String(length * (1 - eased));
                    portrait.style.opacity = String(1 - eased);
                    const tipPt = path.getPointAtLength(length * eased);
                    const behind = path.getPointAtLength(Math.max(0, length * eased - 14));
                    tip.setAttribute("cx", tipPt.x.toFixed(1));
                    tip.setAttribute("cy", tipPt.y.toFixed(1));
                    tip.setAttribute("r", t < 1 ? "1.5" : "0");
                    if (t < 1) aimNib(tipPt.x, tipPt.y, Math.atan2(tipPt.y - behind.y, tipPt.x - behind.x) - Math.PI / 2);
                    else nib.hidden = true;
                    if (t < 1) requestAnimationFrame(step);
                    else {
                        path.style.strokeDasharray = "none";
                        path.style.strokeDashoffset = "0";
                        clearPortrait();
                        resolve(true);
                    }
                };
                requestAnimationFrame(step);
            });
        }

        function schedule() {
            window.clearTimeout(autoTimer);
            generation += 1;
            if (access || reduced) {
                lockNow();
                return;
            }
            const gen = generation;
            autoTimer = window.setTimeout(function () {
                if (gen !== generation || locked || drawing || access || reduced || panel.hidden) return;
                runAuto([{ x: 0, y: 0 }, { x: 40, y: 0 }]);
            }, 7000);
        }

        function reset() {
            locked = false;
            drawing = false;
            pts = [];
            panel.classList.remove("is-locked", "is-staged", "is-drawing", "is-inking", "is-arrived", "is-portrait");
            prompt.hidden = access;
            again.hidden = true;
            straighten.hidden = !access;
            path.style.strokeDasharray = "none";
            clearPortrait();
            paint([], 10, "transparent");
            schedule();
        }

        function enableAccess() {
            if (access || pointerUsed || reduced) return;
            access = true;
            root.classList.add("is-access");
            prompt.hidden = true;
            again.hidden = true;
            straighten.hidden = false;
            if (!locked && !drawing) lockNow();
        }

        panel.addEventListener("pointerdown", function (event) {
            if (locked || access || reduced || panel.classList.contains("is-portrait") || panel.classList.contains("is-inking")) return;
            if (event.button !== 0) return;
            if (event.target.closest("a, button")) return;
            drawing = true;
            generation += 1;
            window.clearTimeout(autoTimer);
            panel.classList.add("is-drawing");
            panel.classList.remove("is-inking", "is-staged", "is-portrait");
            portrait.setAttribute("d", "");
            path.style.strokeDasharray = "none";
            const rect = size();
            pts = [{ x: event.clientX - rect.left, y: event.clientY - rect.top }];
            paintInk(pts);
            placeNib(event);
            panel.setPointerCapture(event.pointerId);
        });

        panel.addEventListener("pointermove", function (event) {
            if (!locked) placeNib(event);
            if (!drawing) return;
            const rect = panel.getBoundingClientRect();
            const next = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            const last = pts[pts.length - 1];
            if (last && Math.hypot(next.x - last.x, next.y - last.y) < 1.5) return;
            pts.push(next);
            if (pts.length > 140) pts = resample(pts, 90);
            paintInk(pts);
        });

        function finishDraw() {
            if (!drawing) return;
            drawing = false;
            nib.hidden = true;
            const drawn = pathLength(pts) >= 28;
            const userStroke = pts.slice();
            pts = [];
            panel.classList.remove("is-drawing");
            paint([], 11, "transparent");
            if (!drawn || locked) {
                if (!locked) schedule();
                return;
            }
            runAuto(userStroke);
        }

        panel.addEventListener("pointerup", finishDraw);
        panel.addEventListener("pointercancel", finishDraw);
        panel.addEventListener("pointerleave", function () {
            if (!drawing) nib.hidden = true;
        });
        again.addEventListener("click", reset);
        straighten.addEventListener("click", function () {
            lockNow();
            heading.focus();
        });

        window.addEventListener("keydown", function (event) {
            if (event.key === "Tab") enableAccess();
        }, true);

        window.addEventListener("resize", function () {
            if (panel.hidden || !locked) return;
            settle();
        });

        return {
            onShow: function () {
                requestAnimationFrame(function () {
                    if (reduced) {
                        access = true;
                        root.classList.add("is-access");
                        prompt.hidden = true;
                        straighten.hidden = false;
                        again.hidden = true;
                        lockNow();
                        return;
                    }
                    if (locked || access) {
                        lockNow();
                        return;
                    }
                    schedule();
                });
            },
            onHide: function () {
                generation += 1;
                window.clearTimeout(autoTimer);
                drawing = false;
            }
        };
    }());

    const hold = (function () {
        const panel = root.querySelector('[data-gesture="2"]');
        if (!panel) return { onShow: function () {}, onHide: function () {} };
        const phone = panel.querySelector("[data-phone]");
        const screen = phone.querySelector(".gphone__screen");
        const holdBtn = phone.querySelector("[data-hold]") || phone;
        const clearBtn = panel.querySelector("[data-clear]");
        let amount = 0;
        let down = false;
        let latched = false;
        let frame = 0;
        let last = 0;

        function apply() {
            screen.style.setProperty("--hold", amount.toFixed(3));
            const clear = latched || amount > 0.98;
            phone.classList.toggle("is-clear", clear);
            holdBtn.setAttribute("aria-pressed", clear ? "true" : "false");
            if (clear) holdBtn.setAttribute("aria-label", "FitHub page cleared");
        }

        function loop(now) {
            const dt = last ? now - last : 16;
            last = now;
            if (!latched) {
                if (down) amount = Math.min(1, amount + dt / 680);
                else amount = Math.max(0, amount - dt / 420);
                if (amount >= 1) latched = true;
            }
            apply();
            if (!latched && (down || amount > 0)) frame = requestAnimationFrame(loop);
            else {
                frame = 0;
                last = 0;
            }
        }

        function kick() {
            if (!frame) frame = requestAnimationFrame(loop);
        }

        if (reduced) {
            clearBtn.hidden = false;
            clearBtn.addEventListener("click", function () {
                const cleared = clearBtn.getAttribute("aria-pressed") === "true";
                latched = !cleared;
                amount = latched ? 1 : 0;
                apply();
                clearBtn.setAttribute("aria-pressed", latched ? "true" : "false");
            });
        } else {
            holdBtn.setAttribute("aria-pressed", "false");
            if (!holdBtn.getAttribute("aria-label")) holdBtn.setAttribute("aria-label", "Hold to clear the FitHub page");

            holdBtn.addEventListener("pointerdown", function (event) {
                if (latched || event.button !== 0) return;
                if (event.target.closest("a")) return;
                event.preventDefault();
                down = true;
                phone.classList.add("is-down");
                try { holdBtn.setPointerCapture(event.pointerId); } catch (e) {}
                kick();
            });

            function release() {
                if (!down && amount === 0) return;
                down = false;
                phone.classList.remove("is-down");
                kick();
            }

            holdBtn.addEventListener("pointerup", release);
            holdBtn.addEventListener("pointercancel", release);
            window.addEventListener("pointerup", release);
            holdBtn.addEventListener("contextmenu", function (event) { event.preventDefault(); });
            holdBtn.addEventListener("keydown", function (event) {
                if (latched) return;
                if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                    event.preventDefault();
                    down = true;
                    phone.classList.add("is-down");
                    kick();
                }
            });
            holdBtn.addEventListener("keyup", function (event) {
                if (event.key === " " || event.key === "Enter") release();
            });
            holdBtn.addEventListener("blur", release);
        }

        return {
            onHide: function () {
                down = false;
                phone.classList.remove("is-down");
            }
        };
    }());

    const word = (function () {
        const panel = root.querySelector('[data-gesture="3"]');
        if (!panel) return { onShow: function () {}, onHide: function () {} };
        const track = panel.querySelector("[data-track]");
        const chip = panel.querySelector("[data-chip]");
        const dots = panel.querySelector("[data-dots]");
        const card = panel.querySelector("[data-card]");
        const note = panel.querySelector("[data-form-note]");
        const contactForm = panel.querySelector("[data-contact-form]");
        const example = {
            name: "Alex Morgan",
            email: "alex@example.com",
            message: "Hi Anastasiia — I'd like help making a product page easier to buy from on mobile. Are you free for a short call this week?"
        };
        const exampleNote = "Sample hint only. It is not sent.";
        const idleNote = note ? note.textContent : "";
        let progress = reduced ? 1 : 0;
        let drag = null;
        let anim = 0;
        let wasSettled = false;
        let exampleOn = false;

        const wordLabel = chip.textContent.trim();
        chip.setAttribute("role", "slider");
        chip.setAttribute("aria-label", wordLabel);
        chip.setAttribute("aria-valuemin", "0");
        chip.setAttribute("aria-valuemax", "100");
        chip.setAttribute("aria-orientation", "horizontal");

        function maxTravel() {
            return Math.max(48, track.clientWidth - chip.offsetWidth);
        }

        function progressFromClient(clientX) {
            const rect = track.getBoundingClientRect();
            return (clientX - rect.left - chip.offsetWidth / 2) / maxTravel();
        }

        function setProgress(value, focus) {
            progress = Math.min(1, Math.max(0, value));
            const travel = maxTravel();
            const x = Math.min(travel, progress * travel);
            const settled = progress >= 0.985;
            chip.style.left = (settled ? 0 : x) + "px";
            track.style.width = settled ? chip.offsetWidth + "px" : "";
            const remaining = Math.max(0, travel - x - 10);
            dots.style.left = (x + chip.offsetWidth + 8) + "px";
            dots.style.width = settled ? "0px" : remaining + "px";
            panel.classList.toggle("is-settled", settled);
            chip.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
            chip.setAttribute("aria-valuetext", settled ? wordLabel + ", in place" : wordLabel);
            if (!card.classList.contains("g3__card--form")) card.toggleAttribute("inert", !settled);
            card.style.setProperty("--write", progress.toFixed(3));
            if (settled && !wasSettled) fillExample();
            if (!settled && wasSettled) clearExample();
            wasSettled = settled;

            const host = card.offsetParent || panel;
            if (card.classList.contains("g3__card--form")) {
                card.style.left = "auto";
                card.style.top = "auto";
            } else {
                const homeLeft = Math.max(16, (host.clientWidth - card.offsetWidth) / 2);
                const homeTop = Math.max(16, (host.clientHeight - card.offsetHeight) / 2);
                card.style.left = (settled ? homeLeft : 18 + (homeLeft - 18) * progress) + "px";
                card.style.top = homeTop + "px";
            }

        }

        function animateTo(target, focus) {
            const id = ++anim;
            const from = progress;
            const began = performance.now();
            const step = function (now) {
                if (id !== anim) return;
                const t = Math.min(1, (now - began) / 280);
                const eased = 1 - Math.pow(1 - t, 3);
                setProgress(from + (target - from) * eased, t >= 1 && focus && target >= 1);
                if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }

        function release(commit) {
            if (commit || progress > 0.34) animateTo(1, true);
            else animateTo(0, false);
        }

        function field(name) {
            return contactForm ? contactForm.querySelector('[name="' + name + '"]') : null;
        }

        function fillExample() {
            if (!contactForm || exampleOn) return;
            ["name", "email", "message"].forEach(function (key) {
                const input = field(key);
                if (!input || input.value) return;
                input.placeholder = example[key];
            });
            exampleOn = true;
            contactForm.classList.add("is-example");
            if (note) note.textContent = exampleNote;
        }

        function clearExample() {
            if (!contactForm || !exampleOn) return;
            ["name", "email", "message"].forEach(function (key) {
                const input = field(key);
                if (input && !input.value) input.placeholder = "";
            });
            exampleOn = false;
            contactForm.classList.remove("is-example");
            if (note) note.textContent = idleNote;
        }

        if (!reduced) {
            function onMove(event) {
                if (!drag || event.pointerId !== drag.id) return;
                const span = maxTravel() || 1;
                setProgress(drag.start + (event.clientX - drag.startX) / span, false);
            }
            function endDrag(event) {
                if (!drag || (event && event.pointerId !== drag.id)) return;
                drag = null;
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", endDrag);
                window.removeEventListener("pointercancel", endDrag);
                release(false);
            }
            track.addEventListener("pointerdown", function (event) {
                if (event.button !== 0) return;
                anim += 1;
                const onChip = event.target === chip || chip.contains(event.target);
                drag = {
                    id: event.pointerId,
                    startX: event.clientX,
                    start: onChip ? progress : progressFromClient(event.clientX)
                };
                if (!onChip) setProgress(drag.start, false);
                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", endDrag);
                window.addEventListener("pointercancel", endDrag);
                try { track.setPointerCapture(event.pointerId); } catch (e) {}
                event.preventDefault();
            });
            chip.addEventListener("keydown", function (event) {
                const step = event.shiftKey ? 0.2 : 0.08;
                if (event.key === "ArrowRight") setProgress(progress + step, false);
                else if (event.key === "ArrowLeft") setProgress(progress - step, false);
                else if (event.key === "Home") setProgress(0, false);
                else if (event.key === "End") setProgress(1, false);
                else return;
                event.preventDefault();
            });
        }

        if (contactForm) {
            contactForm.addEventListener("submit", function (event) {
                event.preventDefault();
                const data = new FormData(contactForm);
                const name = String(data.get("name") || "").trim();
                const email = String(data.get("email") || "").trim();
                const message = String(data.get("message") || "").trim();
                const subject = encodeURIComponent(name ? "Hello from " + name : "Hello");
                const body = encodeURIComponent(message + "\n\n— " + name + "\n" + email);
                contactForm.dataset.sent = "1";
                window.location.href = "mailto:nastiakhru@gmail.com?subject=" + subject + "&body=" + body;
                if (note) note.textContent = "Your email app should open with this message.";
            });
        }

        window.addEventListener("resize", function () {
            if (!panel.hidden) setProgress(progress);
        });
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                if (!panel.hidden) setProgress(progress);
            });
        }

        return {
            onShow: function () {
                requestAnimationFrame(function () { setProgress(progress); });
            }
        };
    }());

    const seam = (function () {
        const panel = root.querySelector('[data-gesture="4"]');
        if (!panel) return { onShow: function () {}, onHide: function () {} };
        const stage = panel.querySelector("[data-seam]");
        const handle = panel.querySelector("[data-handle]");
        const openBtn = panel.querySelector("[data-open]");
        let value = reduced ? 0.24 : 0.58;
        let dragging = false;

        handle.setAttribute("role", "slider");
        handle.setAttribute("aria-valuemin", "0");
        handle.setAttribute("aria-valuemax", "100");
        handle.setAttribute("aria-orientation", "horizontal");

        function apply() {
            stage.style.setProperty("--seam", value.toFixed(4));
            handle.setAttribute("aria-valuenow", String(Math.round((1 - value) * 100)));
            handle.setAttribute("aria-valuetext", value < 0.12 ? "Open" : "Pulled " + Math.round((1 - value) * 100) + " percent");
        }

        function fromClient(clientX) {
            const rect = stage.getBoundingClientRect();
            const next = (clientX - rect.left) / rect.width;
            value = Math.min(0.9, Math.max(0.06, next));
            apply();
        }

        if (reduced) {
            openBtn.hidden = false;
            openBtn.addEventListener("click", function () {
                value = 0.06;
                apply();
            });
        }

        function startDrag(event) {
            if (event.button !== 0) return;
            dragging = true;
            try { stage.setPointerCapture(event.pointerId); } catch (e) {}
            fromClient(event.clientX);
            event.preventDefault();
        }

        function endDrag() {
            dragging = false;
        }

        stage.addEventListener("pointerdown", startDrag);
        stage.addEventListener("pointermove", function (event) {
            if (dragging) fromClient(event.clientX);
        });
        stage.addEventListener("pointerup", endDrag);
        stage.addEventListener("pointercancel", endDrag);
        window.addEventListener("pointerup", endDrag);
        handle.addEventListener("keydown", function (event) {
            const step = event.shiftKey ? 0.08 : 0.035;
            if (event.key === "ArrowLeft") value = Math.max(0.06, value - step);
            else if (event.key === "ArrowRight") value = Math.min(0.9, value + step);
            else if (event.key === "Home") value = 0.06;
            else if (event.key === "End") value = 0.9;
            else return;
            apply();
            event.preventDefault();
        });

        apply();
        return { onShow: apply };
    }());

    const gestures = { 1: draw, 2: hold, 3: word, 4: seam };
    let active = 0;

    function show(index) {
        if (index === active) return;
        if (gestures[active]) gestures[active].onHide && gestures[active].onHide();
        active = index;
        tabs.forEach(function (tab, tabIndex) {
            const selected = tabIndex === index - 1;
            tab.setAttribute("aria-selected", selected ? "true" : "false");
            tab.tabIndex = selected ? 0 : -1;
        });
        panels.forEach(function (panel) {
            panel.hidden = Number(panel.getAttribute("data-gesture")) !== index;
        });
        gestures[index].onShow && gestures[index].onShow();
    }

    tabs.forEach(function (tab, index) {
        tab.addEventListener("click", function () { show(index + 1); });
        tab.addEventListener("keydown", function (event) {
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
            else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = tabs.length - 1;
            else return;
            event.preventDefault();
            show(next + 1);
            tabs[next].focus();
        });
    });

    const opening = panels.length ? Number(panels[0].getAttribute("data-gesture")) : 1;
    show(opening);
}());
