// Blender.js
// Copyright 2013 Cameron Lakenen
// https://dvcs.w3.org/hg/FXTF/rawfile/tip/compositing/index.html#blendingnormal


var Blender = (function () {

    function blendOnto(source, dest, blendMode, options) {
        var sourceCanvas = source.canvas;
        var destCanvas = dest.canvas;
        var offsets = {
            width: options.width || source.canvas.width,
            height: options.height || source.canvas.height,
            sourceX: options.sourceX || 0,
            sourceY: options.sourceY || 0,
            destX: options.destX || 0,
            destY: options.destY || 0
        };
        offsets.width  = Math.min(offsets.width, sourceCanvas.width - offsets.sourceX, destCanvas.width - offsets.destX);
        offsets.height = Math.min(offsets.height, sourceCanvas.height - offsets.sourceY, destCanvas.height - offsets.destY);

        var useNative = /firefox/i.test(navigator.userAgent);

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

        doBlend(src, dst, blendMode);

        dest.putImageData(dstData, offsets.destX, offsets.destY);
    }

    function doBlend(src, dst, blendMode) {
        switch (blendMode) {
            case 'normal':
                normal(src, dst);
                break;
            case 'multiply':
                multiply(src, dst);
                break;
            case 'screen':
                screen(src, dst);
                break;
            case 'overlay':
                overlay(src, dst);
                break;
            case 'darken':
                darken(src, dst);
                break;
            case 'lighten':
                lighten(src, dst);
                break;
            case 'color-dodge':
                colordodge(src, dst);
                break;
            case 'color-burn':
                colorburn(src, dst);
                break;
            case 'hard-light':
                hardlight(src, dst);
                break;
            case 'soft-light':
                softlight(src, dst);
                break;
            case 'difference':
                difference(src, dst);
                break;
            case 'exclusion':
                exclusion(src, dst);
                break;
        }
    }

    function normal(src, dst) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA;
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcRA = src[px]   / 255 * srcA;
            srcGA = src[px+1] / 255 * srcA;
            srcBA = src[px+2] / 255 * srcA;

            dstA  = dst[px+3] / 255;
            dstRA = dst[px]   / 255 * dstA;
            dstGA = dst[px+1] / 255 * dstA;
            dstBA = dst[px+2] / 255 * dstA;

            dA = (srcA + dstA - srcA * dstA);
            ddA = 255 / dA;
            dst[px+3] = 255 * dA;

            dst[px]   = (srcRA + dstRA - dstRA * srcA) * ddA;
            dst[px+1] = (srcGA + dstGA - dstGA * srcA) * ddA;
            dst[px+2] = (srcBA + dstBA - dstBA * srcA) * ddA;
        }
    }

    function multiply(src, dst) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA;
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcRA = src[px]   / 255 * srcA;
            srcGA = src[px+1] / 255 * srcA;
            srcBA = src[px+2] / 255 * srcA;

            dstA  = dst[px+3] / 255;
            dstRA = dst[px]   / 255 * dstA;
            dstGA = dst[px+1] / 255 * dstA;
            dstBA = dst[px+2] / 255 * dstA;

            dA = (srcA + dstA - srcA * dstA);
            ddA = 255 / dA;
            dst[px+3] = 255 * dA;

            dst[px]   = (srcRA * dstRA + srcRA * (1 - dstA) + dstRA * (1 - srcA)) * ddA;
            dst[px+1] = (srcGA * dstGA + srcGA * (1 - dstA) + dstGA * (1 - srcA)) * ddA;
            dst[px+2] = (srcBA * dstBA + srcBA * (1 - dstA) + dstBA * (1 - srcA)) * ddA;
        }
    }

    function screen(src, dst) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA;
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcRA = src[px]   / 255 * srcA;
            srcGA = src[px+1] / 255 * srcA;
            srcBA = src[px+2] / 255 * srcA;

            dstA  = dst[px+3] / 255;
            dstRA = dst[px]   / 255 * dstA;
            dstGA = dst[px+1] / 255 * dstA;
            dstBA = dst[px+2] / 255 * dstA;

            dA = (srcA + dstA - srcA * dstA);
            ddA = 255 / dA;
            dst[px+3] = 255 * dA;

            // screen(sC, dC) = sC + dC - sC * dC
            dst[px]   = (srcRA + dstRA - srcRA * dstRA) * ddA;
            dst[px+1] = (srcGA + dstGA - srcGA * dstGA) * ddA;
            dst[px+2] = (srcBA + dstBA - srcBA * dstBA) * ddA;
        }
    }

    function overlay(src, dst) {
        hardlight(dst, src);
        dst.set(src);
    }

    function darken(src, dst) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA;
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcRA = src[px]   / 255 * srcA;
            srcGA = src[px+1] / 255 * srcA;
            srcBA = src[px+2] / 255 * srcA;

            dstA  = dst[px+3] / 255;
            dstRA = dst[px]   / 255 * dstA;
            dstGA = dst[px+1] / 255 * dstA;
            dstBA = dst[px+2] / 255 * dstA;

            dA = (srcA + dstA - srcA * dstA);
            ddA = 255 / dA;
            dst[px+3] = 255 * dA;

            // darken(sC, dC) = min(dC, sC)
            if (srcRA > dstRA) {
                dst[px] = dstRA * ddA;
            } else {
                dst[px] = srcRA * ddA;
            }
            if (srcGA > dstGA) {
                dst[px+1] = dstGA * ddA;
            } else {
                dst[px+1] = srcGA * ddA;
            }
            if (srcBA > dstBA) {
                dst[px+2] = dstBA * ddA;
            } else {
                dst[px+2] = srcBA * ddA;
            }
        }
    }

    function lighten(src, dst) {
        darken(dst, src);
        dst.set(src);
    }

    function colordodge(src, dst) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA;
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcRA = src[px]   / 255 * srcA;
            srcGA = src[px+1] / 255 * srcA;
            srcBA = src[px+2] / 255 * srcA;

            dstA  = dst[px+3] / 255;
            dstRA = dst[px]   / 255 * dstA;
            dstGA = dst[px+1] / 255 * dstA;
            dstBA = dst[px+2] / 255 * dstA;

            dA = (srcA + dstA - srcA * dstA);
            ddA = 255 / dA;
            dst[px+3] = 255 * dA;

            if (dstRA === 0 || dstRA === 1) {
                dst[px] = dstRA * ddA;
            } else {
                dstRA = dstRA / (1 - srcRA);
                if (dstRA > 1) dstRA = 1;
                dst[px] = dstRA * ddA;
            }

            if (dstGA === 0 || dstGA === 1) {
                dst[px+1] = dstGA * ddA;
            } else {
                dstGA = dstGA / (1 - srcGA);
                if (dstGA > 1) dstGA = 1;
                dst[px+1] = dstGA * ddA;
            }

            if (dstBA === 0 || dstBA === 1) {
                dst[px+2] = dstBA * ddA;
            } else {
                dstBA = dstBA / (1 - srcBA);
                if (dstBA > 1) dstBA = 1;
                dst[px+2] = dstBA * ddA;
            }
        }
    }

    function colorburn(src, dst) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA;
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcRA = src[px]   / 255 * srcA;
            srcGA = src[px+1] / 255 * srcA;
            srcBA = src[px+2] / 255 * srcA;

            dstA  = dst[px+3] / 255;
            dstRA = dst[px]   / 255 * dstA;
            dstGA = dst[px+1] / 255 * dstA;
            dstBA = dst[px+2] / 255 * dstA;

            dA = (srcA + dstA - srcA * dstA);
            ddA = 255 / dA;
            dst[px+3] = 255 * dA;

            dst[px]   = (srcRA + dstRA - dstRA * srcA) * ddA;
            dst[px+1] = (srcGA + dstGA - dstGA * srcA) * ddA;
            dst[px+2] = (srcBA + dstBA - dstBA * srcA) * ddA;
        }
    }

    function hardlight(src, dst) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA;
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcRA = src[px]   / 255 * srcA;
            srcGA = src[px+1] / 255 * srcA;
            srcBA = src[px+2] / 255 * srcA;

            dstA  = dst[px+3] / 255;
            dstRA = dst[px]   / 255 * dstA;
            dstGA = dst[px+1] / 255 * dstA;
            dstBA = dst[px+2] / 255 * dstA;

            dA = (srcA + dstA - srcA * dstA);
            ddA = 255 / dA;
            dst[px+3] = 255 * dA;

            dst[px]   = (srcRA + dstRA - dstRA * srcA) * ddA;
            dst[px+1] = (srcGA + dstGA - dstGA * srcA) * ddA;
            dst[px+2] = (srcBA + dstBA - dstBA * srcA) * ddA;
        }
    }

    function softlight(src, dst) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA;
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcRA = src[px]   / 255 * srcA;
            srcGA = src[px+1] / 255 * srcA;
            srcBA = src[px+2] / 255 * srcA;

            dstA  = dst[px+3] / 255;
            dstRA = dst[px]   / 255 * dstA;
            dstGA = dst[px+1] / 255 * dstA;
            dstBA = dst[px+2] / 255 * dstA;

            dA = (srcA + dstA - srcA * dstA);
            ddA = 255 / dA;
            dst[px+3] = 255 * dA;

            dst[px]   = (srcRA + dstRA - dstRA * srcA) * ddA;
            dst[px+1] = (srcGA + dstGA - dstGA * srcA) * ddA;
            dst[px+2] = (srcBA + dstBA - dstBA * srcA) * ddA;
        }
    }

    function difference(src, dst) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA;
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcRA = src[px]   / 255 * srcA;
            srcGA = src[px+1] / 255 * srcA;
            srcBA = src[px+2] / 255 * srcA;

            dstA  = dst[px+3] / 255;
            dstRA = dst[px]   / 255 * dstA;
            dstGA = dst[px+1] / 255 * dstA;
            dstBA = dst[px+2] / 255 * dstA;

            dA = (srcA + dstA - srcA * dstA);
            ddA = 255 / dA;
            dst[px+3] = 255 * dA;

            dst[px]   = (srcRA + dstRA - dstRA * srcA) * ddA;
            dst[px+1] = (srcGA + dstGA - dstGA * srcA) * ddA;
            dst[px+2] = (srcBA + dstBA - dstBA * srcA) * ddA;
        }
    }

    function exclusion(src, dst) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA;
        for (var px = 0, l = dst.length; px < l; px += 4) {
            srcA  = src[px+3] / 255;
            srcRA = src[px]   / 255 * srcA;
            srcGA = src[px+1] / 255 * srcA;
            srcBA = src[px+2] / 255 * srcA;

            dstA  = dst[px+3] / 255;
            dstRA = dst[px]   / 255 * dstA;
            dstGA = dst[px+1] / 255 * dstA;
            dstBA = dst[px+2] / 255 * dstA;

            dA = (srcA + dstA - srcA * dstA);
            ddA = 255 / dA;
            dst[px+3] = 255 * dA;

            dst[px]   = (srcRA + dstRA - dstRA * srcA) * ddA;
            dst[px+1] = (srcGA + dstGA - dstGA * srcA) * ddA;
            dst[px+2] = (srcBA + dstBA - dstBA * srcA) * ddA;
        }
    }

    return {
        blendOnto: blendOnto
    };
})();
