export const normVisorData = (im: Float32Array | Uint16Array): Uint8Array => {
  const exp7Minus1 = Math.exp(7) - 1;
  const result = new Uint8Array(im.length);

  for (let i = 0; i < im.length; i++) {
    const normalizedValue =
      (Math.log(1 + ((im[i] - 100) / (65536 - 100)) * exp7Minus1) / 7) * 256;
    result[i] = Math.min(Math.max(Math.round(normalizedValue), 0), 255); // Clamp to 0-255
  }

  return result;
};
