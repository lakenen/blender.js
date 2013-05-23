// Blender.js
// Copyright 2013 Cameron Lakenen
// https://github.com/camupod/blender.js

var Blender = (function () {
    var nativeBlendingSupport = {};

    var min = Math.min,
        max = Math.max,
        abs = Math.abs,
        sqrt = Math.sqrt;

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

        var useNativeBlending;
        if (blendMode === 'normal') {
            // normal blend mode is the same as simple
            // source-over compositing, so let's do that instead!
            blendMode = 'source-over';
            useNativeBlending = true;
        } else {
            useNativeBlending = nativeBlendingSupport[blendMode];
            if (typeof useNativeBlending === 'undefined') {
                useNativeBlending = nativeBlendingSupport[blendMode] = nativeBlendingSupported(blendMode);
            }
        }

        if (useNativeBlending) {
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

    var doBlend = function (src, dst, blendFn, compositeFn) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            srcR, srcG, srcB, dstR, dstG, dstB,
            dA, ddA, destColor;

        // non-separable blendmode identities for blendFn
        var nSR = function () { return destColor[0] || 0; };
        var nSG = function () { return destColor[1] || 0; };
        var nSB = function () { return destColor[2] || 0; };
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
                destColor = blendFn([srcR, srcG, srcB], [dstR, dstG, dstB]);
                dst[px]   = 255 * compositeFn.color(srcA, srcR, dstA, dstR, nSR);
                dst[px+1] = 255 * compositeFn.color(srcA, srcG, dstA, dstG, nSG);
                dst[px+2] = 255 * compositeFn.color(srcA, srcB, dstA, dstB, nSB);
                continue;
            }
            dst[px]   = 255 * compositeFn.color(srcA, srcR, dstA, dstR, blendFn);
            dst[px+1] = 255 * compositeFn.color(srcA, srcG, dstA, dstG, blendFn);
            dst[px+2] = 255 * compositeFn.color(srcA, srcB, dstA, dstB, blendFn);
        }
    };


    // NON-SEPARABLE BLEND HELPERS

    var sat = function (c) {
        return max.apply(Math, c) - min.apply(Math, c);
    };

    var lum = function (c) {
        return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    };

    var clipColor = function (c) {
        var l = lum(c),
            n = min.apply(Math, c),
            x = max.apply(Math, c);
        if (n < 0) {
            c[0] = l + ((c[0] - l) * l) / (l - n);
            c[1] = l + ((c[1] - l) * l) / (l - n);
            c[2] = l + ((c[2] - l) * l) / (l - n);
        }
        if (x > 1) {
            c[0] = l + ((c[0] - l) * (1 - l) / (x - l));
            c[1] = l + ((c[1] - l) * (1 - l) / (x - l));
            c[2] = l + ((c[2] - l) * (1 - l) / (x - l));
        }
        return c;
    };

    var setLum = function (c, l) {
        var d = l - lum(c);
        c[0] = c[0] + d;
        c[1] = c[1] + d;
        c[2] = c[2] + d;
        return clipColor(c);
    };

    var setSatComponents = function (color, cmin, cmid, cmax, satVal) {
        color[cmid] -= color[cmin];
        color[cmax] -= color[cmin];
        color[cmin] = 0;
        if (color[cmax] > 0) {
            color[cmid] *= satVal / color[cmax];
            color[cmax] = satVal;
        }
    };

    var setSat = function (c, s) {
        var r = c[0], g = c[1], b = c[2];
        if (r <= g) {
            if (g <= b) {
                // r <= g <= b
                setSatComponents(c, 0, 1, 2, s);
            }
            else {
                if (r <= b) {
                    // r <= b <= g
                    setSatComponents(c, 0, 2, 1, s);
                }
                else {
                    // b <= r <= g
                    setSatComponents(c, 2, 0, 1, s);
                }
            }
        }
        else {
            if (r <= b) {
                // g <= r <= b
                setSatComponents(c, 1, 0, 2, s);
            }
            else {
                if (g <= b) {
                    // g <= b <= r
                    setSatComponents(c, 1, 2, 0, s);
                }
                else {
                    // b <= g <= r
                    setSatComponents(c, 2, 1, 0, s);
                }
            }
        }
        return c;
    };


    // COMPOSITING FUNCTIONS

    var compositors = {
        /* not used; just here for an example (useless) compositor
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
        },*/
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


    // BLENDING FUNCTIONS

    // https://dvcs.w3.org/hg/FXTF/rawfile/tip/compositing/index.html#blendingnormal
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


    // TESTING NATIVE SUPPORT (fuzzy & arbitrary)

    function nativeBlendingSupported(mode) {
        var tolerance = 8;
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var expected = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        canvas.width = canvas.height = 2;
        ctx.globalCompositeOperation = mode;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = 'rgba(0, 0, 255, 0.75)';
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = 'rgba(255, 0, 0, 1)';
        ctx.fillRect(1, 0, 1, 1);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.75)';
        ctx.fillRect(1, 0, 1, 1);
        ctx.fillStyle = 'rgba(255, 0, 0, 1)';
        ctx.fillRect(0, 1, 1, 1);
        ctx.fillStyle = 'rgba(200, 255, 0, 1)';
        ctx.fillRect(0, 1, 1, 1);
        ctx.fillStyle = 'rgba(255, 0, 255, 1)';
        ctx.fillRect(1, 1, 1, 1);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(1, 1, 1, 1);
        var data = ctx.getImageData(0, 0, 2, 2).data;
        switch (mode) {
            case 'normal':
                return true;
            case 'multiply':
                expected = [36, 0, 109, 223, 64, 0, 0, 255, 200, 0, 0, 255, 255, 0, 255, 255];
                break;
            case 'screen':
                expected = [145, 0, 218, 223, 255, 191, 0, 255, 255, 255, 0, 255, 255, 127, 255, 255];
                break;
            case 'overlay':
                expected = [145, 0, 109, 223, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 255, 255];
                break;
            case 'darken':
                expected = [36, 0, 109, 223, 64, 0, 0, 255, 200, 0, 0, 255, 255, 0, 255, 255];
                break;
            case 'lighten':
                expected = [145, 0, 218, 223, 255, 191, 0, 255, 255, 255, 0, 255, 255, 127, 255, 255];
                break;
            case 'color-dodge':
                expected = [145, 0, 109, 223, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 255, 255];
                break;
            case 'color-burn':
                expected = [145, 0, 109, 223, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 255, 255];
                break;
            case 'hard-light':
                expected = [36, 0, 218, 223, 64, 191, 0, 255, 255, 255, 0, 255, 255, 127, 255, 255];
                break;
            case 'soft-light':
                expected = [145, 0, 109, 223, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 255, 255];
                break;
            case 'difference':
            case 'exclusion':
                expected = [145, 0, 218, 223, 255, 191, 0, 255, 55, 255, 0, 255, 128, 127, 128, 255];
                break;
            case 'hue':
            case 'color':
                expected = [59, 22, 218, 223, 64, 98, 0, 255, 73, 93, 0, 255, 180, 52, 180, 255];
                break;
            case 'saturation':
                expected = [144, 0, 109, 223, 255, 0, 0, 255, 255, 0, 0, 255, 180, 52, 180, 255];
                break;
            case 'luminosity':
                expected = [76, 0, 109, 223, 255, 78, 78, 255, 255, 191, 191, 255, 255, 127, 255, 255];
                break;
        }
        for (var i = 0, l = data.length; i < l; ++i) {
            if (abs(data[i] - expected[i]) > tolerance) {
                return false;
            }
        }
        return true;
    }

    var blendModes = [];
    for (var bm in blenders) {
        blendModes.push(bm);
    }

    return {
        modes: blendModes,
        blendOnto: blendOnto
    };
})();
