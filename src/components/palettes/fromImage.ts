import type { PaletteInput, RGB, RGBA } from "../../types.d.ts";
import { GIF, Image } from "imagescript/mod.ts";
import HueBlock from "../blocks/HueBlock.ts";
import ImageBlock from "../blocks/ImageBlock.ts";
import { handlePaletteInput, rgbaMatch } from "../../_utils.ts";
import { CHUNK_SIZE } from "../../constants.ts";

/**
 * Minimum pixel alpha value to allow in palette
 */
const MIN_ALPHA = Math.round(255 * 0.5);

/**
 * Max palette size = RGBA channel values permutations (RGB 0-255 + Acceptable alpha range)
 */
const MAX_PALETTE_SIZE = Math.floor(256 ** 3 + MIN_ALPHA);

/**
 * Maximum width
 */
const BOUNDARY_X = 256;

/**
 * Maximum height
 */
const BOUNDARY_Y = 256;

/**
 * Maximum number of GIF frames to process into palette
 */
const MAX_FRAME_DEPTH = 10;

export async function getSlices(
  src: Extract<string, PaletteInput>,
  size: number,
): Promise<ImageBlock[]> {
  const input = await handlePaletteInput(src);

  // TODO: For each frame, offset z index

  const frames = (input instanceof GIF ? input : [input]);

  const slices: Array<ImageBlock> = [];

  let zItr = 0;
  frames.forEach((frame) => {
    const { width, height } = frame;

    let positionXitr = 0;
    let positionYitr = 0;

    for (let xItr = 0; xItr < width; xItr += size) {
      for (let yItr = 0; yItr < height; yItr += size) {
        const frameTexture = frame.clone().crop(xItr, yItr, size, size);

        slices.push(
          new ImageBlock(
            frameTexture,
            [positionXitr, positionYitr, zItr],
            {
              en_US: `X${positionXitr} Y${positionYitr} Z${zItr}`,
              en_GB: `X${positionXitr} Y${positionYitr} Zed${zItr}`,
            },
          ),
        );
        positionYitr++;
      }
      positionXitr++;
    }
    zItr++;
  });

  return slices;
}

export async function getPalette(
  src: Extract<string, PaletteInput>,
): Promise<HueBlock[]> {
  const colors: RGBA[] = [];
  const input = await handlePaletteInput(src);
  // Resize large images
  if (input.height > BOUNDARY_Y) {
    console.log("Resizing input height");
    input.resize(Image.RESIZE_AUTO, BOUNDARY_Y, Image.RESIZE_NEAREST_NEIGHBOR);
  }

  if (input.width > BOUNDARY_X) {
    console.log("Resizing input width");
    input.resize(BOUNDARY_X, Image.RESIZE_AUTO, Image.RESIZE_NEAREST_NEIGHBOR);
  }

  const frames = input instanceof GIF ? input : [input];
  const frameCount = frames.length;
  const fuzzRange = [255 / 15, 255 / 15, 255 / 15, 255 / 50];

  let itr = Math.min(frameCount, MAX_FRAME_DEPTH);

  // Collect colors from each frame
  while (itr--) {
    const img = frames[itr];

    for (const [_x, _y, c] of img.iterateWithColors()) {
      const color = <RGBA> Image.colorToRGBA(c);
      // Add to palette if the color is above the minimum alpha level
      // and if its RGBA values do not exactly match any existing colors
      if (
        color[3] > MIN_ALPHA &&
        (!colors.length ||
          !colors.some((existingColor) =>
            rgbaMatch(existingColor, color, fuzzRange)
          ))
      ) {
        colors.push(color);
      }
    }
  }

  if (colors.length > MAX_PALETTE_SIZE) {
    colors.length = MAX_PALETTE_SIZE;
    console.log("Palette size has been truncated.");
    // TODO: Set average and dominate colors as array entries when palette is too large? (MAX_PALETTE_SIZE - 2)
  }
  return colors.map((color: RGBA) => new HueBlock(color));
}
