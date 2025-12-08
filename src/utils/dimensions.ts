import type { DimensionInfo } from '../types/params.types.js';
import { ASPECT_RATIO_PRESETS, getAspectRatioPresets, type AspectRatioPreset } from '../types/models.js';

export class ImageDimensionCalculator {
  static calculateDimensions(
    aspectRatio?: string,
    width?: number,
    height?: number,
    resolution: '2k' | '4k' = '2k'
  ): DimensionInfo {
    // If explicit width and height provided, use them
    if (width && height) {
      return {
        width,
        height,
        resolutionType: this.getResolutionType(width, height)
      };
    }

    // Get aspect ratio presets based on resolution
    const presets = getAspectRatioPresets(resolution);
    const preset = presets.find(p => p.name === aspectRatio);

    if (!preset) {
      // Default to 1:1 official dimensions if no match found
      const defaultPreset = presets.find(p => p.name === '1:1')!;
      return {
        width: defaultPreset.width,
        height: defaultPreset.height,
        resolutionType: defaultPreset.resolutionType
      };
    }

    // Use official API dimensions directly from preset
    return {
      width: preset.width,
      height: preset.height,
      resolutionType: preset.resolutionType
    };
  }

  private static getResolutionType(width: number, height: number): string {
    const maxDimension = Math.max(width, height);
    if (maxDimension <= 2048) return '2k';
    if (maxDimension <= 4096) return '4k';
    return '8k';
  }

  static getAspectRatioPreset(name: string, resolution: '2k' | '4k' = '2k'): AspectRatioPreset | undefined {
    const presets = getAspectRatioPresets(resolution);
    return presets.find(preset => preset.name === name);
  }

  static getAspectRatioByName(ratioName: string, resolution: '2k' | '4k' = '2k'): number {
    const preset = this.getAspectRatioPreset(ratioName, resolution);
    return preset ? preset.imageRatio : 1;
  }
}