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

    function curvePoints(width, height) {
        const p0 = { x: width * 0.02, y: height * 0.78 };
        const p1 = { x: width * 0.46, y: height * 0.16 };
        const p2 = { x: width * 0.98, y: height * 0.3 };
        const pts = [];
        for (let i = 0; i <= 32; i++) {
            const t = i / 32;
            const u = 1 - t;
            pts.push({
                x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
                y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
            });
        }
        return pts;
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
        const path = document.createElementNS(ns, "path");
        const tip = document.createElementNS(ns, "circle");
        ghost.setAttribute("class", "g1__ghost");
        ink.setAttribute("class", "g1__ink");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        tip.setAttribute("class", "g1__tip");
        tip.setAttribute("r", "0");
        svg.append(ghost, ink, path, tip);
        const nib = document.createElement("div");
        nib.className = "g1__nib";
        nib.hidden = true;
        panel.appendChild(nib);
        heading.tabIndex = -1;

        const idleBeforeAuto = 6200;
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
                tip.setAttribute("r", "3.2");
            }
        }

        function placeNib(event) {
            if (locked || event.pointerType === "touch") {
                nib.hidden = true;
                return;
            }
            const rect = panel.getBoundingClientRect();
            nib.hidden = false;
            nib.style.transform = "translate(" + (event.clientX - rect.left) + "px," + (event.clientY - rect.top) + "px)";
        }

        function lockedLine() {
            const rect = size();
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
            panel.classList.remove("is-drawing", "is-inking");
            nib.hidden = true;
            prompt.hidden = true;
            again.hidden = access;
            straighten.hidden = !access;
        }

        function lockNow() {
            window.clearTimeout(autoTimer);
            generation += 1;
            const rect = size();
            if (rect.width < 20 || rect.height < 20) return;
            showLocked();
            paint(lockedLine(), 3, "#E8B7B7");
            path.style.strokeDasharray = "none";
        }

        function morph(from, to, ms, widthFrom, widthTo) {
            const gen = generation;
            const start = resample(from, 32);
            const end = resample(to, 32);
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

        async function runAuto() {
            if (locked || access || reduced || drawing || panel.hidden) return;
            const rect = size();
            if (rect.width < 20) return;
            const curve = curvePoints(rect.width, rect.height);
            const length = pathLength(curve);
            const gen = generation;
            panel.classList.add("is-inking");
            paint(curve, 8, "rgba(252, 243, 238, 0.72)");
            path.style.strokeDasharray = String(length);
            path.style.strokeDashoffset = String(length);
            const began = performance.now();
            await new Promise(function (resolve) {
                const step = function (now) {
                    if (gen !== generation) {
                        resolve();
                        return;
                    }
                    const t = Math.min(1, (now - began) / 1700);
                    const eased = 1 - Math.pow(1 - t, 3);
                    path.style.strokeDashoffset = String(length * (1 - eased));
                    if (t < 1) requestAnimationFrame(step);
                    else resolve();
                };
                requestAnimationFrame(step);
            });
            if (gen !== generation || locked || drawing) return;
            await new Promise(function (resolve) {
                autoTimer = window.setTimeout(resolve, 1500);
            });
            if (gen !== generation || locked || drawing || panel.hidden) return;
            path.style.strokeDasharray = "none";
            path.style.strokeDashoffset = "0";
            panel.classList.add("is-staged");
            const finished = await morph(curve, lockedLine(), 880, 8, 2.2);
            if (finished) {
                showLocked();
                paint(lockedLine(), 3, "#E8B7B7");
            }
        }

        function schedule() {
            window.clearTimeout(autoTimer);
            generation += 1;
            if (access || reduced) {
                lockNow();
                return;
            }
            autoTimer = window.setTimeout(runAuto, idleBeforeAuto);
        }

        function reset() {
            locked = false;
            drawing = false;
            pts = [];
            panel.classList.remove("is-locked", "is-staged", "is-drawing", "is-inking", "is-arrived");
            prompt.hidden = access;
            again.hidden = true;
            straighten.hidden = !access;
            path.style.strokeDasharray = "none";
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
            if (access || reduced) return;
            if (event.button !== 0) return;
            if (event.target.closest("a, button")) return;
            drawing = true;
            generation += 1;
            window.clearTimeout(autoTimer);
            panel.classList.add("is-drawing");
            panel.classList.remove("is-inking", "is-staged");
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

        async function finishDraw() {
            if (!drawing) return;
            drawing = false;
            if (pathLength(pts) < 28) {
                pts = [];
                panel.classList.remove("is-drawing");
                paint([], 11, "transparent");
                if (!locked) schedule();
                return;
            }
            paint(pts, 8, "#FCF3EE");
            panel.classList.add("is-staged");
            const finished = await morph(pts, lockedLine(), 920, 8, 2.2);
            if (finished) {
                showLocked();
                paint(lockedLine(), 3, "#E8B7B7");
            }
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
            size();
            showLocked();
            paint(lockedLine(), 3, "#E8B7B7");
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
        let progress = reduced ? 1 : 0;
        let drag = null;
        let anim = 0;

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
            if (commit || progress > 0.62) animateTo(1, true);
            else animateTo(0, false);
        }

        if (!reduced) {
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
                try { track.setPointerCapture(event.pointerId); } catch (e) {}
                event.preventDefault();
            });
            track.addEventListener("pointermove", function (event) {
                if (!drag || event.pointerId !== drag.id) return;
                const span = maxTravel() || 1;
                setProgress(drag.start + (event.clientX - drag.startX) / span, false);
            });
            function endDrag(event) {
                if (!drag || (event && event.pointerId !== drag.id)) return;
                drag = null;
                release(false);
            }
            track.addEventListener("pointerup", endDrag);
            track.addEventListener("pointercancel", endDrag);
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
