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
        var useNative = /firefox|webkit\/537\.4/i.test(navigator.userAgent);

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
        doBlend(src, dst, blendMode);

        dest.putImageData(dstData, offsets.destX, offsets.destY);
    }

    function doBlend(src, dst, blendMode) {
        var srcA, srcRA, srcGA, srcBA,
            dstA, dstRA, dstGA, dstBA,
            dA, ddA,
            blendFn = blenders[blendMode];

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
            dst[px+3] = Math.ceil(255 * dA);

            dst[px]   = Math.ceil(blendFn(srcRA, dstRA, srcA, dstA) * ddA);
            dst[px+1] = Math.ceil(blendFn(srcGA, dstGA, srcA, dstA) * ddA);
            dst[px+2] = Math.ceil(blendFn(srcBA, dstBA, srcA, dstA) * ddA);
        }
    }

    var blenders = {
        normal: function (srcCA, dstCA, srcA, dstA) {
            return srcCA + dstCA * (1 - srcA);
        },
        multiply: function (srcCA, dstCA, srcA, dstA) {
            return srcCA * dstCA + srcCA * (1 - dstA) + dstCA * (1 - srcA);
        },
        screen: function (srcCA, dstCA, srcA, dstA) {
            return srcCA + dstCA - srcCA * dstCA;
        },
        overlay: function (srcCA, dstCA, srcA, dstA) {
            return blenders.hardlight(dstCA, srcCA, dstA, srcA);
        },
        darken: function (srcCA, dstCA, srcA, dstA) {
            if (srcCA > dstCA) {
                return dstCA + srcCA * (1 - dstA);
            } else {
                return srcCA + dstCA * (1 - srcA);
            }
        },
        lighten: function (srcCA, dstCA, srcA, dstA) {
            if (srcCA * dstA > dstCA * srcA) {
                return srcCA + dstCA * (1 - srcA);
            } else {
                return dstCA + srcCA * (1 - dstA);
            }
        },
        colordodge: function (srcCA, dstCA, srcA, dstA) {
            if (srcCA === srcA && dstCA === 0) {
                return srcCA * (1 - dstA);
            } else if (srcCA === srcA) {
                return srcA * dstA + srcCA * (1 - dstA) + dstCA * (1 - srcA);
            } else if (srcCA < srcA) {
                if (srcCA === 1) console.log(srcCA);
                return Math.min(1, dstCA / (1 - srcCA));
            }
        },
        colorburn: function (srcCA, dstCA, srcA, dstA) {
            if (srcCA === 0) {
                if (dstCA === dstA) {
                    return srcA * dstA + dstCA * (1 - srcA);
                } else {
                    return dstCA * (1 - srcA);
                }
            } else if (srcCA > 0) {
                if (dstA === 0) return srcCA;
                return srcA * dstA - srcA * dstA * Math.min(1, (1 - dstCA / dstA) * srcA / srcCA) + srcCA * (1 - dstA) + dstCA * (1 - srcA);
            }
        },
        hardlight: function (srcCA, dstCA, srcA, dstA) {
            if (2 * srcCA <= srcA) {
                return 2 * dstCA * srcCA + srcCA * (1 - dstA) + dstCA * (1 - srcA);
            } else {
                return srcA * dstA - 2 * (dstA - dstCA) * (srcA - srcCA) + srcCA * (1 - dstA) + dstCA * (1 - srcA);
            }
        },
        softlight: function (srcCA, dstCA, srcA, dstA) {
            var d = dstCA / dstA;
            if (2 * srcCA <= srcA) {
                return dstCA * (srcA + (2 * srcCA - srcA) * (1 - d)) + srcCA * (1 - dstA) + dstCA * (1 - srcA);
            } else {
                if (4 * dstCA <= dstA) {
                    d = 4 * d * (4 * d + 1) * (d - 1) + 7 * d;
                } else {
                    d = Math.sqrt(d) - d;
                }
                if (dstA === 0) return srcCA;
                return dstCA * srcA + dstA * (2 * srcCA - srcA) * d + srcCA * (1 - dstA) + dstCA * (1 - srcA);
            }
        },
        difference: function (srcCA, dstCA, srcA, dstA) {
            return Math.abs(dstCA * srcA - srcCA * dstA) + srcCA * (1 - dstA) + dstCA * (1 - srcA);
        },
        exclusion: function (srcCA, dstCA, srcA, dstA) {
            return (srcCA * dstA + dstCA * srcA - 2 * srcCA * dstCA) + srcCA * (1 - dstA) + dstCA * (1 - srcA);
        }
    };

    return {
        blendOnto: blendOnto
    };
})();
