// Blender.js
// Copyright 2013 Cameron Lakenen
// https://dvcs.w3.org/hg/FXTF/rawfile/tip/compositing/index.html#blendingnormal


var Blender = (function () {

    function blendOnto(source, dest, blendMode, options) {
        var sourceCanvas = source.canvas;
        var destCanvas = dest.canvas;

        options = options || {};
        var offsets = {
            width: options.width || sourceCanvas.width,
            height: options.height || sourceCanvas.height,
            sourceX: options.sourceX || 0,
            sourceY: options.sourceY || 0,
            destX: options.destX || 0,
            destY: options.destY || 0
        };
        offsets.width  = Math.min(offsets.width, sourceCanvas.width - offsets.sourceX, destCanvas.width - offsets.destX);
        offsets.height = Math.min(offsets.height, sourceCanvas.height - offsets.sourceY, destCanvas.height - offsets.destY);

        // TODO: test for native support (possibly on per-blendmode basis)
        var useNative = /firefox.*2\d|webkit\/537\.4/i.test(navigator.userAgent);

        if (useNative) {
            dest.save();
            dest.globalCompositeOperation = blendMode;
            dest.drawImage(source.canvas,
                        offsets.sourceX, offsets.sourceY, offsets.width, offsets.height,
                        offsets.destX, offsets.destY, offsets.width, offsets.height);
            dest.restore();
            return;
        }

        var srcData = source.getImageData(offsets.sourceX, offsets.sourceY, offsets.width, offsets.height);
        var dstData = dest.getImageData(offsets.destX, offsets.destY, offsets.width, offsets.height);

        var src  = srcData.data;
        var dst  = dstData.data;

        blendMode = blendMode.replace('-', '');
        var compositeMode = dest.globalCompositeOperation;
        compositeMode = compositeMode.replace('-', '');

        var compositeFn = compositors[compositeMode] || compositors.sourceover;
        var blendFn = blenders[blendMode] || blenders.normal;
        doBlend(src, dst, blendFn, compositeFn);

        dest.putImageData(dstData, offsets.destX, offsets.destY);
    }

    function doBlend(src, dst, blendFn, compositeFn) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            srcR, srcG, srcB, dstR, dstG, dstB,
            dA, ddA, destColor;
        var nSR = function () { return destColor.r || 0; };
        var nSG = function () { return destColor.g || 0; };
        var nSB = function () { return destColor.b || 0; };
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcR  = src[px]   / 255;
            srcG  = src[px+1] / 255;
            srcB  = src[px+2] / 255;

            dstA  = dst[px+3] / 255;
            dstR  = dst[px]   / 255;
            dstG  = dst[px+1] / 255;
            dstB  = dst[px+2] / 255;

            dA = compositeFn.alpha(srcA, dstA);
            dst[px+3] = 255 * dA;

            if (blendFn.nonSeparable) {
                destColor = blendFn({ r: srcR, g: srcG, b: srcB }, { r: dstR, g: dstG, b: dstB });
                dst[px]   = 255 * compositeFn.color(srcA, srcR, dstA, dstR, nSR);
                dst[px+1] = 255 * compositeFn.color(srcA, srcG, dstA, dstG, nSG);
                dst[px+2] = 255 * compositeFn.color(srcA, srcB, dstA, dstB, nSB);
                continue;
            }
            dst[px]   = 255 * compositeFn.color(srcA, srcR, dstA, dstR, blendFn);
            dst[px+1] = 255 * compositeFn.color(srcA, srcG, dstA, dstG, blendFn);
            dst[px+2] = 255 * compositeFn.color(srcA, srcB, dstA, dstB, blendFn);
        }
    }
    var min = Math.min,
        max = Math.max,
        abs = Math.abs,
        sqrt = Math.sqrt;

    var sat = function (c) {
        return max(c.r, c.g, c.b) - min(c.r, c.g, c.b);
    };
    var lum = function (c) {
        return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
    };
    var clipColor = function (c) {
        var l = lum(c),
            n = min(c.r, c.g, c.b),
            x = max(c.r, c.g, c.b);
        if (n < 0) {
            c.r = l + (c.r - l) * l / (l - n);
            c.g = l + (c.g - l) * l / (l - n);
            c.b = l + (c.b - l) * l / (l - n);
        }
        if (x > 1) {
            c.r = l + (c.r - l) * (1 - l) / (x - l);
            c.g = l + (c.g - l) * (1 - l) / (x - l);
            c.b = l + (c.b - l) * (1 - l) / (x - l);
        }
        return c;
    };

    var setLum = function (c, l) {
        var d = l - lum(c);
        c.r = c.r + d;
        c.g = c.g + d;
        c.b = c.b + d;
        return clipColor(c);
    };

    var setSat = function (c, s) {
        var cmax = max(c.r, c.g, c.b);
        var cmin = min(c.r, c.g, c.b);
        var mx = null, mn = null, md = null;
        var parts = ['r', 'g', 'b'];
        parts.forEach(function (x) {
            if (c[x] === cmax && mx === null) mx = x;
            else if (c[x] === cmin && mn === null) mn = x;
            else if (md === null) {
                md = x;
                cmid = c[md];
            }
        });

        if (cmax > cmin) {
            cmid = (cmid - cmin) * s / (cmax - cmin);
            cmax = s;
        } else {
            cmid = cmax = 0;
        }
        cmin = 0;
        c[mx] = cmax;
        c[mn] = cmin;
        c[md] = cmid;
        return c;
    };

    var compositors = {
        clear: {
            alpha: function (srcA, dstA) {
                if (srcA === 0) {
                    return dstA;
                } else {
                    return 0;
                }
            },
            color: function (srcA, srcC, dstA, dstC, blendFn) {
                if (srcA === 0) {
                    return dstC;
                } else {
                    return 0;
                }
            }
        },
        sourceover: {
            alpha: function (srcA, dstA) {
                return srcA + dstA * (1 - srcA);
            },
            color: function (srcA, srcC, dstA, dstC, blendFn) {
                var dA = this.alpha(srcA, dstA);
                return ((1 - dstA) * srcA * srcC + (1 - srcA) * dstA * dstC + srcA * dstA * blendFn(srcC, dstC)) / dA;
            }
        }
    };

    var blenders = {
        normal: function (srcC, dstC) {
            return srcC;
        },
        multiply: function (srcC, dstC) {
            return srcC * dstC;
        },
        screen: function (srcC, dstC) {
            return srcC + dstC - srcC * dstC;
        },
        overlay: function (srcC, dstC) {
            if (dstC <= 0.5) {
                return 2 * srcC * dstC;
            } else {
                return 1 - 2 * (1 - srcC) * (1 - dstC);
            }
        },
        darken: function (srcC, dstC) {
            return min(srcC, dstC);
        },
        lighten: function (srcC, dstC) {
            return max(srcC, dstC);
        },
        colordodge: function (srcC, dstC) {
            if (srcC < 1) {
                return min(1, dstC / (1 - srcC));
            } else {
                return 1;
            }
        },
        colorburn: function (srcC, dstC) {
            if (srcC > 0) {
                return 1 - min(1, (1 - dstC)/srcC);
            } else {
                return 0;
            }
        },
        hardlight: function (srcC, dstC) {
            if (srcC <= 0.5) {
                return 2 * srcC * dstC;
            } else {
                return 1 - 2 * (1 - srcC) * (1 - dstC);
            }
        },
        softlight: function (srcC, dstC) {
            var g;
            if (srcC <= 0.5) {
                return dstC - (1 - 2 * srcC) * dstC * (1 - dstC);
            } else {
                if (dstC <= 0.25) {
                    g = ((16 * dstC - 12) * dstC + 4) * dstC;
                } else {
                    g = sqrt(dstC);
                }
                return dstC + (2 * srcC - 1) * (g - dstC);
            }
        },
        difference: function (srcC, dstC) {
            return abs(dstC - srcC);
        },
        exclusion: function (srcC, dstC) {
            return srcC + dstC - 2 * srcC * dstC;
        },

        // NON-SEPARABLE BLEND MODES

        hue: function (srcC, dstC) {
            return setLum(setSat(srcC, sat(dstC)), lum(dstC));
        },
        saturation: function (srcC, dstC) {
            return setLum(setSat(dstC, sat(srcC)), lum(dstC));
        },
        color: function (srcC, dstC) {
            return setLum(srcC, lum(dstC));
        },
        luminosity: function (srcC, dstC) {
            return setLum(dstC, lum(srcC));
        }
    };

    blenders.hue.nonSeparable = blenders.saturation.nonSeparable = blenders.color.nonSeparable = blenders.luminosity.nonSeparable = true;

    return {
        blendOnto: blendOnto
    };
})();
